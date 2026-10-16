import { useEffect, useRef, useState } from 'react'
import { deleteLiveTable, loadDashboardStations, loadPackingSessions, type DashboardWarehouse, type PackingSession } from './api'
import { watchRefresh } from './liveRefresh'
import { WhepPlayer } from './WhepPlayer'
import Dropdown from './Dropdown'

function historyStatusLabel(status?: string) {
  if (status === 'COMPLETED') return 'Hoàn tất'
  if (status === 'IN_PROGRESS') return 'Đang xử lý'
  if (!status) return 'Không rõ trạng thái'
  return status.toLowerCase().replaceAll('_', ' ').replace(/^\w/, letter => letter.toUpperCase())
}

export default function LivePage({ onOpenPlayback, onOpenPacking }: { onOpenPlayback: (id: string) => void; onOpenPacking: (context: {tableId: string; tableType: string}) => void }) {
  const [warehouses, setWarehouses] = useState<DashboardWarehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('ALL')
  const [detail, setDetail] = useState(false)
  const [history, setHistory] = useState<PackingSession[]>([])
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState('')
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true); setDeleteError('')
    try {
      await deleteLiveTable(deleteTarget.id)
      setWarehouses(current => current.map(warehouse => ({...warehouse, tables: warehouse.tables.filter(table => table.id !== deleteTarget.id)})))
      setSelectedId(''); setNotice(`Đã xóa bàn “${deleteTarget.name}”.`); setDeleteTarget(null)
    } catch (error) { setDeleteError(error instanceof Error ? error.message : 'Không thể xóa bàn.') }
    finally { setDeleting(false) }
  }
  useEffect(() => {
    if (!deleteTarget) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !deleting) setDeleteTarget(null) }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [deleteTarget, deleting])
  const [historyError, setHistoryError] = useState('')
  const stage = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === stage.current) await document.exitFullscreen()
      else await stage.current?.requestFullscreen()
    } catch { setFullscreen(document.fullscreenElement === stage.current) }
  }
  const [now, setNow] = useState(Date.now())
  useEffect(() => watchRefresh(async signal => {
    try { const result = await loadDashboardStations(signal); if (!signal.aborted) { setWarehouses(result.warehouses); setError('') } }
    catch (error) { if (!signal.aborted) setError('Không thể tải dữ liệu trực tiếp.'); throw error }
  }), [])
  const warehouse = warehouses.find(item => item.id === warehouseId) ?? warehouses[0]
  const tables = (warehouse?.tables ?? []).filter(table => (type === 'ALL' || table.table_type === type) && `${table.name} ${table.code} ${table.current_session?.tracking_code ?? ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  const selected = tables.find(table => table.id === selectedId) ?? tables[0]
  useEffect(() => { setDetail(false) }, [selected?.id])
  useEffect(() => {
    setHistory([]); setHistoryError('')
    if (!selected) return
    return watchRefresh(async signal => {
      try { const rows = await loadPackingSessions({ tableId: selected.id, limit: 10, groupConsecutive: true }, signal); if (!signal.aborted) { setHistory(rows); setHistoryError('') } }
      catch (error) { if (!signal.aborted) setHistoryError('Không thể tải lịch sử.'); throw error }
    })
  }, [selected?.id])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const hasCamera = (table: NonNullable<typeof selected>, lens: 'overview' | 'detail') => Boolean(table.cameras?.[lens]?.enabled && table.cameras[lens]?.webrtc_url)
  const mainLens = detail ? 'detail' : 'overview'
  const pipLens = detail ? 'overview' : 'detail'
  const elapsed = selected?.current_session?.started_at ? Math.max(0, Math.floor((now - new Date(selected.current_session.started_at).getTime()) / 1000)) : 0
  return <>
    <section className="toolbar live-toolbar" aria-label="Bộ lọc camera">
      <Dropdown className="ui-dropdown--inline toolbar-warehouse-select" ariaLabel="Chọn kho" value={warehouse?.id ?? ''} onChange={id => { setWarehouseId(id); setSelectedId('') }} options={warehouses.map(item => ({value:item.id,label:`${item.name} (${item.tables.length} Bàn)`}))} />
      <label className="search-box"><input aria-label="Tìm kiếm nhanh" placeholder="Tìm bàn hoặc mã đơn…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="dashboard-v2-filter toolbar-type-filter"><span>Loại bàn</span><Dropdown ariaLabel="Lọc theo loại bàn" value={type} onChange={setType} options={[{value:'ALL',label:'Tất cả loại bàn'},{value:'PACKING',label:'Đóng hàng'},{value:'RETURN_INSPECTION',label:'Hoàn hàng'}]} /></label>
    </section>
    {notice && <div role="status">{notice}</div>}
    {error && <div className="api-error" role="alert">{error}</div>}
    <div className="content-grid"><section className="camera-wall"><div className="camera-grid">{tables.map(table => <button key={table.id} className={`camera-card ${selected?.id === table.id ? 'selected' : ''} ${table.status === 'ONLINE' ? 'active' : 'inactive'}`} onClick={() => setSelectedId(table.id)} aria-label={`Xem ${table.name}`}>
      <div className="camera-image">{hasCamera(table, 'overview') || hasCamera(table, 'detail') ? <WhepPlayer streamPath={`/tables/${table.id}/${hasCamera(table,'overview') ? 'overview' : 'detail'}`} label={`Live ${table.name}`} /> : <div className="no-signal">Không có tín hiệu</div>}<span className="camera-id">{table.name}</span></div>
    </button>)}</div>{!tables.length && <div className="empty-state">Không có bàn phù hợp.</div>}</section>
      {selected && <aside className="detail-panel"><div ref={stage} className="station-image-wrap station-camera-stage live-camera-stage">
        {hasCamera(selected, mainLens) ? <WhepPlayer streamPath={`/tables/${selected.id}/${mainLens}`} label={`Live ${selected.name}`} /> : <div className="station-camera-empty">Chưa có luồng camera</div>}
        <span className="station-camera-label">{detail ? 'Góc cận' : 'Toàn cảnh'}</span>
        {hasCamera(selected,pipLens) && <button className="station-camera-pip" onClick={() => setDetail(value => !value)} aria-label="Đổi góc camera"><WhepPlayer streamPath={`/tables/${selected.id}/${pipLens}`} label="Góc camera phụ" /></button>}
        <button type="button" className="station-camera-expand" aria-label={fullscreen ? 'Thu nhỏ khung camera' : 'Mở rộng khung camera'} title={fullscreen ? 'Thu nhỏ' : 'Phóng to'} aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={fullscreen ? 'M4 8h4V4m8 0v4h4M4 16h4v4m8 0v-4h4' : 'M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4'} /></svg></button>
      </div><div className="detail-block current-order"><div className="station-heading"><div className="station-title">{selected.name}</div><b className={`inline-status ${selected.status === 'ONLINE' ? 'active' : 'inactive'}`}>{selected.status === 'ONLINE' ? 'Trực tuyến' : 'Ngoại tuyến'}</b></div><div className="order-meta"><span><small>Đơn hàng hiện tại</small><b>{selected.current_session?.tracking_code || '—'}</b></span><span><small>Thời gian</small><b>{selected.current_session ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2,'0')}` : '—'}</b></span></div></div>
      <div className="detail-block history-block"><div className="history-heading"><div className="block-label">Đơn hàng mới</div></div>{historyError && <p role="alert">{historyError}</p>}<div className="history-list">{history.map(session => <article className="history-item" key={session.id}><div className="history-item-main"><strong>{session.tracking_code || 'Chưa nhận diện'}</strong><span className="history-item-actions"><button onClick={() => onOpenPlayback(session.id)}>Xem video</button></span></div><div className="history-item-meta"><span className={`history-status ${session.status === 'COMPLETED' ? 'completed' : session.status === 'IN_PROGRESS' ? 'in-progress' : 'other'}`}><i aria-hidden="true" />{historyStatusLabel(session.status)}</span><time>{session.started_at ? new Date(session.started_at).toLocaleString('vi-VN') : '—'}</time></div></article>)}</div>{!history.length && !historyError && <p className="history-empty">Chưa có phiên đóng gói nào.</p>}<div className="history-footer"><button className="history-full-button" onClick={() => onOpenPacking({tableId:selected.id,tableType:selected.table_type})}>Xem đầy đủ</button></div></div><div className="station-actions live-station-actions" aria-label="Thao tác bàn đang chọn">
        <button type="button" className="order-management-button" onClick={() => onOpenPacking({tableId:selected.id,tableType:selected.table_type})}>Đơn hàng</button>
        <button type="button" className="station-delete-button" onClick={() => { setDeleteError(''); setDeleteTarget({id:selected.id,name:selected.name || selected.code}) }}>Xóa bàn</button>
      </div></aside>}
    </div>
    {deleteTarget && <div className="warehouse-modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null) }}>
      <section className="warehouse-modal-card warehouse-delete-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="live-delete-title" aria-describedby="live-delete-description">
        <div className="warehouse-delete-body"><div><h2 id="live-delete-title">Xóa bàn đóng hàng?</h2><p id="live-delete-description">Bạn sắp xóa <strong>{deleteTarget.name}</strong>. Các cấu hình camera của bàn cũng sẽ bị xóa.</p></div></div>
        {deleteError && <div className="warehouse-form-error warehouse-delete-error" role="alert">{deleteError}</div>}
        <footer className="warehouse-modal-footer"><button type="button" className="warehouse-secondary-action" autoFocus onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy bỏ</button><button type="button" className="warehouse-danger-action" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? 'Đang xóa…' : 'Xóa bàn'}</button></footer>
      </section>
    </div>}
  </>
}
