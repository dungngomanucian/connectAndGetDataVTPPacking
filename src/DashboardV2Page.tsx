import { watchRefresh } from './liveRefresh'
import { useEffect, useMemo, useState } from 'react'
import { loadDashboardStations, loadPackingSessions, loadPlayback, type DashboardTable, type PackingSession } from './api'
import { type Station } from './data'
import Dropdown from './Dropdown'
import DatePicker from './DatePicker'

const PAGE_SIZE = 6
type TypeFilter = 'ALL' | 'PACKING' | 'RETURN_INSPECTION'
type PackingNavigationContext = { tableId: string; tableType: string; fromDate: string; fromTime: string; toDate: string; toTime: string }

function todayDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timeLabel(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function localDateTime(value: string, time: string) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  const [hours, minutes, seconds] = time.split(':').map(Number)
  const result = new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0)
  return Number.isNaN(result.getTime()) ? null : result
}

function localDateTimeRange(startDate: string, startTime: string, endDate: string, endTime: string) {
  const from = localDateTime(startDate, startTime)
  const through = localDateTime(endDate, endTime)
  return {
    from,
    through,
    startedFrom: from?.toISOString(),
    startedBefore: through ? new Date(through.getTime() + 1000).toISOString() : undefined,
  }
}

function stationHeading(name: string | undefined, fallback: string) {
  const fullName = (name || fallback).trim()
  const match = fullName.match(/^(Bàn\s+(?:đóng|hoàn)\s+hàng)\s+(\d+)$/i)
  return match ? { title: match[1], number: match[2] } : { title: fullName, number: '' }
}

function sessionStatus(status: string) {
  const normalized = status.toUpperCase()
  if (['RETURNED', 'RETURN', 'REFUNDED', 'RETURNING'].includes(normalized)) return 'Hoàn hàng'
  if (['COMPLETED', 'UPLOADED', 'READY_LOCAL'].includes(normalized)) return 'Hoàn tất'
  if (['IN_PROGRESS', 'RUNNING'].includes(normalized)) return 'Đang xử lý'
  if (['FAILED', 'ERROR'].includes(normalized)) return 'Có cảnh báo'
  return 'Đang xử lý'
}

function sessionStatusTone(status: string) {
  const normalized = status.toUpperCase()
  if (['COMPLETED', 'UPLOADED', 'READY_LOCAL', 'RETURNED', 'RETURN', 'REFUNDED', 'RETURNING'].includes(normalized)) return 'is-completed'
  if (['IN_PROGRESS', 'RUNNING'].includes(normalized)) return 'is-progress'
  if (['FAILED', 'ERROR'].includes(normalized)) return 'is-failed'
  return 'is-pending'
}

export default function DashboardV2Page({ onOpenPlayback, onOpenPacking }: { onOpenPlayback: (id: string) => void; onOpenPacking: (context: PackingNavigationContext) => void }) {
  const [stations, setStations] = useState<Station[]>([])
  const [tables, setTables] = useState<DashboardTable[]>([])
  const [sessions, setSessions] = useState<PackingSession[]>([])
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({})
  const [queryDraft, setQueryDraft] = useState('')
  const [query, setQuery] = useState('')
  const [fromDateDraft, setFromDateDraft] = useState(todayDateKey)
  const [toDateDraft, setToDateDraft] = useState(todayDateKey)
  const [fromDate, setFromDate] = useState(todayDateKey)
  const [toDate, setToDate] = useState(todayDateKey)
  const [fromTimeDraft, setFromTimeDraft] = useState('00:00:00')
  const [toTimeDraft, setToTimeDraft] = useState('23:59:59')
  const [fromTime, setFromTime] = useState('00:00:00')
  const [toTime, setToTime] = useState('23:59:59')
  const [rangeError, setRangeError] = useState('')
  const [typeDraft, setTypeDraft] = useState<TypeFilter>('ALL')
  const [type, setType] = useState<TypeFilter>('ALL')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [retry, setRetry] = useState(0)
  const [orderListLayout, setOrderListLayout] = useState<Record<string, { overflowing: boolean; visibleCount: number }>>({})
  const appliedRange = useMemo(() => localDateTimeRange(fromDate, fromTime, toDate, toTime), [fromDate, fromTime, toDate, toTime])

  useEffect(() => {
    let disposed = false
    let busy = false
    const refresh = async (signal: AbortSignal) => {
      if (busy) return
      busy = true
      try {
        const [dashboard, sessionRows] = await Promise.all([
          loadDashboardStations(signal),
          loadPackingSessions({
            perTableLimit: 50,
            groupConsecutive: true,
            query,
            tableType: type === 'ALL' ? undefined : type,
            startedFrom: appliedRange.startedFrom,
            startedBefore: appliedRange.startedBefore,
          }, signal),
        ])
        if (disposed || signal.aborted) return
        setStations(dashboard.stations)
        setSessions(sessionRows)
        setTables(dashboard.tables)
        setUpdatedAt(new Date())
        setError('')
      } catch (cause) {
        if (!disposed && !signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu tổng quan.')
        throw cause
      } finally {
        busy = false
        if (!disposed && !signal.aborted) setLoading(false)
      }
    }
    const stop = watchRefresh(refresh)
    return () => { disposed = true; stop() }
  }, [appliedRange, query, retry, type])

  const dateSessions = useMemo(
    () => sessions.filter((session) => {
      if (!session.started_at) return false
      const timestamp = new Date(session.started_at).getTime()
      return Number.isFinite(timestamp) && (!appliedRange.from || timestamp >= appliedRange.from.getTime()) && (!appliedRange.through || timestamp <= appliedRange.through.getTime())
    }),
    [appliedRange, sessions],
  )
  const tableById = useMemo(() => new Map(tables.map((table) => [table.id, table])), [tables])
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi')
    return stations.filter((station) => {
      const table = tableById.get(String(station.id))
      const stationSessions = dateSessions.filter((item) => item.table_id === String(station.id))
      const matchesText = !needle || [station.name, station.code, station.order, ...stationSessions.map((item) => item.tracking_code)].join(' ').toLocaleLowerCase('vi').includes(needle)
      const matchesType = type === 'ALL' || table?.table_type === type

      return matchesText && matchesType
    }).map((station, originalIndex) => {
      const stationSessions = dateSessions.filter((item) => item.table_id === String(station.id))
      const latestSessionTime = stationSessions.reduce((latest, item) => Math.max(latest, item.started_at ? new Date(item.started_at).getTime() || 0 : 0), 0)
      const currentSessionTime = station.currentSession?.startedAt ? new Date(station.currentSession.startedAt).getTime() || 0 : 0
      return { station, originalIndex, hasOrders: stationSessions.length > 0 || station.order !== '—', latestOrder: Math.max(latestSessionTime, currentSessionTime) }
    }).sort((left, right) => {
      if (left.hasOrders !== right.hasOrders) return left.hasOrders ? -1 : 1
      if (left.latestOrder !== right.latestOrder) return right.latestOrder - left.latestOrder
      return left.originalIndex - right.originalIndex
    }).map(({ station }) => station)
  }, [dateSessions, query, stations, tableById, type])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const itemsByStation = useMemo(() => new Map(visible.map((station) => [
    String(station.id),
    dateSessions.filter((item) => item.table_id === String(station.id)),
  ])), [dateSessions, visible])
  const visibleSessions = useMemo(() => Array.from(itemsByStation.values()).flat(), [itemsByStation])

  useEffect(() => {
    const root = document.querySelector('.dashboard-v2')
    if (!root) return
    const updateOverflow = () => {
      const nextLayout: Record<string, { overflowing: boolean; visibleCount: number }> = {}
      root.querySelectorAll<HTMLElement>('.dashboard-v2-order-list').forEach((list) => {
        const stationId = list.closest<HTMLElement>('.dashboard-v2-table')?.dataset.stationId
        if (!stationId) return
        const overflowing = list.scrollHeight > list.clientHeight + 1
        const listBottom = list.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(list).paddingBottom || '0')
        const items = Array.from(list.children) as HTMLElement[]
        let visibleCount = items.length
        if (overflowing) {
          visibleCount = 0
          while (visibleCount < items.length && items[visibleCount].getBoundingClientRect().bottom <= listBottom + 1) visibleCount += 1
        }
        nextLayout[stationId] = { overflowing, visibleCount }
      })
      setOrderListLayout((current) => JSON.stringify(current) === JSON.stringify(nextLayout) ? current : nextLayout)
    }
    updateOverflow()
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(root)
    root.querySelectorAll('.dashboard-v2-table, .dashboard-v2-order-list').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [visibleSessions, page])

  useEffect(() => {
    const missing = visibleSessions.filter((session) => !(session.id in thumbnails))
    if (!missing.length) return
    let disposed = false
    void (async () => {
      const results: [string, string | null][] = []
      let nextIndex = 0
      await Promise.all(Array.from({ length: Math.min(6, missing.length) }, async () => {
        while (nextIndex < missing.length) {
          const session = missing[nextIndex++]
          try {
            const playback = await loadPlayback(session.id)
            results.push([session.id, playback.session.thumbnail_url ?? null])
          } catch {
            results.push([session.id, null])
          }
        }
      }))
      if (disposed) return
      setThumbnails((current) => {
        const next = { ...current }
        results.forEach(([sessionId, thumbnail]) => { next[sessionId] = thumbnail })
        return next
      })
    })()
    return () => { disposed = true }
  }, [thumbnails, visibleSessions])

  const apply = () => {
    const from = localDateTime(fromDateDraft, fromTimeDraft)
    const through = localDateTime(toDateDraft, toTimeDraft)
    if (from && through && from.getTime() > through.getTime()) {
      setRangeError('Thời điểm bắt đầu phải trước hoặc bằng thời điểm kết thúc.')
      return
    }
    setRangeError('')
    setQuery(queryDraft.trim())
    setFromDate(fromDateDraft)
    setFromTime(fromTimeDraft)
    setToDate(toDateDraft)
    setToTime(toTimeDraft)
    setType(typeDraft)
    setPage(0)
  }
  const movePage = (next: number) => setPage(Math.min(pageCount - 1, Math.max(0, next)))
  const openSession = (item: PackingSession) => {
    onOpenPlayback(item.id)
  }

  return <section className="dashboard-v2" aria-label="Tổng quan bàn đóng và hoàn hàng">
    <div className="dashboard-v2-filters">
      <form className="dashboard-v2-search" onSubmit={(event) => { event.preventDefault(); apply() }}><SearchIcon /><input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Tìm mã đơn hàng hoặc tên bàn" aria-label="Tìm kiếm bàn và mã đơn hàng" /><button type="submit">Tìm kiếm</button></form>
      <div className="dashboard-v2-filter dashboard-v2-range-filter"><div className="dashboard-v2-range-controls">
        <div className="dashboard-v2-range-endpoint"><DatePicker ariaLabel="Chọn thời điểm bắt đầu" value={fromDateDraft} onChange={(next) => { setFromDateDraft(next); if (next && toDateDraft && toDateDraft < next) setToDateDraft(next); setRangeError('') }} showTime timeValue={fromTimeDraft} onTimeChange={(next) => { setFromTimeDraft(next); setRangeError('') }} /></div>
        <svg className="dashboard-v2-range-separator" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
        <div className="dashboard-v2-range-endpoint"><DatePicker ariaLabel="Chọn thời điểm kết thúc" value={toDateDraft} onChange={(next) => { setToDateDraft(next); setRangeError('') }} showTime timeValue={toTimeDraft} onTimeChange={(next) => { setToTimeDraft(next); setRangeError('') }} minValue={fromDateDraft} /></div>
      </div></div>
      <label className="dashboard-v2-filter"><span>Loại bàn</span><Dropdown className="ui-dropdown--inline" ariaLabel="Loại bàn" value={typeDraft} onChange={(value) => setTypeDraft(value as TypeFilter)} options={[{ value: 'ALL', label: 'Tất cả loại bàn' }, { value: 'PACKING', label: 'Đóng hàng' }, { value: 'RETURN_INSPECTION', label: 'Hoàn hàng' }]} /></label>
      <button className="dashboard-v2-apply" type="button" onClick={apply}>Áp dụng</button>
      <div className="dashboard-v2-pager"><button type="button" onClick={() => movePage(page - 1)} aria-label="Trang trước"><Chevron direction="left" /></button><span>{page + 1} / {pageCount}</span><button type="button" onClick={() => movePage(page + 1)} aria-label="Trang sau"><Chevron direction="right" /></button></div>
      <span className="dashboard-v2-updated">{updatedAt ? `Cập nhật ${updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Đang kết nối dữ liệu'}</span>
    </div>
    {rangeError && <div className="dashboard-v2-range-error" role="alert">{rangeError}</div>}
    {error && <div className="dashboard-v2-error" role="alert">Không thể tải dữ liệu tổng quan. {error}<button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1) }}>Thử lại</button></div>}
    {loading ? <div className="dashboard-v2-message" role="status">Đang tải trạng thái bàn…</div> : !visible.length ? <div className="dashboard-v2-message"><strong>Không tìm thấy bàn phù hợp</strong><span>Thay đổi ngày, loại bàn hoặc từ khóa tìm kiếm.</span></div> : <div className="dashboard-v2-grid">{visible.map((station) => {
      const items = itemsByStation.get(String(station.id)) ?? []
      const heading = stationHeading(station.name, station.code)
      const tableType = tableById.get(String(station.id))?.table_type
      return <article className={`dashboard-v2-table ${tableType === 'RETURN_INSPECTION' ? 'return-inspection' : 'packing'}`} key={station.id} data-station-id={station.id}>
        <header className="dashboard-v2-table-head">
          <div className="dashboard-v2-table-name"><div className="dashboard-v2-table-heading"><h2>{heading.title}{heading.number && <span className="dashboard-v2-table-number">{heading.number}</span>}</h2><span>Danh sách đơn hàng mới</span></div></div>
        </header>
        {items.length ? <><ol className={`dashboard-v2-order-list${orderListLayout[String(station.id)]?.overflowing ? ' has-overflow' : ''}`}>{items.map((item, index) => {
          const hideItem = Boolean(orderListLayout[String(station.id)]?.overflowing && index >= orderListLayout[String(station.id)]!.visibleCount)
          return <li key={item.id} aria-hidden={hideItem || undefined} style={hideItem ? { visibility: 'hidden' } : undefined}>
          <button type="button" className="dashboard-v2-order-card" tabIndex={hideItem ? -1 : undefined} onClick={() => openSession(item)} title={`Mở video phiên ${item.tracking_code || 'chưa nhận diện'}`}>
            <span className="dashboard-v2-order-thumb">
              <span className="dashboard-v2-order-thumb-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10a2 2 0 0 1 2 2v1l4-2v8l-4-2v1a2 2 0 0 1-2 2H4z" /></svg>{item.snapshot_available ? 'Đang chờ ảnh' : 'Chưa có ảnh'}</span>
              {thumbnails[item.id] && <img src={thumbnails[item.id] ?? undefined} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
            </span>
            <span className="dashboard-v2-order-details"><strong>{item.tracking_code || 'Chưa nhận diện'}</strong><time>{timeLabel(item.started_at)}</time><small className={sessionStatusTone(item.status)}>{sessionStatus(item.status)}</small></span>
          </button>
        </li>})}</ol></> : <div className="dashboard-v2-no-events">{station.order !== '—' ? <span><time>{timeLabel(station.currentSession?.startedAt)}</time><i />{station.order}</span> : 'Chưa có đơn hàng trong ngày này'}</div>}
        <button type="button" className="dashboard-v2-see-all" onClick={() => onOpenPacking({ tableId: String(station.id), tableType: tableById.get(String(station.id))?.table_type ?? type, fromDate, fromTime, toDate, toTime })}>Xem tất cả <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5" /></svg></button>
      </article>
    })}</div>}
    {!loading && filtered.length > PAGE_SIZE && <footer className="dashboard-v2-pagination"><span>Hiển thị {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} trong {filtered.length} bàn</span><div><button type="button" onClick={() => movePage(page - 1)} disabled={page === 0}>Trước</button><button type="button" onClick={() => movePage(page + 1)} disabled={page + 1 >= pageCount}>Tiếp</button></div></footer>}
  </section>
}

function Chevron({ direction }: { direction: 'left' | 'right' }) { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction === 'left' ? 'm14 5-7 7 7 7' : 'm10 5 7 7-7 7'} /></svg> }
function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg> }
