import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Dropdown from './Dropdown'
import { loadWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, type WarehouseListItem } from './api'

type IconName = 'grid' | 'camera' | 'livestream' | 'warehouse' | 'desks' | 'orders' | 'users' | 'chart' | 'settings' | 'bell' | 'search' | 'calendar' | 'chevron' | 'more' | 'play' | 'pause' | 'download' | 'back' | 'forward' | 'close' | 'menu' | 'trash' | 'expand' | 'volume' | 'sliders' | 'plus' | 'filter' | 'refresh' | 'sort' | 'check' | 'alert'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    grid: 'M4.75 4.75h5.5v5.5h-5.5zM13.75 4.75h5.5v5.5h-5.5zM4.75 13.75h5.5v5.5h-5.5zM13.75 13.75h5.5v5.5h-5.5z',
    camera: 'M5.5 6h8.5a2 2 0 0 1 2 2v1l4-2v10l-4-2v1a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6Z',
    livestream: 'M5.5 6h8.5a2 2 0 0 1 2 2v1l4-2v10l-4-2v1a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6Z',
    warehouse: 'm3.5 9 8.5-5 8.5 5v10.5h-17V9Zm3.5 10.5v-6h9v6M7 10.5h10m-7 4.5h.01m3.99 0h.01',
    desks: 'M4 5.5h16v4H4zM4 12.25h16v4H4zM7 7.5h.01M7 14.25h.01M6 19h12',
    orders: 'M7 3.75h10A2.25 2.25 0 0 1 19.25 6v14.25H4.75V6A2.25 2.25 0 0 1 7 3.75Zm2.25 5h5.5m-5.5 4h5.5m-5.5 4h3.5',
    users: 'M16 20v-1.5a4.5 4.5 0 0 0-9 0V20m4.5-8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm5-6a3 3 0 0 1 2.5 4.65M19 19v-1a4 4 0 0 0-1-2.65',
    chart: 'M5 4.5v15h15M9 16v-4m4 4V8m4 8v-6',
    settings: 'M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm0-5.5 1.1.2.85 2.35c.46.17.9.42 1.3.73l2.45-.55 1.55 1.55-.55 2.45c.31.4.56.84.73 1.3l2.35.85v2.2l-2.35.85c-.17.46-.42.9-.73 1.3l.55 2.45-1.55 1.55-2.45-.55c-.4.31-.84.56-1.3.73L12 22l-1.1-2.35a6.7 6.7 0 0 1-1.3-.73l-2.45.55L5.6 17.92l.55-2.45a6.7 6.7 0 0 1-.73-1.3l-2.35-.85v-2.2l2.35-.85c.17-.46.42-.9.73-1.3L5.6 6.52l1.55-1.55 2.45.55c.4-.31.84-.56 1.3-.73L12 2.75Z',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 13h4',
    search: 'm20 20-4.6-4.6m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
    calendar: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm3-2v4m8-4v4M3 10h18',
    chevron: 'm7 9 5 5 5-5',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    play: 'm8 5 10 7-10 7V5Z',
    pause: 'M8 5v14m8-14v14',
    download: 'M12 3v12m0 0 4-4m-4 4-4-4M5 21h14',
    back: 'm15 18-6-6 6-6',
    forward: 'm9 18 6-6-6-6',
    close: 'm6 6 12 12M18 6 6 18',
    menu: 'M4 6h16M4 12h16M4 18h16',
    trash: 'M5 7h14m-9 4v6m4-6v6M9 7V4h6v3m3 0-1 14H7L6 7',
    expand: 'M8 3H3v5m13-5h5v5M8 21H3v-5m18 0v5h-5',
    volume: 'M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12',
    sliders: 'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h9m4 0h3M15 4v4m-8 2v4m8 4v4',
    plus: 'M12 5v14M5 12h14',
    filter: 'M4 5h16l-6.5 7.3V18l-3 1v-6.7L4 5Z',
    refresh: 'M20 11a8 8 0 0 0-14.9-3M4 5v4h4m-4 2a8 8 0 0 0 14.9 3M20 19v-4h-4',
    sort: 'm8 8 4-4 4 4M16 16l-4 4-4-4',
    check: 'm5 12 4 4L19 8',
    alert: 'M12 3 2.5 20h19L12 3Zm0 6v5m0 3h.01',
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}

type WarehouseToast = { id: number; kind: 'success' | 'error'; message: string }

export default function WarehouseManagementPage({ onOpenDesks, onOpenPacking }: { onOpenDesks: (warehouse: WarehouseListItem) => void; onOpenPacking: () => void }) {
  const emptyForm = { code: '', name: '', province: '', address: '', enabled: true }
  const [rows, setRows] = useState<WarehouseListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [province, setProvince] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [toast, setToast] = useState<WarehouseToast | null>(null)
  const [toastPaused, setToastPaused] = useState(false)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const toastStartedAtRef = useRef(0)
  const toastRemainingRef = useRef(2000)
  const toastIdRef = useRef(0)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseListItem | null>(null)
  const [openWarehouseInEdit, setOpenWarehouseInEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WarehouseListItem | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const dismissToast = () => {
    if (toastTimerRef.current !== undefined) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = undefined
    setToast(null)
    setToastPaused(false)
  }
  const showToast = (kind: WarehouseToast['kind'], message: string) => {
    if (toastTimerRef.current !== undefined) window.clearTimeout(toastTimerRef.current)
    toastRemainingRef.current = 2000
    toastStartedAtRef.current = Date.now()
    setToastPaused(false)
    setToast({ id: ++toastIdRef.current, kind, message })
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = undefined
      setToast(null)
    }, toastRemainingRef.current)
  }
  const pauseToast = () => {
    if (!toast || toastTimerRef.current === undefined) return
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = undefined
    toastRemainingRef.current = Math.max(0, toastRemainingRef.current - (Date.now() - toastStartedAtRef.current))
    setToastPaused(true)
  }
  const resumeToast = () => {
    if (!toast || toastTimerRef.current !== undefined || toastRemainingRef.current <= 0) return
    toastStartedAtRef.current = Date.now()
    setToastPaused(false)
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = undefined
      setToast(null)
    }, toastRemainingRef.current)
  }
  useEffect(() => () => {
    if (toastTimerRef.current !== undefined) window.clearTimeout(toastTimerRef.current)
  }, [])
  const warehouseRequestRef = useRef(0)
  const refresh = async (signal?: AbortSignal) => {
    const requestId = ++warehouseRequestRef.current
    setLoading(true); setError('')
    try {
      const response = await loadWarehouses({ limit: pageSize, offset: (page - 1) * pageSize, q: query, province, status }, signal)
      if (signal?.aborted || requestId !== warehouseRequestRef.current) return
      setRows(response.items); setTotal(response.total)
      if (!response.items.length && page > 1) setPage(Math.max(1, Math.ceil(response.total / pageSize)))
    } catch (loadError) {
      if (!signal?.aborted && requestId === warehouseRequestRef.current) setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách kho hàng')
    } finally {
      if (!signal?.aborted && requestId === warehouseRequestRef.current) setLoading(false)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { void refresh(controller.signal) }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [page, pageSize, query, province, status])

  useEffect(() => {
    if (!createOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !createSubmitting) setCreateOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [createOpen, createSubmitting])

  useEffect(() => {
    if (!openActionId) return
    const closeActionMenu = () => setOpenActionId(null)
    document.addEventListener('mousedown', closeActionMenu)
    return () => document.removeEventListener('mousedown', closeActionMenu)
  }, [openActionId])

  useEffect(() => {
    if (!deleteTarget) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteSubmitting) setDeleteTarget(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [deleteSubmitting, deleteTarget])

  const provinces = useMemo(() => Array.from(new Set(rows.map((row) => row.province).filter((item): item is string => Boolean(item)))).sort(), [rows])
  const visibleRows = rows
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const totalLabel = total
  const firstItem = rows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = (page - 1) * pageSize + rows.length
  const requestDelete = (row: WarehouseListItem) => {
    setDeleteTarget(row)
    setOpenActionId(null)
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    try {
      await deleteWarehouse(deleteTarget.id)
      setDeleteTarget(null)
      setPage(1)
      showToast('success', `Đã xóa kho “${deleteTarget.name}”.`)
      await refresh()
    } catch (submitError) {
      showToast('error', submitError instanceof Error ? submitError.message : 'Không thể xóa kho hàng. Vui lòng thử lại.')
    } finally {
      setDeleteSubmitting(false)
    }
  }
  const openCreateModal = () => {
    setCreateForm(emptyForm)
    setCreateErrors({})
    setCreateOpen(true)
  }
  const closeCreateModal = () => {
    if (!createSubmitting) setCreateOpen(false)
  }
  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = createForm.code.trim().toUpperCase()
    const name = createForm.name.trim()
    const provinceValue = createForm.province.trim()
    const address = createForm.address.trim()
    const errors: Record<string, string> = {}
    if (!code) errors.code = 'Vui lòng nhập mã kho.'
    else if (!/^[A-Z0-9_-]{1,100}$/.test(code)) errors.code = 'Mã kho chỉ gồm chữ cái, số, gạch ngang hoặc gạch dưới.'
    if (!name) errors.name = 'Vui lòng nhập tên kho.'
    if (provinceValue.length > 255) errors.province = 'Tỉnh/thành phố không vượt quá 255 ký tự.'
    if (address.length > 500) errors.address = 'Địa chỉ không vượt quá 500 ký tự.'
    setCreateErrors(errors)
    if (Object.keys(errors).length > 0) return

    setCreateSubmitting(true)
    try {
      await createWarehouse({ code, name, province: provinceValue || undefined, address: address || undefined, enabled: createForm.enabled })
      setCreateOpen(false)
      setCreateForm(emptyForm)
      setPage(1)
      showToast('success', `Đã thêm kho “${name}”.`)
      await refresh()
    } catch (submitError) {
      showToast('error', submitError instanceof Error ? submitError.message : 'Không thể thêm kho hàng. Vui lòng thử lại.')
    } finally {
      setCreateSubmitting(false)
    }
  }
  const formatUpdatedAt = (value: string) => {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
  }

  return <section className="warehouse-management" aria-labelledby="warehouse-page-title">
    <div className="warehouse-heading">
      <div className="warehouse-title-group">
        <div><h1 id="warehouse-page-title">Quản lý kho hàng</h1></div>
      </div>
      <button type="button" className="warehouse-primary-action" onClick={openCreateModal}><Icon name="plus" size={18} />Thêm kho hàng</button>
    </div>

    {toast && <div key={toast.id} className={`warehouse-toast warehouse-toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live="polite" onMouseEnter={pauseToast} onMouseLeave={resumeToast}><div className="warehouse-toast-content"><span className="warehouse-toast-icon" aria-hidden="true"><Icon name={toast.kind === 'success' ? 'check' : 'alert'} size={17} /></span><span>{toast.message}</span><button type="button" onClick={dismissToast} aria-label="Đóng thông báo"><Icon name="close" size={17} /></button></div><span className={`warehouse-toast-progress${toastPaused ? ' is-paused' : ''}`} aria-hidden="true" /></div>}

    <div className="warehouse-filters" aria-label="Bộ lọc kho hàng">
      <label className="warehouse-search"><Icon name="search" size={19} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Tìm kiếm theo mã kho, tên kho, địa chỉ..." aria-label="Tìm kiếm kho hàng" /></label>
      <label className="warehouse-select"><span>Tỉnh/Thành phố</span><Dropdown className="ui-dropdown--inline" value={province} onChange={(value) => { setProvince(value); setPage(1) }} ariaLabel="Lọc theo tỉnh thành" options={[{ value: '', label: 'Tất cả tỉnh/thành' }, ...provinces.map((item) => ({ value: item, label: item }))]} /></label>
      <label className="warehouse-select"><span>Trạng thái</span><Dropdown className="ui-dropdown--inline" value={status} onChange={(value) => { setStatus(value); setPage(1) }} ariaLabel="Lọc theo trạng thái" options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'active', label: 'Đang hoạt động' }, { value: 'warning', label: 'Cảnh báo' }, { value: 'paused', label: 'Tạm ngưng' }]} /></label>
    </div>

    <div className="warehouse-table-wrap">
      <table className="warehouse-table">
        <thead><tr><th>STT</th><th>Tên kho</th><th>Địa chỉ</th><th>Số camera</th><th>Trạng thái</th><th><button type="button" className="warehouse-sort-button">Cập nhật cuối <Icon name="sort" size={16} /></button></th><th>Thao tác</th></tr></thead>
        <tbody>{loading && <tr><td colSpan={7} className="warehouse-empty">Đang tải danh sách kho hàng...</td></tr>}{!loading && error && <tr><td colSpan={7} className="warehouse-empty"><span>{error}</span><button type="button" className="warehouse-retry-button" onClick={() => void refresh()}>Thử lại</button></td></tr>}{!loading && !error && visibleRows.map((row, index) => <tr key={row.id}>
          <td>{(page - 1) * pageSize + index + 1}</td>
          <td><div className="warehouse-name-cell"><strong>{row.name}</strong></div></td>
          <td>{row.address || '—'}</td><td>{row.camera_enabled} / {row.camera_total}</td>
          <td><span className={`warehouse-status ${row.status.toLowerCase()}`}><i />{row.status === 'ACTIVE' ? 'Đang hoạt động' : row.status === 'WARNING' ? 'Cảnh báo' : 'Tạm ngưng'}</span></td>
          <td>{formatUpdatedAt(row.updated_at)}</td><td className="warehouse-actions-cell"><button type="button" className="warehouse-row-action" aria-label={`Thao tác với ${row.name}`} aria-haspopup="menu" aria-expanded={openActionId === row.id} onMouseDown={(event) => event.stopPropagation()} onClick={() => setOpenActionId((current) => current === row.id ? null : row.id)}><Icon name="more" size={18} /></button>{openActionId === row.id && <div className={`warehouse-action-menu ${index >= visibleRows.length - 2 ? 'up' : ''}`} role="menu" onMouseDown={(event) => event.stopPropagation()}><button type="button" role="menuitem" onClick={() => { setOpenWarehouseInEdit(false); setSelectedWarehouse(row); setOpenActionId(null) }}><span className="warehouse-menu-icon"><Icon name="search" size={16} /></span>Xem thông tin</button><button type="button" role="menuitem" onClick={() => { setOpenWarehouseInEdit(true); setSelectedWarehouse(row); setOpenActionId(null) }}><span className="warehouse-menu-icon"><Icon name="sliders" size={16} /></span>Sửa thông tin</button><button type="button" role="menuitem" className="danger" onClick={() => requestDelete(row)}><span className="warehouse-menu-icon"><Icon name="trash" size={16} /></span>Xóa kho hàng</button></div>}</td>
        </tr>)}{!loading && !error && visibleRows.length === 0 && <tr><td colSpan={7} className="warehouse-empty">Không tìm thấy kho hàng phù hợp.</td></tr>}</tbody>
      </table>
    </div>

    <div className="warehouse-pagination"><div className="warehouse-page-controls"><div className="warehouse-page-stepper"><button type="button" aria-label="Trang trước" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><Icon name="back" size={18} /></button><span aria-live="polite">{page} / {pageCount}</span><button type="button" aria-label="Trang sau" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><Icon name="forward" size={18} /></button></div></div></div>
    {selectedWarehouse && (openWarehouseInEdit ? <WarehouseEditModal warehouse={selectedWarehouse} onClose={() => { setSelectedWarehouse(null); setOpenWarehouseInEdit(false) }} onSaved={(updated) => { void refresh(); setSelectedWarehouse(null); setOpenWarehouseInEdit(false); showToast('success', `Đã cập nhật kho “${updated.name}”.`) }} onError={(message) => showToast('error', message)} /> : <WarehouseDetailsModal warehouse={selectedWarehouse} onClose={() => { setSelectedWarehouse(null); setOpenWarehouseInEdit(false) }} onOpenDesks={() => onOpenDesks(selectedWarehouse)} onOpenPacking={onOpenPacking} />)}
    {deleteTarget && <WarehouseDeleteModal warehouse={deleteTarget} submitting={deleteSubmitting} onClose={() => { if (!deleteSubmitting) setDeleteTarget(null) }} onConfirm={() => void confirmDelete()} />}
    {createOpen && <div className="warehouse-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateModal() }}>
      <section className="warehouse-modal-card warehouse-create-modal-card" role="dialog" aria-modal="true" aria-labelledby="warehouse-create-title">
        <header className="warehouse-modal-header warehouse-create-header"><h2 id="warehouse-create-title">Thêm kho hàng</h2><button type="button" className="warehouse-modal-close" onClick={closeCreateModal} disabled={createSubmitting} aria-label="Đóng cửa sổ"><Icon name="close" size={20} /></button></header>
        <form onSubmit={submitCreate} noValidate>
          <div className="warehouse-modal-body">
            <div className="warehouse-form-grid">
              <label className="warehouse-field"><span>Mã kho <b>*</b></span><input value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} maxLength={100} autoFocus aria-invalid={Boolean(createErrors.code)} />{createErrors.code && <small>{createErrors.code}</small>}</label>
              <label className="warehouse-field"><span>Tên kho <b>*</b></span><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} maxLength={255} aria-invalid={Boolean(createErrors.name)} />{createErrors.name && <small>{createErrors.name}</small>}</label>
              <label className="warehouse-field"><span>Tỉnh/Thành phố</span><input value={createForm.province} onChange={(event) => setCreateForm((current) => ({ ...current, province: event.target.value }))} maxLength={255} aria-invalid={Boolean(createErrors.province)} />{createErrors.province && <small>{createErrors.province}</small>}</label>
              <label className="warehouse-field warehouse-field-wide"><span>Địa chỉ</span><textarea value={createForm.address} onChange={(event) => setCreateForm((current) => ({ ...current, address: event.target.value }))} maxLength={500} rows={3} aria-invalid={Boolean(createErrors.address)} />{createErrors.address && <small>{createErrors.address}</small>}<em>{createForm.address.length}/500</em></label>
            </div>
            <label className="warehouse-active-toggle"><input type="checkbox" checked={createForm.enabled} onChange={(event) => setCreateForm((current) => ({ ...current, enabled: event.target.checked }))} /><span className="warehouse-toggle-track" aria-hidden="true"><i /></span><span><strong>Kích hoạt kho ngay</strong></span></label>
          </div>
          <footer className="warehouse-modal-footer"><button type="button" className="warehouse-secondary-action" onClick={closeCreateModal} disabled={createSubmitting}>Hủy bỏ</button><button type="submit" className="warehouse-primary-action" disabled={createSubmitting}>{createSubmitting ? <><span className="warehouse-spinner" aria-hidden="true" />Đang tạo kho...</> : <><Icon name="plus" size={18} />Tạo kho hàng</>}</button></footer>
        </form>
      </section>
    </div>}
  </section>
}

function WarehouseDeleteModal({ warehouse, submitting, onClose, onConfirm }: { warehouse: WarehouseListItem; submitting: boolean; onClose: () => void; onConfirm: () => void }) {
  return <div className="warehouse-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="warehouse-modal-card warehouse-delete-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="warehouse-delete-title" aria-describedby="warehouse-delete-description">
      <div className="warehouse-delete-body"><div className="warehouse-delete-icon"><Icon name="trash" size={24} /></div><div><span className="warehouse-modal-kicker">XÁC NHẬN XÓA KHO</span><h2 id="warehouse-delete-title">Xóa kho hàng?</h2><p id="warehouse-delete-description">Bạn sắp xóa <strong>{warehouse.name}</strong>. Các kho phía sau sẽ tự động được cập nhật lại thứ tự hiển thị.</p></div></div>
      <footer className="warehouse-modal-footer"><button type="button" className="warehouse-secondary-action" onClick={onClose} disabled={submitting}>Hủy bỏ</button><button type="button" className="warehouse-danger-action" onClick={onConfirm} disabled={submitting}>{submitting ? <><span className="warehouse-spinner warehouse-spinner-danger" aria-hidden="true" />Đang xóa...</> : <><Icon name="trash" size={19} />Xóa kho hàng</>}</button></footer>
    </section>
  </div>
}

function WarehouseDetailsModal({ warehouse, onClose, onOpenDesks, onOpenPacking }: { warehouse: WarehouseListItem; onClose: () => void; onOpenDesks: () => void; onOpenPacking: () => void }) {
  void onOpenPacking
  const formatDate = (value: string) => {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
  }

  return <div className="warehouse-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="warehouse-modal-card warehouse-detail-modal-card" role="dialog" aria-modal="true" aria-labelledby="warehouse-detail-title" aria-describedby="warehouse-detail-description">
      <header className="warehouse-modal-header warehouse-detail-header"><div><h2 id="warehouse-detail-title">{warehouse.name}</h2></div><div className="warehouse-detail-header-actions"><button type="button" className="warehouse-modal-close" onClick={onClose} aria-label="Đóng thông tin kho hàng"><Icon name="close" size={20} /></button></div></header>
      <div className="warehouse-detail-body">
        <div className="warehouse-detail-summary"><div><span className="warehouse-detail-label">Mã kho</span><strong>{warehouse.code}</strong></div><div><span className="warehouse-detail-label">Số camera</span><strong>{warehouse.camera_enabled} / {warehouse.camera_total}<small> đang hoạt động</small></strong></div><div><span className="warehouse-detail-label">Phiên bản cấu hình</span><strong>v{warehouse.version}</strong></div></div>
        <section className="warehouse-detail-section" aria-labelledby="warehouse-detail-basic-title"><h3 id="warehouse-detail-basic-title">Thông tin cơ bản</h3><div className="warehouse-detail-grid"><div><span>Tỉnh/Thành phố</span><strong>{warehouse.province || 'Chưa cập nhật'}</strong></div><div><span>Địa chỉ</span><strong>{warehouse.address || 'Chưa cập nhật'}</strong></div><div><span>Ngày tạo</span><strong>{formatDate(warehouse.created_at)}</strong></div><div><span>Cập nhật cuối</span><strong>{formatDate(warehouse.updated_at)}</strong></div></div></section>
        <section className="warehouse-detail-section" aria-labelledby="warehouse-detail-management-title"><h3 id="warehouse-detail-management-title">Quản lý vận hành</h3><div className="warehouse-detail-management-grid"><button type="button" className="warehouse-detail-management-button" onClick={onOpenDesks}><span className="warehouse-detail-management-icon"><Icon name="orders" size={20} /></span><span><strong>Danh sách bàn đóng hàng</strong><small>Xem danh sách bàn và hoạt động đóng hàng</small></span><Icon name="forward" size={18} /></button></div></section>
      </div>
    </section>
  </div>
}

function WarehouseEditModal({ warehouse, onClose, onSaved, onError }: { warehouse: WarehouseListItem; onClose: () => void; onSaved: (updated: import('./api').WarehouseRecord) => void; onError: (message: string) => void }) {
  const editing = true
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ name: warehouse.name, province: warehouse.province ?? '', address: warehouse.address ?? '', enabled: warehouse.enabled })

  useEffect(() => {
    setForm({ name: warehouse.name, province: warehouse.province ?? '', address: warehouse.address ?? '', enabled: warehouse.enabled })
  }, [warehouse.id, warehouse.version])

  const formatDate = (value: string) => {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
  }
  const statusLabel = warehouse.status === 'ACTIVE' ? 'Đang hoạt động' : warehouse.status === 'WARNING' ? 'Cảnh báo' : 'Tạm ngưng'
  const saveChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = form.name.trim()
    const province = form.province.trim()
    const address = form.address.trim()
    const errors: Record<string, string> = {}
    if (!name) errors.name = 'Vui lòng nhập tên kho.'
    if (province.length > 255) errors.province = 'Tỉnh/thành phố không vượt quá 255 ký tự.'
    if (address.length > 500) errors.address = 'Địa chỉ không vượt quá 500 ký tự.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      const updated = await updateWarehouse(warehouse.id, { expected_version: warehouse.version, name, province, address, enabled: form.enabled })
      onSaved(updated)
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : 'Không thể lưu thay đổi. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="warehouse-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="warehouse-modal-card warehouse-detail-modal-card" role="dialog" aria-modal="true" aria-labelledby="warehouse-detail-title" aria-describedby={!editing ? "warehouse-detail-description" : undefined}>
      <header className="warehouse-modal-header warehouse-detail-header"><div>{!editing && <span className="warehouse-modal-kicker">THÔNG TIN KHO HÀNG</span>}<h2 id="warehouse-detail-title">{editing ? 'Chỉnh sửa thông tin' : warehouse.name}</h2>{!editing && <p id="warehouse-detail-description">Thông tin tổng quan và trạng thái vận hành của kho hàng.</p>}</div><div className="warehouse-detail-header-actions">{!editing && <span className={`warehouse-status ${warehouse.status.toLowerCase()}`}><i />{statusLabel}</span>}<button type="button" className="warehouse-modal-close" onClick={onClose} disabled={saving} aria-label="Đóng thông tin kho hàng"><Icon name="close" size={20} /></button></div></header>
      <form onSubmit={saveChanges}>
        <div className="warehouse-detail-body">
          <div className="warehouse-detail-summary"><div><span className="warehouse-detail-label">Mã kho</span><strong>{warehouse.code}</strong><small>Không thể chỉnh sửa</small></div><div><span className="warehouse-detail-label">Số camera</span><strong>{warehouse.camera_enabled} / {warehouse.camera_total}<small> đang hoạt động</small></strong></div><div><span className="warehouse-detail-label">Phiên bản cấu hình</span><strong>v{warehouse.version}</strong></div></div>
          <section className="warehouse-detail-section" aria-labelledby="warehouse-detail-basic-title"><h3 id="warehouse-detail-basic-title">Thông tin cơ bản</h3>{editing ? <div className="warehouse-edit-form"><label className="warehouse-field"><span>Tên kho <b>*</b></span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={255} autoFocus aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <small>{fieldErrors.name}</small>}</label><label className="warehouse-field"><span>Tỉnh/Thành phố</span><input value={form.province} onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))} maxLength={255} aria-invalid={Boolean(fieldErrors.province)} />{fieldErrors.province && <small>{fieldErrors.province}</small>}</label><label className="warehouse-field warehouse-field-wide"><span>Địa chỉ</span><textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} maxLength={500} rows={3} aria-invalid={Boolean(fieldErrors.address)} />{fieldErrors.address && <small>{fieldErrors.address}</small>}</label><label className="warehouse-active-toggle"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} /><span className="warehouse-toggle-track" aria-hidden="true"><i /></span><span><strong>Kích hoạt kho</strong><small>Cho phép kho tiếp tục hoạt động trong hệ thống.</small></span></label></div> : <div className="warehouse-detail-grid"><div><span>Tỉnh/Thành phố</span><strong>{warehouse.province || 'Chưa cập nhật'}</strong></div><div className="wide"><span>Địa chỉ</span><strong>{warehouse.address || 'Chưa cập nhật'}</strong></div><div><span>Ngày tạo</span><strong>{formatDate(warehouse.created_at)}</strong></div><div><span>Cập nhật cuối</span><strong>{formatDate(warehouse.updated_at)}</strong></div><div><span>Thứ tự hiển thị</span><strong>{warehouse.sort_order}</strong></div><div><span>Trạng thái cấu hình</span><strong>{warehouse.enabled ? 'Đang kích hoạt' : 'Đang tạm ngưng'}</strong></div></div>}</section>
        </div>
        <footer className="warehouse-modal-footer warehouse-detail-footer"><button type="submit" className="warehouse-primary-action" disabled={saving}>{saving ? <><span className="warehouse-spinner" aria-hidden="true" />Đang lưu...</> : 'Lưu thay đổi'}</button></footer>
      </form>
    </section>
  </div>
}

