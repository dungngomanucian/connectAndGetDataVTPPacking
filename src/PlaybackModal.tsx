import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { wallAtOutput, outputAtWall, type CameraTimeline } from './mergedTimeline'
import { useRepresentativeMerge } from './useRepresentativeMerge'
import { downloadMergedPip, loadPlayback, loadNearbySessions, type NearbySessionPage, type PlaybackData, type MergeOutput, type MergeLayout } from './api'
import Dropdown from './Dropdown'
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

function playbackDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const day = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${time} ${day}`
}

function sessionVideoTimeRange(startedAt?: string | null, endedAt?: string | null) {
  const start = startedAt ? new Date(startedAt) : null
  const end = endedAt ? new Date(endedAt) : null
  const validStart = start && Number.isFinite(start.getTime()) ? start : null
  const validEnd = end && Number.isFinite(end.getTime()) ? end : null
  const time = (date: Date) => date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const day = (date: Date) => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (!validStart) return '—'
  if (!validEnd) return `${time(validStart)} – Đang ghi · ${day(validStart)}`
  if (day(validStart) !== day(validEnd)) return `${playbackDateTime(startedAt)} – ${playbackDateTime(endedAt)}`
  return `${time(validStart)} – ${time(validEnd)} · ${day(validStart)}`
}


function useDraggablePip<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originLeft: number; originTop: number } | null>(null)
  const movedRef = useRef(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const onPointerDown = (event: ReactPointerEvent<T>) => {
    if (event.button !== 0) return
    const pip = ref.current
    const parent = pip?.parentElement
    if (!pip || !parent) return
    const pipRect = pip.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: pipRect.left - parentRect.left,
      originTop: pipRect.top - parentRect.top,
    }
    movedRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const drag = dragRef.current
    const pip = ref.current
    const parent = pip?.parentElement
    if (!drag || drag.pointerId !== event.pointerId || !pip || !parent) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) movedRef.current = true
    if (!movedRef.current) return
    const parentRect = parent.getBoundingClientRect()
    const pipRect = pip.getBoundingClientRect()
    setPosition({
      left: Math.min(parentRect.width - pipRect.width, Math.max(0, drag.originLeft + deltaX)),
      top: Math.min(parentRect.height - pipRect.height, Math.max(0, drag.originTop + deltaY)),
    })
  }

  const onPointerUp = (event: ReactPointerEvent<T>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

  const resetPosition = useCallback(() => {
    dragRef.current = null
    movedRef.current = false
    setPosition(null)
  }, [])

  return {
    ref,
    movedRef,
    resetPosition,
    style: position ? { left: `${position.left}px`, top: `${position.top}px`, right: 'auto', bottom: 'auto' } as CSSProperties : undefined,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onLostPointerCapture: onPointerUp,
  }
}

function formatVideoTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const totalSeconds = Math.floor(value)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export default function PlaybackModal({ data, loading, error, onClose, groupSeedId }: { groupSeedId: string | null; data: PlaybackData | null; loading: boolean; error: string; onClose: () => void }) {
  const isOpen = loading || Boolean(data) || Boolean(error)
  const [activeSnapshot, setActiveSnapshot] = useState<string | null>(null)
  const [showSessionVideos, setShowSessionVideos] = useState(false)
  const sessionVideosSeedId = groupSeedId ?? data?.session.id ?? null
  useEffect(() => { setShowSessionVideos(false) }, [isOpen, sessionVideosSeedId])
  const { representative, automatic } = useRepresentativeMerge(isOpen ? groupSeedId ?? data?.session.id ?? null : null)
  const showingMerged = Boolean(representative?.outputs.length)
  const hasMultipleMergedSessions = showingMerged && (representative?.sourceCount ?? 0) >= 2
  const mergedRange = representative?.outputs.flatMap(output => output.timeline ?? []).reduce(
    (range, piece) => ({ start: Math.min(range.start, piece.wall_start), end: Math.max(range.end, piece.wall_end) }),
    { start: Infinity, end: -Infinity },
  )
  const displayedStart = showingMerged && Number.isFinite(mergedRange?.start) ? new Date(mergedRange!.start * 1000).toISOString() : data?.session.started_at
  const displayedEnd = showingMerged && Number.isFinite(mergedRange?.end) ? new Date(mergedRange!.end * 1000).toISOString() : data?.session.ended_at
  const overview = data?.clips.filter((clip) => clip.lens_type === 'OVERVIEW').flatMap((clip) => clip.urls) ?? []
  const detail = data?.clips.filter((clip) => clip.lens_type === 'DETAIL').flatMap((clip) => clip.urls) ?? []
  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (activeSnapshot) setActiveSnapshot(null)
      else onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [activeSnapshot, isOpen, onClose])

  if (!isOpen) return null
  const snapshots = data?.snapshots.flatMap((snapshot) => snapshot.urls) ?? []
  return <>
  <div className="playback-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="playback-card" role="dialog" aria-modal="true" aria-labelledby="playback-title">
      <header className="playback-header">
        <div className="playback-heading"><h2 id="playback-title">Chi tiết đơn hàng</h2>{data && hasMultipleMergedSessions && <button type="button" className="playback-session-toggle" onClick={() => setShowSessionVideos((current) => !current)} aria-label={showSessionVideos ? 'Ẩn video các phiên trong quá trình đóng gói' : 'Hiện video các phiên trong quá trình đóng gói'} title={showSessionVideos ? 'Ẩn video các phiên' : 'Xem video các phiên'} aria-expanded={showSessionVideos} aria-controls="playback-session-videos"><Icon name="search" size={21} /></button>}</div>
        <button type="button" className="playback-close" onClick={onClose} aria-label="Đóng cửa sổ xem lại"><Icon name="close" size={19} /></button>
      </header>
      <div className="playback-scroll-area">
        {loading && <div className="playback-feedback" role="status"><span className="playback-spinner" />Đang tải video và ảnh của phiên…</div>}
        {error && <div className="playback-error" role="alert"><strong>Không tải được nội dung phiên</strong><span>{error}</span></div>}
        {data && <div className="playback-content">
          <div className={`playback-overview-layout${showingMerged ? ' has-merged-video' : ''}`}>
            <dl className="playback-session-details" aria-label="Thông tin đơn hàng">
              <div><dt>Mã đơn hàng</dt><dd>{data.session.tracking_code || 'Chưa nhận diện'}</dd></div>
              <div><dt>Tên bàn</dt><dd>{data.session.table_name || '—'}</dd></div>
              <div className="playback-time-range"><dt>Thời gian</dt><dd>{playbackDateTime(displayedStart)} <span aria-hidden="true">–</span> {displayedEnd ? playbackDateTime(displayedEnd) : data.session.status === 'IN_PROGRESS' ? 'Đang xử lý' : '—'}</dd></div>
            </dl>
            {!showingMerged && <PlaybackDownloads data={data} />}
          </div>
          {automatic && ['WAITING_FOR_SOURCES','QUEUED','RUNNING'].includes(automatic.state ?? '') && <p role="status" className="playback-auto-status">{(automatic.revision ?? 1) > 1 ? 'Đang cập nhật video ghép…' : 'Đang tạo video ghép…'}</p>}
          {showingMerged && representative ? <RepresentativeMergedVideos key={`merged:${representative.job.id}:${representative.job.version}`} outputs={representative.outputs} jobId={representative.job.id} orderCode={data.session.tracking_code} /> : <PlaybackPictureInPicture key={`original:${data.session.id}`} overview={overview} detail={detail} recordDetailVideo={data.record_detail_video} />}
          <section className="playback-snapshot-section">
            <div className="playback-section-heading"><div><h3>Ảnh chụp quá trình đóng gói</h3></div>{snapshots.length > 0 && <span className="playback-count">{snapshots.length} ảnh</span>}</div>
            {snapshots.length ? <div className="playback-snapshots">{snapshots.map((url, index) => <button key={url} type="button" onClick={() => setActiveSnapshot(url)} aria-label={`Xem ảnh mã vận đơn ${index + 1}`}><img src={url} alt={`Ảnh mã vận đơn ${index + 1}`} loading="lazy" /></button>)}</div> : <p className="playback-empty">Phiên này chưa có ảnh mã vận đơn.</p>}
          </section>
          {hasMultipleMergedSessions && showSessionVideos && <div id="playback-session-videos"><PackingSessionVideos key={groupSeedId ?? data.session.id} seedId={groupSeedId ?? data.session.id} /></div>}
        </div>}
      </div>
    </section>
  </div>
  {activeSnapshot && createPortal(<div className="playback-image-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveSnapshot(null) }}><section className="playback-image-lightbox-card" role="dialog" aria-modal="true" aria-label="Ảnh chụp quá trình đóng gói"><button type="button" className="playback-close playback-image-lightbox-close" onClick={() => setActiveSnapshot(null)} aria-label="Đóng ảnh"><Icon name="close" size={19} /></button><img src={activeSnapshot} alt="Ảnh chụp quá trình đóng gói" /></section></div>, document.body)}
  </>
}

function PackingSessionVideos({ seedId }: { seedId: string }) {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<NearbySessionPage | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    setResult(null)
    void loadNearbySessions(seedId, page * 20, controller.signal).then((next) => {
      if (!controller.signal.aborted) setResult(next)
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [seedId, page, retry])
  if (!result || result.total <= 1) return error ? <p role="status">Không tải được video các phiên. <button type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></p> : null
  return <section className="playback-session-videos" aria-label="Video các phiên trong quá trình đóng gói">
    <div className="playback-section-heading"><h3>Video các phiên trong quá trình đóng gói</h3><span className="playback-count">{result.total} phiên</span></div>
    <div className="playback-session-video-grid">{result.items.map((session) => <PackingSessionVideo key={session.id} sessionId={session.id} startedAt={session.started_at} endedAt={session.ended_at} />)}</div>
    {result.total > 20 && <div className="playback-recording-pages"><button type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Trước</button><span>{page + 1} / {Math.ceil(result.total / 20)}</span><button type="button" disabled={(page + 1) * 20 >= result.total} onClick={() => setPage((current) => current + 1)}>Sau</button></div>}
  </section>
}

function PackingSessionVideo({ sessionId, startedAt, endedAt }: { sessionId: string; startedAt?: string | null; endedAt?: string | null }) {
  const [data, setData] = useState<PlaybackData | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const cardRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    const load = () => {
      void loadPlayback(sessionId, controller.signal).then((next) => {
        if (!controller.signal.aborted) setData(next)
      }).catch(() => { if (!controller.signal.aborted) setError(true) })
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load() }
    }, { rootMargin: '150px' })
    if (cardRef.current) observer.observe(cardRef.current)
    return () => { observer.disconnect(); controller.abort() }
  }, [sessionId, retry])
  const overview = data?.clips.filter((clip) => clip.lens_type === 'OVERVIEW').flatMap((clip) => clip.urls) ?? []
  const detail = data?.clips.filter((clip) => clip.lens_type === 'DETAIL').flatMap((clip) => clip.urls) ?? []
  return <article ref={cardRef} className="playback-session-video-card">
    <p>{sessionVideoTimeRange(startedAt, endedAt)}</p>
    {error ? <p role="status">Không tải được video. <button type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></p> : data ? <PlaybackPictureInPicture overview={overview} detail={detail} recordDetailVideo={data.record_detail_video} compact /> : <div className="playback-session-video-placeholder">Đang tải video…</div>}
  </article>
}

function RepresentativeMergedVideos({ outputs, jobId, orderCode }: { outputs: MergeOutput[]; jobId: string; orderCode: string }) {
  const overview = outputs.filter(output => output.labels?.includes('OVERVIEW'))
  const detail = outputs.filter(output => output.labels?.includes('DETAIL'))
  const downloads = outputs.map(output => ({ id: output.camera, lens_type: output.labels?.includes('DETAIL') ? 'DETAIL' as const : 'OVERVIEW' as const, is_pip: false, urls: [output.download_url ?? output.url ?? ''] }))
  const data = { session: { id: jobId, tracking_code: orderCode }, clips: downloads, download_clips: downloads } as unknown as PlaybackData
  return <section className="playback-merged-videos" aria-label="Video ghép đại diện">
    <PlaybackDownloads data={data} mergeJobId={jobId} />
    <PlaybackPictureInPicture overview={overview.flatMap(output => output.url ? [output.url] : [])} detail={detail.flatMap(output => output.url ? [output.url] : [])} recordDetailVideo={Boolean(detail.length)} overviewTimeline={overview[0]?.timeline} detailTimeline={detail[0]?.timeline} />
  </section>
}

function PlaybackDownloads({ data, mergeJobId }: { data: PlaybackData; mergeJobId?: string }) {
  const [layout, setLayout] = useState<MergeLayout>('overview_main')
  const [merging, setMerging] = useState(false)
  const [mergeError, setMergeError] = useState('')
  const available = data.download_clips ?? data.clips.map((clip) => ({ ...clip, is_pip: false, is_complex: false }))
  const originals = available.filter((clip) => !clip.is_pip && clip.urls.length)
  const pip = available.filter((clip) => clip.is_pip && clip.urls.length)
  const canMerge = originals.some((clip) => clip.lens_type === 'OVERVIEW') && originals.some((clip) => clip.lens_type === 'DETAIL')
  const storedPip = pip.find((clip) => clip.is_complex) ?? (!canMerge ? pip[0] : undefined)
  const label = (lens: string) => lens === 'DETAIL' ? 'Camera cận cảnh' : 'Camera toàn cảnh'
  if (!originals.length && !pip.length) return null
  const link = (url: string, title: string, key: string, className?: string) => <a key={key} className={className} href={url} download aria-label={`Tải ${title}`}><Icon name="download" size={16} />{title}</a>
  const mergeAndDownload = async () => {
    setMerging(true)
    setMergeError('')
    try {
      const blob = await downloadMergedPip(mergeJobId ?? data.session.id, Boolean(mergeJobId), layout)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      const safeTrackingCode = data.session.tracking_code.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'code'
      anchor.download = `${safeTrackingCode}_Complex_${layout}.mp4`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Không thể ghép video PIP')
    } finally {
      setMerging(false)
    }
  }
  return <section className="playback-downloads" aria-label="Tải video">
    <div className="playback-camera-downloads">
      {originals.flatMap((clip) => clip.urls.map((url, index) => link(url, `${label(clip.lens_type)}${clip.urls.length > 1 ? ` ${index + 1}` : ''}`, `${clip.id}-${index}`)))}
    </div>
    <div className="playback-pip-downloads">
      {canMerge && <div className="playback-merge-layout"><span>Bố cục video ghép</span><Dropdown ariaLabel="Chọn bố cục video ghép" value={layout} onChange={(value) => { setLayout(value as MergeLayout); setMergeError('') }} disabled={merging} options={[
        { value: 'overview_main', group: 'Hình trong hình', label: 'Toàn cảnh chính – Cận cảnh phụ' },
        { value: 'detail_main', group: 'Hình trong hình', label: 'Cận cảnh chính – Toàn cảnh phụ' },
        { value: 'vertical', group: 'Bố cục dạng dọc', label: 'Toàn cảnh trên – Cận cảnh dưới' },
        { value: 'horizontal', group: 'Bố cục dạng ngang', label: 'Toàn cảnh trái – Cận cảnh phải' },
        { value: 'horizontal_60_40', group: 'Bố cục 60/40', label: 'Ưu tiên toàn cảnh (60%)' },
        { value: 'horizontal_40_60', group: 'Bố cục 60/40', label: 'Ưu tiên cận cảnh (60%)' },
      ]} /></div>}
      {storedPip && (!canMerge || layout === 'overview_main') && link(storedPip.urls[0], 'Tải video PIP', `pip-${storedPip.id}`, 'playback-pip-primary')}
      {canMerge && (!storedPip || layout !== 'overview_main') && <button className="playback-pip-primary" type="button" onClick={() => void mergeAndDownload()} disabled={merging}><Icon name="download" size={16} />{merging ? 'Đang ghép video…' : 'Tải video ghép'}</button>}
      {mergeError && <span className="playback-download-error" role="alert">{mergeError}</span>}
    </div>
  </section>
}

function PlaybackPictureInPicture({ overview, detail, recordDetailVideo, compact = false, overviewTimeline = [], detailTimeline = [] }: { overview: string[]; detail: string[]; recordDetailVideo: boolean; compact?: boolean; overviewTimeline?: CameraTimeline; detailTimeline?: CameraTimeline }) {
  const [mainLens, setMainLens] = useState<'OVERVIEW' | 'DETAIL'>(overview.length ? 'OVERVIEW' : 'DETAIL')
  const stageRef = useRef<HTMLDivElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const pipVideoRef = useRef<HTMLVideoElement>(null)
  const pipDrag = useDraggablePip<HTMLButtonElement>()
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isZoomOpen, setIsZoomOpen] = useState(false)
  const [zoom, setZoom] = useState(100)
  const progressFrameRef = useRef<number | null>(null)
  const savedPositionRef = useRef(0)
  const swapRef = useRef<{ time: number; wall?: number | null; playing: boolean; mainReady: boolean; pipReady: boolean } | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const [followerAvailable, setFollowerAvailable] = useState(true)
  const hasTimelines = overviewTimeline.length > 0 && detailTimeline.length > 0
  const mainTimeline = mainLens === 'OVERVIEW' ? overviewTimeline : detailTimeline
  const pipTimeline = mainLens === 'OVERVIEW' ? detailTimeline : overviewTimeline

  const syncFollower = (force = false) => {
    if (!hasTimelines || swapRef.current) return
    const main = mainVideoRef.current, follower = pipVideoRef.current
    if (!main || !follower || main.readyState < 1 || follower.readyState < 1) return
    const wall = wallAtOutput(mainTimeline, main.currentTime)
    const target = wall === null ? null : outputAtWall(pipTimeline, wall, follower.duration)
    setFollowerAvailable(target !== null)
    if (target === null) { follower.pause(); return }
    if (!follower.seeking && (force || Math.abs(follower.currentTime - target) > .1)) follower.currentTime = target
    if (isPlaying && !main.paused && follower.paused && !follower.ended) void follower.play().catch(() => {})
  }

  useEffect(() => {
    if (!hasTimelines || !isPlaying) return
    const timer = window.setInterval(() => syncFollower(), 100)
    return () => window.clearInterval(timer)
  }, [hasTimelines, isPlaying, mainLens, overviewTimeline, detailTimeline])


  useEffect(() => {
    mainVideoRef.current?.pause()
    pipVideoRef.current?.pause()
    setMainLens(overview.length ? 'OVERVIEW' : 'DETAIL')
    setIsPlaying(false)
    savedPositionRef.current = 0
    swapRef.current = null
    setIsSwitching(false)
    setProgress(0)
    setDuration(0)
    setZoom(100)
    setIsZoomOpen(false)
  }, [overview.length, detail.length])

  useEffect(() => {
    const syncFullscreen = () => {
      const fullscreen = document.fullscreenElement === stageRef.current
      setIsFullscreen(fullscreen)
      if (!fullscreen) pipDrag.resetPosition()
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [pipDrag.resetPosition])

  useEffect(() => {
    if (progressFrameRef.current !== null) cancelAnimationFrame(progressFrameRef.current)
    if (!isPlaying) {
      progressFrameRef.current = null
      return
    }

    const updateProgress = () => {
      const mainVideo = mainVideoRef.current
      const pipVideo = pipVideoRef.current
      const mainPlaying = Boolean(mainVideo && !mainVideo.paused && !mainVideo.ended)
      const pipPlaying = Boolean(pipVideo && !pipVideo.paused && !pipVideo.ended)
      if (!mainPlaying && !pipPlaying) {
        progressFrameRef.current = null
        setIsPlaying(false)
        return
      }
      const activeVideo = mainPlaying ? mainVideo : pipVideo
      if (activeVideo && !swapRef.current) {
        savedPositionRef.current = activeVideo.currentTime
        setProgress(activeVideo.currentTime)
      }
      progressFrameRef.current = requestAnimationFrame(updateProgress)
    }

    progressFrameRef.current = requestAnimationFrame(updateProgress)
    return () => {
      if (progressFrameRef.current !== null) cancelAnimationFrame(progressFrameRef.current)
      progressFrameRef.current = null
    }
  }, [isPlaying])

  const mainUrls = mainLens === 'OVERVIEW' ? overview : detail
  const pipUrls = mainLens === 'OVERVIEW' ? detail : overview
  const mainLabel = mainLens === 'OVERVIEW' ? 'Góc rộng' : 'Góc hẹp'
  const pipLabel = mainLens === 'OVERVIEW' ? 'Góc hẹp' : 'Góc rộng'

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === stageRef.current) await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    } catch {
      setIsFullscreen(false)
    }
  }

  const updateZoom = (nextZoom: number) => setZoom(Math.min(200, Math.max(100, nextZoom)))

  const togglePlayback = async () => {
    const mainVideo = mainVideoRef.current
    const pipVideo = pipVideoRef.current
    if (!mainVideo) return
    if (isPlaying) {
      mainVideo.pause()
      pipVideo?.pause()
      setIsPlaying(false)
      return
    }
    try {
      syncFollower(true)
      const wall = hasTimelines ? wallAtOutput(mainTimeline, mainVideo.currentTime) : null
      const followerReady = !hasTimelines || (wall !== null && outputAtWall(pipTimeline, wall, pipVideo?.duration) !== null)
      await Promise.all([mainVideo.play(), followerReady ? pipVideo?.play() : undefined])
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  const seekPlayback = (value: number) => {
    const mainVideo = mainVideoRef.current
    const pipVideo = pipVideoRef.current
    if (mainVideo?.duration) mainVideo.currentTime = Math.min(value, mainVideo.duration)
    if (hasTimelines) syncFollower(true)
    else if (pipVideo?.duration) pipVideo.currentTime = Math.min(value, pipVideo.duration)
    savedPositionRef.current = value
    setProgress(value)
  }

  const handleMainTimeUpdate = () => {
    const mainVideo = mainVideoRef.current
    if (!mainVideo || isPlaying || swapRef.current || mainVideo.readyState < 1) return
    const pipVideo = pipVideoRef.current
    const activeVideo = !hasTimelines && mainVideo.ended && pipVideo && !pipVideo.ended ? pipVideo : mainVideo
    savedPositionRef.current = activeVideo.currentTime
    setProgress(activeVideo.currentTime)
  }

  const handleLoadedMetadata = (lens: 'main' | 'pip') => {
    const mainVideo = mainVideoRef.current
    const pipVideo = pipVideoRef.current
    const video = lens === 'main' ? mainVideo : pipVideo
    if (!video) return
    const swap = swapRef.current
    const leaderTime = swap?.time ?? savedPositionRef.current
    const wall = swap?.wall ?? (hasTimelines ? wallAtOutput(mainTimeline, leaderTime) : null)
    const target = lens === 'pip' && wall !== null && hasTimelines
      ? outputAtWall(pipTimeline, wall, video.duration) ?? leaderTime : leaderTime
    if (Number.isFinite(video.duration)) video.currentTime = Math.min(target, video.duration)
    setDuration(hasTimelines && Number.isFinite(mainVideo?.duration) ? mainVideo!.duration : Math.max(Number.isFinite(mainVideo?.duration) ? mainVideo!.duration : 0,
      Number.isFinite(pipVideo?.duration) ? pipVideo!.duration : 0))
    if (!swap) { syncFollower(true); return }
    if (lens === 'main') swap.mainReady = true
    else swap.pipReady = true
    if (!swap.mainReady || !swap.pipReady) return
    swapRef.current = null
    setIsSwitching(false)
    const restoredTime = mainVideo?.currentTime ?? target
    savedPositionRef.current = restoredTime
    setProgress(restoredTime)
    if (swap.playing && mainVideo) {
      void Promise.all([mainVideo.play(), pipVideo?.play()]).then(() => setIsPlaying(true)).catch(() => {
        mainVideo.pause()
        pipVideo?.pause()
        setIsPlaying(false)
      })
    }
  }

  const swapCameras = () => {
    if (isSwitching) return
    const mainVideo = mainVideoRef.current
    const pipVideo = pipVideoRef.current
    const previousTime = mainVideo && mainVideo.readyState >= 1 ? mainVideo.currentTime : savedPositionRef.current
    const wall = hasTimelines ? wallAtOutput(mainTimeline, previousTime) : null
    const time = wall !== null ? outputAtWall(pipTimeline, wall, pipVideo?.duration) ?? previousTime : previousTime
    swapRef.current = { time, wall, playing: isPlaying, mainReady: false, pipReady: !mainUrls[0] }
    savedPositionRef.current = time
    mainVideo?.pause()
    pipVideo?.pause()
    if (progressFrameRef.current !== null) cancelAnimationFrame(progressFrameRef.current)
    setIsPlaying(false)
    setIsSwitching(true)
    setProgress(time)
    setMainLens((lens) => lens === 'OVERVIEW' ? 'DETAIL' : 'OVERVIEW')
  }

  const handleVideoError = () => {
    swapRef.current = null
    setIsSwitching(false)
    setIsPlaying(false)
  }

  return <section className="playback-camera-section playback-picture-section">
    {!compact && <div className="playback-section-heading"><div><h3>Video camera</h3></div><span className="playback-count">{overview.length + detail.length} video</span></div>}
    <div ref={stageRef} className="playback-camera-stage" style={{ '--playback-zoom': zoom / 100 } as CSSProperties}>
      <div className="feed-zoom playback-feed-zoom">
        <button type="button" className="feed-zoom-trigger" onClick={() => setIsZoomOpen((open) => !open)} aria-label={isZoomOpen ? 'Ẩn điều khiển zoom video' : 'Zoom video'} aria-expanded={isZoomOpen} data-tooltip="Zoom">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M8 11h6m-3-3v6" /></svg>
        </button>
        {isZoomOpen && <div className="feed-zoom-controls" aria-label="Điều chỉnh zoom video">
          <button type="button" onClick={() => updateZoom(zoom - 10)} disabled={zoom <= 100} aria-label="Giảm zoom"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M8 11h6" /></svg></button>
          <input type="range" min="100" max="200" step="10" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} aria-label="Mức zoom" />
          <output>{zoom}%</output>
          <button type="button" onClick={() => updateZoom(zoom + 10)} disabled={zoom >= 200} aria-label="Tăng zoom"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M8 11h6m-3-3v6" /></svg></button>
        </div>}
      </div>
      <button type="button" className="feed-fullscreen playback-feed-fullscreen" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Thu nhỏ video' : 'Phóng to video'} data-tooltip={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{isFullscreen ? <path d="M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6" /> : <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />}</svg>
      </button>
      {mainUrls[0] ? <video ref={mainVideoRef} preload="metadata" playsInline src={mainUrls[0]} aria-label={`Video ${mainLabel.toLowerCase()}`} onLoadedMetadata={() => handleLoadedMetadata('main')} onError={handleVideoError} onTimeUpdate={handleMainTimeUpdate} onEnded={() => { if (hasTimelines) { pipVideoRef.current?.pause(); setIsPlaying(false) } }} /> : <p className="playback-empty">{mainLens === 'OVERVIEW' ? 'Video toàn cảnh đang xử lý hoặc chưa được tải lên.' : recordDetailVideo ? 'Video góc cận đang xử lý hoặc chưa được tải lên.' : 'Phiên này không bật lưu video góc cận.'}</p>}
      {mainUrls[0] && <span className="playback-camera-label">{mainLabel}</span>}
      {pipUrls[0] && <button ref={pipDrag.ref} type="button" className="playback-camera-pip" disabled={isSwitching || (hasTimelines && !followerAvailable)} style={pipDrag.style} onPointerDown={pipDrag.onPointerDown} onPointerMove={pipDrag.onPointerMove} onPointerUp={pipDrag.onPointerUp} onPointerCancel={pipDrag.onPointerCancel} onLostPointerCapture={pipDrag.onLostPointerCapture} onClick={() => { if (pipDrag.movedRef.current) { pipDrag.movedRef.current = false; return }; swapCameras() }} aria-label={`Phóng to camera ${pipLabel.toLowerCase()}`}><video ref={pipVideoRef} style={{ visibility: hasTimelines && !followerAvailable ? 'hidden' : 'visible' }} muted playsInline preload="metadata" src={pipUrls[0]} onLoadedMetadata={() => handleLoadedMetadata('pip')} onError={handleVideoError} /><span>{hasTimelines && !followerAvailable ? 'Thiếu đoạn ghi' : pipLabel}</span></button>}
      {mainUrls[0] && <div className="playback-shared-controls" aria-label="Điều khiển phát hai camera"><button type="button" className="playback-play-toggle" disabled={isSwitching} onClick={() => void togglePlayback()} aria-label={isPlaying ? 'Tạm dừng hai camera' : 'Phát hai camera'}><Icon name={isPlaying ? 'pause' : 'play'} size={16} /></button><input className="playback-seek" disabled={isSwitching} type="range" min="0" max={duration} step="0.1" value={progress} onChange={(event) => seekPlayback(Number(event.target.value))} aria-label="Tua video chính" /><time>{formatVideoTime(progress)} / {formatVideoTime(duration)}</time></div>}
    </div>
    {mainUrls.length > 1 && <div className="playback-extra-videos" aria-label={`Các video bổ sung của ${mainLabel.toLowerCase()}`}>{mainUrls.slice(1).map((url, index) => <video key={url} controls preload="metadata" playsInline src={url} aria-label={`${mainLabel}, video ${index + 2}`} />)}</div>}
  </section>
}

