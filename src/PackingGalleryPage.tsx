import { watchRefresh } from './liveRefresh'
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSessionPage, loadPackingTableOptions, loadPlayback, type PackingSession, type PackingTableOption } from './api'
import Dropdown from './Dropdown'
import DatePicker from './DatePicker'

type FilterTab = 'all' | 'progress' | 'completed' | 'failed'
type SessionTypeFilter = 'ALL' | 'PACKING' | 'RETURN_INSPECTION'
const PACKING_SESSION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'RUNNING', 'UPLOADED', 'READY_LOCAL', 'FAILED', 'ERROR', 'RETURNED', 'RETURN', 'REFUNDED', 'RETURNING'] as const
const PACKING_PAGE_SIZE = 18

function formatDate(value?: string | null) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' }
function formatTime(value?: string | null) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—' }
function statusMeta(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'RETURNED' || normalized === 'RETURN' || normalized === 'REFUNDED' || normalized === 'RETURNING') return { label: 'Hoàn hàng', tone: 'returned' as const, tab: 'completed' as const }
  if (normalized === 'COMPLETED' || normalized === 'UPLOADED' || normalized === 'READY_LOCAL') return { label: 'Hoàn tất', tone: 'completed' as const, tab: 'completed' as const }
  if (normalized === 'IN_PROGRESS' || normalized === 'RUNNING') return { label: 'Đang đóng hàng', tone: 'progress' as const, tab: 'progress' as const }
  if (normalized === 'FAILED' || normalized === 'ERROR') return { label: 'Có cảnh báo', tone: 'failed' as const, tab: 'failed' as const }
  return { label: 'Đang xử lý', tone: 'pending' as const, tab: 'progress' as const }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateTime(date: string, time: string) {
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes, seconds] = time.split(':').map(Number)
  const result = new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0)
  return Number.isNaN(result.getTime()) ? null : result
}

function routeFilters() {
  const params = new URLSearchParams(window.location.search)
  const today = localDateKey()
  const dateValue = (value: string | null, fallback: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
  const timeValue = (value: string | null, fallback: string) => value && /^\d{2}:\d{2}:\d{2}$/.test(value) ? value : fallback
  const tableType = params.get('tableType')
  return {
    fromDate: dateValue(params.get('fromDate'), today),
    fromTime: timeValue(params.get('fromTime'), '00:00:00'),
    toDate: dateValue(params.get('toDate'), today),
    toTime: timeValue(params.get('toTime'), '23:59:59'),
    tableId: params.get('tableId') || 'ALL',
    tableType: tableType === 'PACKING' || tableType === 'RETURN_INSPECTION' ? tableType : 'ALL' as SessionTypeFilter,
  }
}

function statusOptionLabel(status: string) {
  const labels: Record<string, string> = { IN_PROGRESS: 'Đang xử lý', RUNNING: 'Đang chạy', COMPLETED: 'Hoàn tất', UPLOADED: 'Đã tải lên', READY_LOCAL: 'Sẵn sàng', FAILED: 'Thất bại', ERROR: 'Lỗi', RETURNED: 'Hoàn hàng', RETURN: 'Hoàn hàng' }
  return labels[status.toUpperCase()] ?? status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function sessionTypeLabel(tableType: string) {
  return tableType === 'RETURN_INSPECTION' ? 'Hoàn hàng' : 'Đóng hàng'
}

function tableLabel(session: PackingSession) {
  return session.table_name || session.table_code || 'Chưa xác định'
}

function sessionsEqual(current: PackingSession[], next: PackingSession[]) {
  if (current.length !== next.length) return false
  return current.every((session, index) => {
    const candidate = next[index]
    return session.id === candidate.id && session.tracking_code === candidate.tracking_code && session.status === candidate.status && session.table_type === candidate.table_type && session.table_id === candidate.table_id && session.table_code === candidate.table_code && session.table_name === candidate.table_name && session.started_at === candidate.started_at && session.ended_at === candidate.ended_at && session.camera_count === candidate.camera_count && session.video_available === candidate.video_available && session.snapshot_available === candidate.snapshot_available && session.consecutive_session_count === candidate.consecutive_session_count
  })
}

function Icon({ name }: { name: 'search' | 'calendar' | 'chevron' | 'filter' | 'grid' | 'list' | 'play' | 'refresh' | 'camera' }) {
  const paths = { search: 'm20 20-4.6-4.6m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z', calendar: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm3-2v4m8-4v4M3 10h18', chevron: 'm7 9 5 5 5-5', filter: 'M4 5h16l-6.5 7.3V18l-3 1v-6.7L4 5Z', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', list: 'M5 6h14M5 12h14M5 18h14', play: 'm9 6 9 6-9 6V6Z', refresh: 'M20 11a8 8 0 0 0-14.7-4L4 9m0-5v5h5M4 13a8 8 0 0 0 14.7 4L20 15m0 5v-5h-5', camera: 'M5.5 6h8.5a2 2 0 0 1 2 2v1l4-2v10l-4-2v1a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6Z' }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>
}

function SessionCard({ session, thumbnail, onOpen }: { session: PackingSession; thumbnail?: string | null; onOpen: (id: string) => void }) {
  const meta = statusMeta(session.status)
  return <article className="packing-video-card">
    <button type="button" className="packing-video-thumb" onClick={() => onOpen(session.id)} aria-label={`Xem lại ${session.tracking_code || 'phiên đóng hàng'}`}>
      {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span className="packing-video-thumb-empty"><Icon name="camera" /><span>{session.snapshot_available ? 'Đang chờ ảnh' : 'Chưa có snapshot'}</span></span>}<span className="packing-video-shade" /><span className="packing-play"><Icon name="play" /></span>
    </button>
    <div className="packing-video-body"><div className="packing-video-title"><strong>{session.tracking_code || 'Chưa nhận diện'}</strong><span className={`packing-pill ${meta.tone}`}>{meta.label}</span></div><div className="packing-video-meta"><span><Icon name="camera" />{tableLabel(session)}</span><span>{formatTime(session.started_at)}</span><span>{formatDate(session.started_at)}</span></div></div>
  </article>
}

export default function PackingGalleryPage({ onOpenPlayback }: { onOpenPlayback: (sessionId: string) => void }) {
  const [initialFilters] = useState(routeFilters)
  const [sessions, setSessions] = useState<PackingSession[]>([])
  const [packingTables, setPackingTables] = useState<PackingTableOption[]>([])
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({})
  const [query, setQuery] = useState('')
  const [selectedFromDate, setSelectedFromDate] = useState(initialFilters.fromDate)
  const [selectedFromTime, setSelectedFromTime] = useState(initialFilters.fromTime)
  const [selectedToDate, setSelectedToDate] = useState(initialFilters.toDate)
  const [selectedToTime, setSelectedToTime] = useState(initialFilters.toTime)
  const [sessionType, setSessionType] = useState<SessionTypeFilter>(initialFilters.tableType)
  const [selectedTable, setSelectedTable] = useState(initialFilters.tableId)
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [appliedFromDate, setAppliedFromDate] = useState(initialFilters.fromDate)
  const [appliedFromTime, setAppliedFromTime] = useState(initialFilters.fromTime)
  const [appliedToDate, setAppliedToDate] = useState(initialFilters.toDate)
  const [appliedToTime, setAppliedToTime] = useState(initialFilters.toTime)
  const [appliedSessionType, setAppliedSessionType] = useState<SessionTypeFilter>(initialFilters.tableType)
  const [appliedTable, setAppliedTable] = useState(initialFilters.tableId)
  const [appliedStatus, setAppliedStatus] = useState('ALL')
  const [rangeError, setRangeError] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const refreshingRef = useRef(false)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const refreshRef = useRef<() => void>(() => {})
  const refresh = (_initial = false, _indicator = false) => refreshRef.current()
  const [refreshVersion, setRefreshVersion] = useState(0)
  refreshRef.current = () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setRefreshVersion((value) => value + 1)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(0); setDebouncedQuery(query.trim()) }, 300)
    return () => window.clearTimeout(timer)
  }, [query])
  useEffect(() => {
    let disposed = false
    void loadPackingTableOptions().then((tables) => { if (!disposed) setPackingTables(tables) })
      .catch(() => { if (!disposed) setError('Không tải được danh sách bàn.') })
    return () => { disposed = true }
  }, [])
  useEffect(() => {
    let disposed = false
    const stop = watchRefresh(async (signal) => {
      refreshingRef.current = true
      try {
        const from = localDateTime(appliedFromDate, appliedFromTime)
        const through = localDateTime(appliedToDate, appliedToTime)
        const filters = { groupConsecutive: true, limit: PACKING_PAGE_SIZE, query: debouncedQuery,
          tableId: appliedTable === 'ALL' ? undefined : appliedTable,
          tableType: appliedSessionType === 'ALL' ? undefined : appliedSessionType,
          status: appliedStatus === 'ALL' ? undefined : appliedStatus, tab,
          startedFrom: from?.toISOString(),
          startedBefore: through ? new Date(through.getTime() + 1000).toISOString() : undefined }
        const result = await loadSessionPage({ ...filters, offset: page * PACKING_PAGE_SIZE }, signal)
        if (disposed || signal.aborted) return
        if (!result.items.length && page > 0) setPage(Math.max(0, Math.ceil(result.total / PACKING_PAGE_SIZE) - 1))
        setSessions((current) => sessionsEqual(current, result.items) ? current : result.items)
        setTotal(result.total); setError('')
      } catch (error) {
        if (!disposed && !signal.aborted) setError('Không thể tải danh sách đơn hàng. Vui lòng thử lại.')
        throw error
      } finally {
        if (!disposed) refreshingRef.current = false
        if (!disposed && !signal.aborted) setLoading(false)
      }
    }, { accepts: (event) => event.type !== 'node_heartbeat' })
    return () => { disposed = true; stop(); refreshingRef.current = false }
  }, [appliedFromDate, appliedFromTime, appliedToDate, appliedToTime, appliedTable, appliedSessionType,
      appliedStatus, tab, debouncedQuery, page, refreshVersion])
  useEffect(() => {
    let disposed = false; const missing = sessions.filter((session) => !(session.id in thumbnails)); if (!missing.length) return () => { disposed = true }
    void Promise.allSettled(missing.map(async (session) => { try { const playback = await loadPlayback(session.id); return [session.id, playback.session.thumbnail_url ?? null] as const } catch { return [session.id, null] as const } })).then((results) => { if (disposed) return; setThumbnails((current) => { const next = { ...current }; results.forEach((result) => { if (result.status === 'fulfilled') next[result.value[0]] = result.value[1] }); return next }) })
    return () => { disposed = true }
  }, [sessions, thumbnails])

  const pageCount = Math.max(1, Math.ceil(total / PACKING_PAGE_SIZE))
  const tableOptions = useMemo(() => packingTables.map((table) => ({ id: table.id, label: table.name || table.code })).sort((left, right) => left.label.localeCompare(right.label, 'vi')), [packingTables])
  const statusOptions = useMemo(() => Array.from(new Set([...PACKING_SESSION_STATUSES, ...sessions.map((session) => session.status).filter(Boolean)])).sort(), [sessions])
  const applyFilters = () => {
    const from = localDateTime(selectedFromDate, selectedFromTime)
    const through = localDateTime(selectedToDate, selectedToTime)
    if (from && through && from > through) {
      setRangeError('Thời điểm bắt đầu phải trước hoặc bằng thời điểm kết thúc.')
      return
    }
    setRangeError('')
    setPage(0)
    setAppliedFromDate(selectedFromDate)
    setAppliedFromTime(selectedFromTime)
    setAppliedToDate(selectedToDate)
    setAppliedToTime(selectedToTime)
    setAppliedSessionType(sessionType)
    setAppliedTable(selectedTable)
    setAppliedStatus(selectedStatus)
  }

  return <section className="packing-page-content packing-gallery-page" aria-label="Danh sách đơn hàng">
    <div className="packing-gallery-toolbar">
      <div className="packing-gallery-toolbar-top">
        <label className="packing-gallery-search"><Icon name="search" /><span className="packing-search-label">Tra cứu phiên đóng hàng</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã đơn hàng, mã vận đơn hoặc mã phiên..." /><button type="button" onClick={() => setQuery(query.trim())}>Tìm kiếm</button></label>
        <button type="button" className="packing-refresh-button" onClick={() => void refresh(false, true)}><Icon name="refresh" />Cập nhật</button>
      </div>
      <div className="packing-gallery-filter-row">
        <div className="packing-select packing-date-range" role="group" aria-label="Khoảng thời gian"><div className="dashboard-v2-range-controls">
          <div className="dashboard-v2-range-endpoint"><DatePicker ariaLabel="Chọn thời điểm bắt đầu" value={selectedFromDate} onChange={(next) => { setSelectedFromDate(next); if (next && selectedToDate && selectedToDate < next) setSelectedToDate(next); setRangeError('') }} showTime timeValue={selectedFromTime} onTimeChange={(next) => { setSelectedFromTime(next); setRangeError('') }} /></div>
          <svg className="dashboard-v2-range-separator" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5" /></svg>
          <div className="dashboard-v2-range-endpoint"><DatePicker ariaLabel="Chọn thời điểm kết thúc" value={selectedToDate} onChange={(next) => { setSelectedToDate(next); setRangeError('') }} showTime timeValue={selectedToTime} onTimeChange={(next) => { setSelectedToTime(next); setRangeError('') }} minValue={selectedFromDate} /></div>
        </div></div>
        <label className="packing-select"><span>Loại bàn</span><Dropdown className="ui-dropdown--inline" ariaLabel="Loại bàn" value={sessionType} onChange={(value) => setSessionType(value as SessionTypeFilter)} options={[{ value: 'ALL', label: 'Tất cả loại bàn' }, { value: 'PACKING', label: 'Đóng hàng' }, { value: 'RETURN_INSPECTION', label: 'Hoàn hàng' }]} /></label>
        <label className="packing-select"><span>Bàn</span><Dropdown className="ui-dropdown--inline" ariaLabel="Bàn" value={selectedTable} onChange={setSelectedTable} options={[{ value: 'ALL', label: 'Tất cả các bàn' }, ...tableOptions.map((table) => ({ value: table.id, label: table.label }))]} /></label>
        <label className="packing-select"><span>Trạng thái đơn hàng</span><Dropdown className="ui-dropdown--inline" ariaLabel="Trạng thái đơn hàng" value={selectedStatus} onChange={setSelectedStatus} options={[{ value: 'ALL', label: 'Tất cả trạng thái đơn hàng' }, ...statusOptions.map((status) => ({ value: status, label: statusOptionLabel(status) }))]} /></label>
        <button type="button" className="packing-filter-button" onClick={applyFilters}><Icon name="filter" />Áp dụng</button>
      </div>
      {rangeError && <div className="dashboard-v2-range-error" role="alert">{rangeError}</div>}
    </div>
    {loading && <div className="packing-gallery-feedback">Đang tải danh sách phiên đóng hàng…</div>}{!loading && error && <div className="packing-gallery-feedback is-error"><strong>{error}</strong><button type="button" onClick={() => void refresh(true)}>Thử lại</button></div>}{!loading && !error && !sessions.length && <div className="packing-gallery-feedback"><strong>{query ? 'Không tìm thấy phiên phù hợp' : 'Chưa có phiên đóng hàng'}</strong><span>Thử thay đổi bộ lọc hoặc tìm kiếm bằng mã khác.</span></div>}
    {!loading && !error && sessions.length > 0 && <section className="packing-session-group" aria-label="Danh sách video">
      <div className="packing-video-grid">{sessions.map((session) => <SessionCard key={session.id} session={session} thumbnail={thumbnails[session.id]} onOpen={onOpenPlayback} />)}</div>
      {pageCount > 1 && <div className="packing-gallery-pagination"><div className="packing-group-pagination"><button type="button" aria-label="Danh sách video: trang trước" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>‹</button><span>{page + 1} / {pageCount}</span><button type="button" aria-label="Danh sách video: trang sau" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>›</button></div></div>}
    </section>}
  </section>
}
