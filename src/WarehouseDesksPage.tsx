import { useEffect, useMemo, useState } from 'react'
import { loadWarehouseDesks, type WarehouseDesks } from './api'
import { watchRefresh } from './liveRefresh'
import Dropdown from './Dropdown'

export default function WarehouseDesksPage({ warehouseId, onBack, onOpenPacking, onOpenPlayback }: { warehouseId: string; onBack: () => void; onOpenPacking: (context: { tableId: string; tableType: string }) => void; onOpenPlayback: (id: string) => void }) {
  const [data, setData] = useState<WarehouseDesks | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [revision, setRevision] = useState(0)
  useEffect(() => watchRefresh(async signal => {
    try { const next = await loadWarehouseDesks(warehouseId, signal); if (!signal.aborted) { setData(next); setError('') } }
    catch (error) { if (!signal.aborted) setError('Không thể tải danh sách bàn.'); throw error }
  }, { accepts: event => event.type !== 'node_heartbeat' }), [warehouseId, revision])
  const tables = useMemo(() => (data?.tables ?? []).filter(table =>
    (!query.trim() || `${table.code} ${table.name}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) &&
    (type === 'ALL' || table.table_type === type) && (status === 'ALL' || table.status === status)), [data, query, type, status])
  return <section className="warehouse-management" aria-labelledby="warehouse-desks-title">
    <header className="warehouse-heading"><div><button className="warehouse-secondary-action" onClick={onBack}>← Kho hàng</button><h1 id="warehouse-desks-title">{data?.name || 'Danh sách bàn'}</h1></div><button className="warehouse-primary-action" onClick={() => setRevision(value => value + 1)}>Cập nhật</button></header>
    <div className="warehouse-filters"><label className="warehouse-search"><input aria-label="Tìm bàn" placeholder="Tìm mã hoặc tên bàn…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <Dropdown ariaLabel="Loại bàn" value={type} onChange={setType} options={[{value:'ALL',label:'Tất cả loại bàn'},{value:'PACKING',label:'Đóng hàng'},{value:'RETURN_INSPECTION',label:'Hoàn hàng'}]} />
      <Dropdown ariaLabel="Trạng thái bàn" value={status} onChange={setStatus} options={[{value:'ALL',label:'Tất cả trạng thái'},{value:'ONLINE',label:'Trực tuyến'},{value:'OFFLINE',label:'Ngoại tuyến'}]} />
    </div>
    {error ? <div className="warehouse-empty" role="alert">{error}<button className="warehouse-retry-button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : !data ? <div className="warehouse-empty" role="status">Đang tải danh sách bàn…</div> : <div className="warehouse-table-wrap"><table className="warehouse-table"><thead><tr><th>Mã bàn</th><th>Tên bàn</th><th>Loại bàn</th><th>Trạng thái</th><th>Hoạt động</th><th>Đơn hiện tại</th><th>Thao tác</th></tr></thead><tbody>
      {tables.map(table => <tr key={table.id}><td>{table.code}</td><th scope="row">{table.name}</th><td>{table.table_type === 'RETURN_INSPECTION' ? 'Hoàn hàng' : 'Đóng hàng'}</td><td>{!table.enabled ? 'Tạm ngưng' : table.status === 'ONLINE' ? 'Trực tuyến' : 'Ngoại tuyến'}</td><td>{table.activity === 'BUSY' ? 'Đang xử lý' : table.activity === 'ARMED' ? 'Sẵn sàng' : 'Chờ'}</td><td>{table.current_session?.tracking_code || '—'}</td><td><button className="warehouse-secondary-action" onClick={() => onOpenPacking({tableId:table.id,tableType:table.table_type})}>Đơn hàng</button>{table.current_session && <button className="warehouse-secondary-action" onClick={() => onOpenPlayback(table.current_session!.id)}>Xem phiên</button>}</td></tr>)}
      {!tables.length && <tr><td colSpan={7} className="warehouse-empty">Không có bàn phù hợp.</td></tr>}
    </tbody></table></div>}
  </section>
}
