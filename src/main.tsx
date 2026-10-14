import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { clearAuth, fetchCurrentUser, loadPlayback, type PlaybackData, type User } from './api'
import DashboardV2Page from './DashboardV2Page'
import PackingGalleryPage from './PackingGalleryPage'
import PlaybackModal from './PlaybackModal'
import { LoginRedesigned } from './LoginRedesigned'
import './styles.css'
import './mini.css'

type PackingContext = { tableId: string; tableType: string; fromDate: string; fromTime: string; toDate: string; toTime: string }
function App() {
  const [user, setUser] = useState<User | null>(null), [checking, setChecking] = useState(true)
  const [data, setData] = useState<PlaybackData | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [seed, setSeed] = useState<string | null>(null), [gallery, setGallery] = useState<PackingContext | null>(null)
  const controller = useRef<AbortController | null>(null)
  const closePlayback = useCallback(() => {
    controller.current?.abort(); setLoading(false); setData(null); setSeed(null); setError('')
  }, [])
  const closeGallery = useCallback(() => {
    setGallery(null); window.history.replaceState(null, '', '/dashboard')
  }, [])
  useEffect(() => {
    let active = true
    void fetchCurrentUser().then(current => { if (active) { setUser(current); setChecking(false) } })
    const expired = () => { setUser(null); closePlayback(); closeGallery() }
    window.addEventListener('vtp:unauthorized', expired)
    // The mini app has one page, including when opened directly at /dashboard.
    window.history.replaceState(null, '', '/dashboard')
    return () => { active = false; controller.current?.abort(); window.removeEventListener('vtp:unauthorized', expired) }
  }, [closePlayback, closeGallery])
  useEffect(() => {
    if (!gallery) return
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !seed) closeGallery() }
    document.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape) }
  }, [gallery, seed, closeGallery])
  async function openPlayback(id: string) {
    controller.current?.abort(); const next = new AbortController(); controller.current = next
    setSeed(id); setData(null); setLoading(true); setError('')
    try { const result = await loadPlayback(id, next.signal); if (!next.signal.aborted) setData(result) }
    catch (e) { if (!next.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể tải đơn hàng') }
    finally { if (!next.signal.aborted) setLoading(false) }
  }
  function openGallery(context: PackingContext) {
    window.history.replaceState(null, '', '/dashboard?' + new URLSearchParams(context).toString())
    setGallery(context)
  }
  if (checking) return <div className="mini-loading" role="status">Đang kết nối hệ thống…</div>
  if (!user) return <LoginRedesigned onLoginSuccess={setUser} />
  return <div className="app-shell mini-dashboard">
    <header className="topbar"><div className="brand-lockup"><img src="/assets/Viettel_Post_logo.svg" alt="Viettel Post" /><span className="brand-divider" /><div><strong>TRUNG TÂM ĐIỀU HÀNH</strong><span>GIÁM SÁT ĐÓNG GÓI</span></div></div>
      <div className="top-actions"><div className="account-cluster"><div className="account-copy"><span className="account-name">{user.full_name || user.username}</span><span className="account-role">{user.role}</span></div><div className="avatar" aria-hidden="true">{user.username.slice(0, 2).toUpperCase()}</div><button className="logout-button" onClick={() => { closePlayback(); closeGallery(); clearAuth(); setUser(null) }}>Đăng xuất</button></div></div>
    </header>
    <div className="body-layout"><main className="workspace dashboard-overview-mode"><DashboardV2Page onOpenPlayback={openPlayback} onOpenPacking={openGallery} /></main></div>
    {gallery && <div className="mini-gallery-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeGallery() }}>
      <section className="mini-gallery-panel" role="dialog" aria-modal="true" aria-label="Tất cả đơn hàng của bàn">
        <header className="mini-gallery-heading"><h2>Danh sách đơn hàng</h2><button className="warehouse-secondary-action" onClick={closeGallery}>Đóng</button></header>
        <div className="workspace home-mode packing-management-page"><PackingGalleryPage key={JSON.stringify(gallery)} onOpenPlayback={openPlayback} /></div>
      </section>
    </div>}
    <PlaybackModal data={data} groupSeedId={seed} loading={loading} error={error} onClose={closePlayback} />
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)
