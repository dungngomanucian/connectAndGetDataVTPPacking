import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { clearAuth, fetchCurrentUser, loadPlayback, type PlaybackData, type User } from './api'
import DashboardV2Page from './DashboardV2Page'
import PackingGalleryPage from './PackingGalleryPage'
import SettingsPage from './SettingsPage'
import LivePage from './LivePage'
import ReportsPage from './ReportsPage'
import WarehouseManagementPage from './WarehouseManagementPage'
import WarehouseDesksPage from './WarehouseDesksPage'
import PlaybackModal from './PlaybackModal'
import { LoginRedesigned } from './LoginRedesigned'
import './styles.css'
import './app.css'

type PackingContext = { tableId: string; tableType: string; fromDate: string; fromTime: string; toDate: string; toTime: string }
function MenuIcon({ name }: { name: 'dashboard' | 'packing' | 'reports' | 'warehouse' | 'live' | 'settings' | 'menu' | 'close' }) {
  const paths = {
    dashboard: 'M4.75 4.75h5.5v5.5h-5.5zM13.75 4.75h5.5v5.5h-5.5zM4.75 13.75h5.5v5.5h-5.5zM13.75 13.75h5.5v5.5h-5.5z',
    packing: 'M7 3.75h10A2.25 2.25 0 0 1 19.25 6v14.25H4.75V6A2.25 2.25 0 0 1 7 3.75Zm2.25 5h5.5m-5.5 4h5.5m-5.5 4h3.5',
    reports: 'M4 20h16M7 16V9m5 7V4m5 12v-5',
    warehouse: 'm3.5 9 8.5-5 8.5 5v10.5h-17V9Zm3.5 10.5v-6h9v6M7 10.5h10',
    live: 'M5 6h10v12H5zM15 10l5-3v10l-5-3',
    settings: 'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h9m4 0h3M15 4v4m-8 2v4m8 4v4',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'm6 6 12 12M6 18 18 6',
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
function App() {
  const [user, setUser] = useState<User | null>(null), [checking, setChecking] = useState(true)
  const [data, setData] = useState<PlaybackData | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [seed, setSeed] = useState<string | null>(null)
  const [route, setRoute] = useState(() => window.location.pathname + window.location.search)
  const controller = useRef<AbortController | null>(null)
  const closePlayback = useCallback(() => {
    controller.current?.abort(); setLoading(false); setData(null); setSeed(null); setError('')
  }, [])
  const navigate = useCallback((url: string) => {
    closePlayback()
    setMobileMenuOpen(false)
    window.history.pushState(null, '', url)
    setRoute(window.location.pathname + window.location.search)
    window.scrollTo(0, 0)
  }, [closePlayback])
  useEffect(() => {
    let active = true
    void fetchCurrentUser().then(current => { if (active) { setUser(current); setChecking(false) } })
    const expired = () => { setMobileMenuOpen(false); setUser(null); closePlayback() }
    window.addEventListener('vtp:unauthorized', expired)
    const popstate = () => { setMobileMenuOpen(false); closePlayback(); setRoute(window.location.pathname + window.location.search) }
    window.addEventListener('popstate', popstate)
    if (!['/dashboard', '/packing', '/reports', '/warehouse', '/live', '/settings'].includes(window.location.pathname.replace(/\/$/, '')) && !/^\/warehouse\/[0-9a-f-]{36}\/desks\/?$/i.test(window.location.pathname)) {
      window.history.replaceState(null, '', '/dashboard')
      setRoute('/dashboard')
    }
    return () => { active = false; controller.current?.abort(); window.removeEventListener('vtp:unauthorized', expired); window.removeEventListener('popstate', popstate) }
  }, [closePlayback])
  useEffect(() => {
    if (!mobileMenuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false) }
    document.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape) }
  }, [mobileMenuOpen])
  async function openPlayback(id: string) {
    controller.current?.abort(); const next = new AbortController(); controller.current = next
    setSeed(id); setData(null); setLoading(true); setError('')
    try { const result = await loadPlayback(id, next.signal); if (!next.signal.aborted) setData(result) }
    catch (e) { if (!next.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể tải đơn hàng') }
    finally { if (!next.signal.aborted) setLoading(false) }
  }
  function openGallery(context: PackingContext) {
    navigate('/packing?' + new URLSearchParams(context).toString())
  }
  const isPacking = route.split('?')[0].replace(/\/$/, '') === '/packing'
  const isReports = route.split('?')[0].replace(/\/$/, '') === '/reports'
  const deskMatch = route.split('?')[0].match(/^\/warehouse\/([0-9a-f-]{36})\/desks\/?$/i)
  const isWarehouse = route.split('?')[0].replace(/\/$/, '') === '/warehouse' || Boolean(deskMatch)
  const isLive = route.split('?')[0].replace(/\/$/, '') === '/live'
  const isSettings = route.split('?')[0].replace(/\/$/, '') === '/settings'
  const navigation = (mobile = false) => <nav aria-label="Điều hướng chính">
    {([{ path: '/dashboard', label: 'Tổng quan', icon: 'dashboard', active: !isPacking && !isReports && !isWarehouse && !isLive && !isSettings }, { path: '/warehouse', label: 'Kho hàng', icon: 'warehouse', active: isWarehouse }, { path: '/live', label: 'Live', icon: 'live', active: isLive }, { path: '/packing', label: 'Đơn hàng', icon: 'packing', active: isPacking }, { path: '/reports', label: 'Báo cáo', icon: 'reports', active: isReports }, { path: '/settings', label: 'Cài đặt', icon: 'settings', active: isSettings }] as const).map(item =>
      <a key={item.path} href={item.path} className={`${mobile ? 'mobile-nav-item' : 'nav-item'} ${item.active ? 'active' : ''}`} aria-current={item.active ? 'page' : undefined} onClick={event => {
        if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(item.path) }
      }}><MenuIcon name={item.icon} /><span>{item.label}</span></a>)}
  </nav>
  if (checking) return <div className="vtp-loading" role="status">Đang kết nối hệ thống…</div>
  if (!user) return <LoginRedesigned onLoginSuccess={setUser} />
  return <div className="app-shell vtp-dashboard">
    <header className="topbar"><button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={mobileMenuOpen} aria-controls="vtp-mobile-navigation" onClick={() => setMobileMenuOpen(open => !open)}><MenuIcon name={mobileMenuOpen ? 'close' : 'menu'} /></button><div className="brand-lockup"><img src="/assets/Viettel_Post_logo.svg" alt="Viettel Post" /><span className="brand-divider" /><div><strong>TRUNG TÂM ĐIỀU HÀNH</strong><span>GIÁM SÁT ĐÓNG GÓI</span></div></div>
      <div className="top-actions"><div className="account-cluster"><div className="account-copy"><span className="account-name">{user.full_name || user.username}</span><span className="account-role">{user.role}</span></div><div className="avatar" aria-hidden="true">{user.username.slice(0, 2).toUpperCase()}</div><button className="logout-button" onClick={() => { setMobileMenuOpen(false); closePlayback(); clearAuth(); setUser(null) }}>Đăng xuất</button></div></div>
    </header>
    {mobileMenuOpen && <div className="mobile-nav-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setMobileMenuOpen(false) }}>
      <div className="mobile-nav-panel" id="vtp-mobile-navigation"><div className="mobile-nav-heading">Menu</div>{navigation(true)}</div>
    </div>}
    <div className="body-layout">
      <aside className="sidebar"><div className="sidebar-top">{navigation()}</div></aside>
      <main className={`workspace ${isSettings ? 'home-mode settings-workspace' : isLive ? 'dashboard-detail-mode' : isWarehouse ? 'warehouse-page' : isReports ? 'home-mode reports-workspace' : isPacking ? 'home-mode packing-management-page' : 'dashboard-overview-mode'}`}>
      {isSettings ? <SettingsPage role={user.role} /> : isLive ? <LivePage onOpenPlayback={openPlayback} onOpenPacking={context => navigate('/packing?' + new URLSearchParams(context).toString())} /> : isWarehouse ? deskMatch ? <WarehouseDesksPage key={deskMatch[1]} warehouseId={deskMatch[1]} onBack={() => navigate('/warehouse')} onOpenPacking={context => navigate('/packing?' + new URLSearchParams(context).toString())} onOpenPlayback={openPlayback} /> : <WarehouseManagementPage onOpenDesks={warehouse => navigate(`/warehouse/${warehouse.id}/desks`)} onOpenPacking={() => navigate('/packing')} /> : isReports ? <ReportsPage /> : isPacking ? <PackingGalleryPage key={route} onOpenPlayback={openPlayback} /> : <DashboardV2Page onOpenPlayback={openPlayback} onOpenPacking={openGallery} />}
    </main></div>
    <PlaybackModal data={data} groupSeedId={seed} loading={loading} error={error} onClose={closePlayback} />
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)
