import WarehousePicker from './WarehousePicker'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import DatePicker from './DatePicker'
import Dropdown from './Dropdown'
import { downloadReportExcel, loadReportOptions, loadReportSummary, type ReportWarehouse, type ReportSummary } from './api'

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthStartKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function toIso(date: string, time: string, includeSelectedSecond = false) {
  if (!date) return undefined
  const value = new Date(`${date}T${time}`)
  if (includeSelectedSecond) value.setSeconds(value.getSeconds() + 1)
  return value.toISOString()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function previousDateKey(value: string) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type DailyTrendPoint = { date: string; orders: number; videos: number }

function buildDailyTrend(from: string, to: string, daily: DailyTrendPoint[]): DailyTrendPoint[] {
  if (daily.length === 0) return []
  const ordered = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const start = from || ordered[0].date
  const end = to || ordered[ordered.length - 1].date
  const firstDay = new Date(`${start}T00:00:00`)
  const lastDay = new Date(`${end}T00:00:00`)
  if (!Number.isFinite(firstDay.getTime()) || !Number.isFinite(lastDay.getTime()) || firstDay > lastDay) return ordered

  const byDate = new Map(ordered.map((point) => [point.date, point]))
  const points: DailyTrendPoint[] = []
  const day = new Date(firstDay)
  while (day <= lastDay) {
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    points.push(byDate.get(key) ?? { date: key, orders: 0, videos: 0 })
    day.setDate(day.getDate() + 1)
  }
  return points
}

function chartAxis(values: number[]) {
  const maximum = Math.max(0, ...values)
  const intervals = Math.max(1, Math.min(4, maximum || 1))
  const step = Math.max(1, Math.ceil(maximum / intervals))
  const top = step * intervals
  return { top, ticks: Array.from({ length: intervals + 1 }, (_, index) => index * step) }
}

function chartTickIndices(length: number) {
  return Array.from({ length }, (_, index) => index)
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function OrdersBarChart({ data }: { data: DailyTrendPoint[] }) {
  const width = Math.max(720, 64 + data.length * 48)
  const height = 260
  const plot = { left: 48, right: width - 16, top: 18, bottom: 214 }
  const plotWidth = plot.right - plot.left
  const plotHeight = plot.bottom - plot.top
  const axis = chartAxis(data.map((point) => point.orders))
  const slotWidth = plotWidth / Math.max(1, data.length)
  const barWidth = Math.min(20, slotWidth * 0.62)
  const ticks = chartTickIndices(data.length)
  return <div className="reports-chart-scroll" tabIndex={0} role="region" aria-label="Biểu đồ đơn hàng, cuộn ngang để xem các ngày"><svg className="reports-chart-svg" style={{ minWidth: width }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ cột số đơn hàng theo ngày">
    <title>Số đơn hàng theo ngày trong khoảng đã chọn</title>
    {axis.ticks.map((tick) => {
      const y = plot.bottom - (tick / axis.top) * plotHeight
      return <g key={tick}><line className="reports-chart-gridline" x1={plot.left} y1={y} x2={plot.right} y2={y} /><text className="reports-chart-axis-label" x={plot.left - 8} y={y + 4} textAnchor="end">{formatNumber(tick)}</text></g>
    })}
    <line className="reports-chart-baseline" x1={plot.left} y1={plot.bottom} x2={plot.right} y2={plot.bottom} />
    {data.map((point, index) => {
      const barHeight = point.orders / axis.top * plotHeight
      const x = plot.left + slotWidth * index + (slotWidth - barWidth) / 2
      const y = plot.bottom - barHeight
      return <rect className="reports-chart-bar" key={point.date} x={x} y={y} width={Math.max(1, barWidth)} height={Math.max(point.orders ? 1 : 0, barHeight)} rx="3"><title>{formatDate(point.date)} · {formatNumber(point.orders)} đơn</title></rect>
    })}
    {ticks.map((index) => {
      const x = plot.left + slotWidth * index + slotWidth / 2
      return <text className="reports-chart-axis-label" key={data[index].date} x={x} y={plot.bottom + 23} textAnchor="middle">{formatShortDate(data[index].date)}</text>
    })}
  </svg></div>
}

function VideosLineChart({ data }: { data: DailyTrendPoint[] }) {
  const width = Math.max(720, 64 + data.length * 48)
  const height = 260
  const plot = { left: 48, right: width - 16, top: 18, bottom: 214 }
  const plotWidth = plot.right - plot.left
  const plotHeight = plot.bottom - plot.top
  const axis = chartAxis(data.map((point) => point.videos))
  const slotWidth = plotWidth / Math.max(1, data.length)
  const ticks = chartTickIndices(data.length)
  const pointPosition = (value: number, index: number) => ({
    x: plot.left + slotWidth * index + slotWidth / 2,
    y: plot.bottom - value / axis.top * plotHeight,
  })
  const line = data.map((point, index) => {
    const position = pointPosition(point.videos, index)
    return `${index === 0 ? 'M' : 'L'} ${position.x} ${position.y}`
  }).join(' ')
  return <div className="reports-chart-scroll" tabIndex={0} role="region" aria-label="Biểu đồ video, cuộn ngang để xem các ngày"><svg className="reports-chart-svg" style={{ minWidth: width }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ đường số video theo ngày">
    <title>Số video theo ngày trong khoảng đã chọn</title>
    {axis.ticks.map((tick) => {
      const y = plot.bottom - (tick / axis.top) * plotHeight
      return <g key={tick}><line className="reports-chart-gridline" x1={plot.left} y1={y} x2={plot.right} y2={y} /><text className="reports-chart-axis-label" x={plot.left - 8} y={y + 4} textAnchor="end">{formatNumber(tick)}</text></g>
    })}
    <line className="reports-chart-baseline" x1={plot.left} y1={plot.bottom} x2={plot.right} y2={plot.bottom} />
    {data.length > 1 && <path className="reports-chart-line" d={line} />}
    {data.map((point, index) => {
      const position = pointPosition(point.videos, index)
      return <circle className="reports-chart-point" key={point.date} cx={position.x} cy={position.y} r="4"><title>{formatDate(point.date)} · {formatNumber(point.videos)} video</title></circle>
    })}
    {ticks.map((index) => {
      const x = plot.left + slotWidth * index + slotWidth / 2
      return <text className="reports-chart-axis-label" key={data[index].date} x={x} y={plot.bottom + 23} textAnchor="middle">{formatShortDate(data[index].date)}</text>
    })}
  </svg></div>
}

type Filters = { warehouseId: string; tableId: string; tableType: string; from: string; fromTime: string; to: string; toTime: string; query: string }
const REPORT_PAGE_SIZE = 10
const REPORT_REFRESH_INTERVAL_MS = 15_000

function ReportPagination({ label, page, pageCount, onPageChange }: { label: string; page: number; pageCount: number; onPageChange: (page: number) => void }) {
  if (pageCount <= 1) return null
  return <nav className="reports-pagination" aria-label={label}>
    <div className="reports-pagination-controls">
      <button type="button" aria-label="Trang trước" onClick={() => onPageChange(page - 1)} disabled={page <= 1}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6" /></svg></button>
      <span aria-live="polite">{formatNumber(page)} / {formatNumber(pageCount)}</span>
      <button type="button" aria-label="Trang sau" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 4 6 6-6 6" /></svg></button>
    </div>
  </nav>
}

const defaultFilters = (): Filters => ({ warehouseId: '', tableId: '', tableType: '', from: monthStartKey(), fromTime: '00:00:00', to: todayKey(), toTime: '23:59:59', query: '' })

export default function ReportsPage() {
  const [draft, setDraft] = useState<Filters>(defaultFilters)
  const [applied, setApplied] = useState<Filters>(defaultFilters)
  const [warehouses, setWarehouses] = useState<ReportWarehouse[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [reportError, setReportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [sort, setSort] = useState<'orders' | 'videos' | 'warehouse' | 'table' | 'type'>('orders')
  const [dailySort, setDailySort] = useState<'newest' | 'oldest' | 'orders' | 'videos'>('newest')
  const [dailyPage, setDailyPage] = useState(1)
  const [tablesPage, setTablesPage] = useState(1)

  useEffect(() => {
    let active = true
    loadReportOptions(draft.warehouseId || undefined).then((result) => { if (active) setWarehouses(result) }).catch((error: Error) => { if (active) setCatalogError(error.message) })
    return () => { active = false }
  }, [draft.warehouseId])

  useEffect(() => {
    let active = true
    let inFlight = false
    const filters = {
      warehouseId: applied.warehouseId || undefined,
      tableId: applied.tableId || undefined,
      tableType: applied.tableType || undefined,
      startedFrom: toIso(applied.from, applied.fromTime),
      startedBefore: toIso(applied.to, applied.toTime, true),
      query: applied.query,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    const refresh = async (background = false) => {
      if (!active || inFlight) return
      inFlight = true
      if (!background) {
        setLoading(true)
        setReportError('')
      }
      try {
        const result = await loadReportSummary(filters)
        if (active) {
          setSummary(result)
          setReportError('')
        }
      } catch (error) {
        if (active && !background) setReportError(error instanceof Error ? error.message : 'Không thể tải báo cáo.')
      } finally {
        inFlight = false
        if (active && !background) setLoading(false)
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true)
    }, REPORT_REFRESH_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [applied])

  const sortedTables = useMemo(() => [...(summary?.tables ?? [])].sort((a, b) => {
    if (sort === 'warehouse') return a.warehouse_name.localeCompare(b.warehouse_name, 'vi') || a.table_name.localeCompare(b.table_name, 'vi')
    if (sort === 'table') return a.table_name.localeCompare(b.table_name, 'vi')
    if (sort === 'type') return a.table_type.localeCompare(b.table_type) || a.table_name.localeCompare(b.table_name, 'vi')
    if (sort === 'videos') return b.videos - a.videos || b.orders - a.orders
    return b.orders - a.orders || b.videos - a.videos
  }), [summary, sort])
  const sortedDaily = useMemo(() => [...(summary?.daily ?? [])].sort((a, b) => dailySort === 'oldest' ? a.date.localeCompare(b.date) : dailySort === 'orders' ? b.orders - a.orders || b.date.localeCompare(a.date) : dailySort === 'videos' ? b.videos - a.videos || b.date.localeCompare(a.date) : b.date.localeCompare(a.date)), [summary, dailySort])
  const dailyOrdersByDate = useMemo(() => new Map((summary?.daily ?? []).map((day) => [day.date, day.orders])), [summary])
  const chartDaily = useMemo(() => buildDailyTrend(applied.from, applied.to, summary?.daily ?? []), [applied.from, applied.to, summary])
  const getDailyOrderChange = (date: string, orders: number) => {
    const previousDate = previousDateKey(date)
    if (applied.from && previousDate < applied.from) return null
    return orders - (dailyOrdersByDate.get(previousDate) ?? 0)
  }
  const dailyPageCount = Math.max(1, Math.ceil(sortedDaily.length / REPORT_PAGE_SIZE))
  const tablesPageCount = Math.max(1, Math.ceil(sortedTables.length / REPORT_PAGE_SIZE))
  const visibleDaily = sortedDaily.slice((dailyPage - 1) * REPORT_PAGE_SIZE, dailyPage * REPORT_PAGE_SIZE)
  const visibleTables = sortedTables.slice((tablesPage - 1) * REPORT_PAGE_SIZE, tablesPage * REPORT_PAGE_SIZE)
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === draft.warehouseId)
  const availableTableTypes = selectedWarehouse
    ? [...new Set(selectedWarehouse.tables.map((table) => table.table_type.toUpperCase()))]
    : ['PACKING', 'RETURN_INSPECTION']
  const tableOptions = (selectedWarehouse
    ? selectedWarehouse.tables
    : warehouses.flatMap((warehouse) => warehouse.tables))
    .filter((table) => !selectedWarehouse || !draft.tableType || table.table_type.toUpperCase() === draft.tableType)
  const setDraftValue = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setRangeError('')
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.from && draft.to && new Date(`${draft.from}T${draft.fromTime}`) > new Date(`${draft.to}T${draft.toTime}`)) {
      setRangeError('Thời điểm kết thúc cần bằng hoặc sau thời điểm bắt đầu.')
      return
    }
    setRangeError('')
    setDailyPage(1)
    setTablesPage(1)
    setApplied({ ...draft })
  }
  const exportExcel = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await downloadReportExcel({
        warehouseId: applied.warehouseId || undefined,
        tableId: applied.tableId || undefined,
        tableType: applied.tableType || undefined,
        startedFrom: toIso(applied.from, applied.fromTime),
        startedBefore: toIso(applied.to, applied.toTime, true),
        query: applied.query,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Không thể xuất Excel.')
    } finally {
      setExporting(false)
    }
  }
  const reset = () => { const filters = defaultFilters(); setRangeError(''); setDailyPage(1); setTablesPage(1); setDraft(filters); setApplied(filters) }

  return <section className="reports-page home-page-content" aria-labelledby="reports-title">
    <header className="reports-heading">
      <div><h1 id="reports-title">Báo cáo hoạt động</h1></div>
      <div className="reports-header-datetime dashboard-v2-filter dashboard-v2-range-filter" aria-label="Lọc khoảng thời gian">
        <div className="dashboard-v2-range-controls">
          <div className="dashboard-v2-range-endpoint"><DatePicker ariaLabel="Chọn thời điểm bắt đầu" value={draft.from} onChange={(value) => { setRangeError(''); setDraft((current) => ({ ...current, from: value, to: value && current.to && current.to < value ? value : current.to })) }} showTime timeValue={draft.fromTime} onTimeChange={(value) => setDraftValue('fromTime', value)} /></div>
          <svg className="dashboard-v2-range-separator" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
          <div className="dashboard-v2-range-endpoint"><DatePicker ariaLabel="Chọn thời điểm kết thúc" value={draft.to} onChange={(value) => setDraftValue('to', value)} showTime timeValue={draft.toTime} onTimeChange={(value) => setDraftValue('toTime', value)} minValue={draft.from} /></div>
        </div>
      </div>
    </header>

    <form className="reports-filters" onSubmit={submit}>
      <div className="reports-filter-grid">
        <div className="reports-filter"><WarehousePicker compact allowAll value={draft.warehouseId} onChange={(value) => setDraft((current) => ({ ...current, warehouseId: value, tableType: '', tableId: '' }))} /></div>
        <div className="reports-filter"><Dropdown ariaLabel="Lọc theo loại bàn" value={draft.tableType} onChange={(value) => setDraft((current) => ({ ...current, tableType: value, tableId: '' }))} options={[{ value: '', label: 'Tất cả loại bàn' }, ...availableTableTypes.map((type) => ({ value: type, label: type === 'PACKING' ? 'Đóng hàng' : 'Hoàn hàng' }))]} /></div>
        <div className="reports-filter"><Dropdown ariaLabel="Lọc theo bàn" value={draft.tableId} onChange={(value) => setDraftValue('tableId', value)} options={[{ value: '', label: draft.warehouseId ? 'Tất cả bàn trong kho' : 'Tất cả bàn' }, ...tableOptions.map((table) => ({ value: table.id, label: table.name }))]} /></div>
        <div className="reports-search"><input aria-label="Tìm kiếm" value={draft.query} onChange={(event) => setDraftValue('query', event.target.value)} placeholder="Mã đơn, mã hoặc tên bàn, kho hàng" /></div>
        <div className="reports-filter-actions"><button className="reports-apply" type="submit">Áp dụng bộ lọc</button><button className="reports-apply" type="button" onClick={() => void exportExcel()} disabled={exporting || loading || !!reportError} title="Xuất toàn bộ dữ liệu theo bộ lọc đã áp dụng">{exporting ? 'Đang xuất…' : 'Xuất Excel'}</button><button className="reports-reset" type="button" onClick={reset}>Đặt lại</button></div>
      </div>
      {exportError && <p className="reports-inline-error" role="alert">{exportError}</p>}
      {rangeError && <p className="reports-inline-error" role="alert">{rangeError}</p>}
      {catalogError && <p className="reports-inline-error" role="alert">Không tải được danh mục kho/bàn. {catalogError}</p>}
    </form>

    {reportError ? <div className="reports-state reports-error" role="alert"><strong>Chưa thể tải báo cáo</strong><span>{reportError}</span><button type="button" onClick={() => setApplied({ ...applied })}>Thử lại</button></div> : <>
      <div className="reports-data-grid">
        <section className="reports-panel reports-daily-panel">
          <header className="reports-panel-heading"><div><h2>Sản lượng theo ngày</h2></div><div className="reports-sort"><Dropdown ariaLabel="Sắp xếp sản lượng theo ngày" value={dailySort} onChange={(value) => { setDailySort(value as typeof dailySort); setDailyPage(1) }} options={[{ value: 'newest', label: 'Ngày mới nhất' }, { value: 'oldest', label: 'Ngày cũ nhất' }, { value: 'orders', label: 'Nhiều đơn nhất' }, { value: 'videos', label: 'Nhiều video nhất' }]} /></div></header>
          {loading ? <div className="reports-state">Đang tổng hợp dữ liệu…</div> : summary?.daily.length ? <div className="reports-table-scroll"><table className="reports-table"><thead><tr><th>Ngày</th><th>Số đơn hàng</th><th>Số video</th><th>Thay đổi số đơn so với ngày trước</th></tr></thead><tbody>{visibleDaily.map((day) => {
            const change = getDailyOrderChange(day.date, day.orders)
            const direction = change === null ? 'unknown' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
            return <tr key={day.date}><th scope="row">{formatDate(day.date)}</th><td>{formatNumber(day.orders)}</td><td>{formatNumber(day.videos)}</td><td><span className={`reports-order-change is-${direction}`} role="img" aria-label={change === null ? 'Không có dữ liệu ngày trước để so sánh' : `${change > 0 ? 'Tăng' : change < 0 ? 'Giảm' : 'Không đổi'} ${formatNumber(Math.abs(change))} đơn so với ngày trước`}>
              {direction === 'up' ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4m-5 5 5-5 5 5" /></svg> : direction === 'down' ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12m-5-5 5 5 5-5" /></svg> : direction === 'flat' ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" /></svg> : null}
              <span>{change === null ? '—' : `${change > 0 ? '+' : ''}${formatNumber(change)} đơn`}</span>
            </span></td></tr>
          })}</tbody></table></div> : <div className="reports-state"><strong>Chưa có dữ liệu trong khoảng này</strong><span>Thử chọn khoảng thời gian khác hoặc bỏ bớt điều kiện lọc.</span></div>}
          {!loading && <ReportPagination label="Phân trang sản lượng theo ngày" page={dailyPage} pageCount={dailyPageCount} onPageChange={setDailyPage} />}
        </section>
        <section className="reports-panel reports-table-panel">
          <header className="reports-panel-heading"><div><h2>Hiệu suất theo bàn</h2></div><div className="reports-sort"><Dropdown ariaLabel="Sắp xếp danh sách bàn" value={sort} onChange={(value) => { setSort(value as typeof sort); setTablesPage(1) }} options={[{ value: 'orders', label: 'Nhiều đơn nhất' }, { value: 'videos', label: 'Nhiều video nhất' }, { value: 'warehouse', label: 'Theo tên kho' }, { value: 'table', label: 'Theo tên bàn' }, { value: 'type', label: 'Theo loại bàn' }]} /></div></header>
          {loading ? <div className="reports-state">Đang tổng hợp dữ liệu…</div> : sortedTables.length ? <div className="reports-table-scroll"><table className="reports-table reports-table-breakdown"><thead><tr><th>Tên bàn</th><th>Loại bàn</th><th>Đơn hàng</th><th>Video</th></tr></thead><tbody>{visibleTables.map((table) => <tr key={table.table_id}><th scope="row">{table.table_name}</th><td><span className={`reports-type reports-type-${table.table_type.toLowerCase()}`}>{table.table_type === 'PACKING' ? 'Đóng hàng' : 'Hoàn hàng'}</span></td><td>{formatNumber(table.orders)}</td><td>{formatNumber(table.videos)}</td></tr>)}</tbody></table></div> : <div className="reports-state"><strong>Chưa có bàn phù hợp</strong><span>Điều chỉnh bộ lọc để xem số liệu theo bàn.</span></div>}
          {!loading && <ReportPagination label="Phân trang hiệu suất theo bàn" page={tablesPage} pageCount={tablesPageCount} onPageChange={setTablesPage} />}
        </section>
      </div>
      <section className="reports-trends" aria-labelledby="reports-trends-title">
        <header className="reports-trends-heading"><div><h2 id="reports-trends-title">Xu hướng theo ngày</h2></div></header>
        {loading ? <div className="reports-chart-state">Đang tổng hợp dữ liệu biểu đồ…</div> : summary?.daily.length ? <div className="reports-trends-grid">
          <figure className="reports-trend-chart"><figcaption><h3>Số đơn hàng</h3><span className="reports-chart-legend reports-chart-legend-orders">Đơn hàng</span></figcaption><OrdersBarChart data={chartDaily} /></figure>
          <figure className="reports-trend-chart"><figcaption><h3>Số video</h3><span className="reports-chart-legend reports-chart-legend-videos">Video</span></figcaption><VideosLineChart data={chartDaily} /></figure>
        </div> : <div className="reports-chart-state">Chưa có dữ liệu để dựng biểu đồ trong khoảng này.</div>}
      </section>
    </>}
  </section>
}
