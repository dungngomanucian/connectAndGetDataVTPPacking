import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { loginUser, type User } from './api'
import loginBackground from '../assets/background_login.jpg'
import viettelPostLogo from '../assets/Viettel_Post_logo.svg'

interface LoginProps { onLoginSuccess: (user: User) => void }
type LoginIconName = 'user' | 'lock' | 'eye' | 'eye-off' | 'shield' | 'arrow' | 'warning'

function LoginIcon({ name, size = 20 }: { name: LoginIconName; size?: number }) {
  const paths: Record<LoginIconName, ReactNode> = {
    user: <><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20c.7-3.35 2.9-5 6.5-5s5.8 1.65 6.5 5" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v2" /></>,
    eye: <><path d="M2.5 12c2.1-3.7 5.3-5.5 9.5-5.5s7.4 1.8 9.5 5.5c-2.1 3.7-5.3 5.5-9.5 5.5S4.6 15.7 2.5 12Z" /><circle cx="12" cy="12" r="3.25" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    'eye-off': <><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.3 5.2A10.7 10.7 0 0 1 12 4.9c6.3 0 9.5 7.1 9.5 7.1a16.8 16.8 0 0 1-3 3.5M6.1 6.1C3.8 7.7 2.5 12 2.5 12s3.2 7.1 9.5 7.1c1.4 0 2.7-.3 3.8-.8" /></>,
    shield: <><path d="M12 3 19 6v5.2c0 4.2-2.6 7.7-7 9.8-4.4-2.1-7-5.6-7-9.8V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5" /><path d="M12 17h.01" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const fieldStyle = { width: '100%', height: '50px', border: '1px solid #d1dae7', borderRadius: '11px', outline: 'none', color: '#14233a', background: '#fff', font: 'inherit', fontSize: '15px', boxSizing: 'border-box' as const }

export function LoginRedesigned({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const passwordSelectionRef = useRef<{ start: number; end: number; direction: 'forward' | 'backward' | 'none' } | null>(null)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    const input = passwordInputRef.current
    const selection = passwordSelectionRef.current
    if (!input || !selection) return
    input.focus({ preventScroll: true })
    input.setSelectionRange(selection.start, selection.end, selection.direction)
    passwordSelectionRef.current = null
  }, [showPassword])

  const togglePasswordVisibility = () => {
    const input = passwordInputRef.current
    if (input && input.selectionStart !== null && input.selectionEnd !== null) {
      passwordSelectionRef.current = {
        start: input.selectionStart,
        end: input.selectionEnd,
        direction: input.selectionDirection ?? 'none',
      }
    }
    setShowPassword((visible) => !visible)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password) { setError('Vui lòng nhập tên đăng nhập và mật khẩu'); return }
    setError(''); setLoading(true)
    try {
      const { user } = await loginUser(username.trim(), password, rememberMe)
      onLoginSuccess(user)
    } catch (err) { setError(err instanceof Error ? err.message : 'Đăng nhập thất bại') }
    finally { setLoading(false) }
  }

  const featureRows: [LoginIconName, string, string][] = [
    ['shield', 'An toàn', 'Bảo vệ quyền lợi khách hàng'],
    ['lock', 'Minh bạch', 'Lưu trữ bằng chứng rõ ràng, tin cậy'],
    ['arrow', 'Dễ truy xuất', 'Tìm kiếm và quản lý nhanh chóng'],
  ]

  return (
    <main style={{ height: '100vh', minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(520px, 1fr)', overflow: 'hidden', background: '#fff', fontFamily: 'var(--font-body)' }}>
      <section aria-label="Giới thiệu VTP Video Packaging" style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', padding: 0, backgroundColor: '#fff', backgroundImage: `url(${loginBackground})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'left center' }}>
        <div style={{ display: 'none' }}>
          <img src={viettelPostLogo} alt="Viettel Post" style={{ width: '180px', height: 'auto', display: 'block', filter: 'brightness(0) invert(1)' }} />
          <div style={{ width: '64px', height: '3px', margin: '44px 0 28px', background: '#ec1b30' }} />
          <h1 style={{ margin: 0, maxWidth: '600px', fontSize: 'clamp(34px, 4vw, 58px)', lineHeight: 1.06, letterSpacing: '-0.035em', fontWeight: 700 }}>VTP Video Packaging</h1>
          <p style={{ maxWidth: '470px', margin: '22px 0 0', color: '#d6e1f0', fontSize: 'clamp(17px, 1.7vw, 23px)', lineHeight: 1.45 }}>Hệ thống giám sát đóng gói và bằng chứng video</p>
          <div style={{ display: 'grid', gap: '22px', marginTop: 'clamp(44px, 8vh, 88px)' }}>
            {featureRows.map(([icon, title, description]) => <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}><span style={{ width: '48px', height: '48px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', borderRadius: '13px', color: '#fff', background: 'rgba(123, 164, 214, 0.18)', border: '1px solid rgba(210, 228, 255, 0.14)' }}><LoginIcon name={icon} size={23} /></span><span><strong style={{ display: 'block', fontSize: '16px', lineHeight: 1.25 }}>{title}</strong><span style={{ display: 'block', marginTop: '4px', color: '#aebed4', fontSize: '14px', lineHeight: 1.35 }}>{description}</span></span></div>)}
          </div>
        </div>
        <div style={{ display: 'none' }}><span>Kết nối mọi hành trình</span></div>
      </section>

      <section style={{ minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '20px clamp(20px, 4vw, 64px)', color: '#14233a', background: '#fff' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <div style={{ padding: 'clamp(20px, 3vw, 32px)', borderRadius: '22px', background: 'rgba(255,255,255,0.92)', boxShadow: '0 20px 56px rgba(40, 63, 93, 0.11)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}><img src={viettelPostLogo} alt="Viettel Post" style={{ width: '140px', height: 'auto', display: 'inline-block' }} /><h2 style={{ margin: '18px 0 6px', color: '#12223a', fontSize: 'clamp(24px, 2.6vw, 30px)', lineHeight: 1.15, letterSpacing: '-0.025em' }}>Chào mừng trở lại</h2><p style={{ margin: 0, color: '#52677f', fontSize: '15px' }}>Đăng nhập vào VTP Video Packaging</p></div>
            {error && <div role="alert" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '18px', padding: '12px 14px', borderRadius: '12px', color: '#ec1b30', background: '#fff1f2', border: '1px solid #fecdd3', fontSize: '13px', lineHeight: 1.45 }}><span style={{ display: 'inline-flex', flex: '0 0 auto', marginTop: '1px' }} aria-hidden="true"><LoginIcon name="warning" size={17} /></span>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
              <label style={{ position: 'relative', display: 'block', color: '#14233a', fontSize: '14px', fontWeight: 700 }}>
                <span style={{ position: 'relative', display: 'block' }}>
                  <span style={{ position: 'absolute', left: '17px', top: '50%', zIndex: 1, display: 'inline-flex', color: focusedField === 'username' ? '#426489' : '#617792', transform: 'translateY(-50%)', pointerEvents: 'none' }}><LoginIcon name="user" size={21} /></span>
                  <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} onFocus={() => setFocusedField('username')} onBlur={() => setFocusedField(null)} autoComplete="username" required placeholder="" aria-label="Tên đăng nhập" style={{ ...fieldStyle, padding: username || focusedField === 'username' ? '16px 16px 0 52px' : '0 16px 0 52px', borderColor: focusedField === 'username' ? '#426489' : '#d1dae7', boxShadow: focusedField === 'username' ? '0 0 0 2px rgba(66, 100, 137, 0.12)' : 'none' }} />
                  <span style={{ position: 'absolute', left: '52px', top: username || focusedField === 'username' ? '7px' : '50%', color: username || focusedField === 'username' ? '#52677f' : '#617792', fontSize: username || focusedField === 'username' ? '11px' : '15px', fontWeight: username || focusedField === 'username' ? 700 : 500, lineHeight: 1, transform: username || focusedField === 'username' ? 'none' : 'translateY(-50%)', pointerEvents: 'none', transition: 'top 140ms ease-out, font-size 140ms ease-out, color 140ms ease-out' }}>Tên đăng nhập</span>
                </span>
              </label>
              <label style={{ position: 'relative', display: 'block', color: '#14233a', fontSize: '14px', fontWeight: 700 }}>
                <span style={{ position: 'relative', display: 'block' }}>
                  <span style={{ position: 'absolute', left: '17px', top: '50%', zIndex: 1, display: 'inline-flex', color: focusedField === 'password' ? '#426489' : '#617792', transform: 'translateY(-50%)', pointerEvents: 'none' }}><LoginIcon name="lock" size={21} /></span>
                  <input ref={passwordInputRef} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} autoComplete="current-password" required placeholder="" aria-label="Mật khẩu" style={{ ...fieldStyle, padding: password || focusedField === 'password' ? '16px 52px 0' : '0 52px', borderColor: focusedField === 'password' ? '#426489' : '#d1dae7', boxShadow: focusedField === 'password' ? '0 0 0 2px rgba(66, 100, 137, 0.12)' : 'none' }} />
                  <span style={{ position: 'absolute', left: '52px', top: password || focusedField === 'password' ? '7px' : '50%', color: password || focusedField === 'password' ? '#52677f' : '#617792', fontSize: password || focusedField === 'password' ? '11px' : '15px', fontWeight: password || focusedField === 'password' ? 700 : 500, lineHeight: 1, transform: password || focusedField === 'password' ? 'none' : 'translateY(-50%)', pointerEvents: 'none', transition: 'top 140ms ease-out, font-size 140ms ease-out, color 140ms ease-out' }}>Mật khẩu</span>
                  <button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={togglePasswordVisibility} onMouseDown={(event) => event.preventDefault()} style={{ position: 'absolute', right: '9px', top: '50%', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid transparent', borderRadius: '50%', color: showPassword ? '#315b86' : '#52677f', background: showPassword ? '#edf3f9' : '#f5f8fb', cursor: 'pointer', transform: 'translateY(-50%)', transition: 'color 140ms ease-out, background 140ms ease-out, border-color 140ms ease-out' }}><LoginIcon name={showPassword ? 'eye-off' : 'eye'} size={21} /></button>
                </span>
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '-2px' }}><label style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', color: '#52677f', fontSize: '14px', cursor: 'pointer' }}><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#ec1b30' }} />Ghi nhớ đăng nhập</label><button type="button" onClick={() => setError('Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.')} style={{ padding: 0, border: 0, color: '#ec1b30', background: 'transparent', font: 'inherit', fontSize: '14px', textDecoration: 'underline', cursor: 'pointer' }}>Quên mật khẩu?</button></div>
              <button className="login-submit-button" type="submit" disabled={loading} style={{ width: '100%', height: '50px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '6px', border: 0, borderRadius: '11px', color: '#fff', background: loading ? '#a8b2c1' : '#ec1b30', font: 'inherit', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 10px 20px rgba(236, 27, 48, 0.18)', transition: 'transform 160ms ease-out, box-shadow 160ms ease-out' }}>{loading ? 'Đang xác thực...' : 'Đăng nhập'}{!loading && <span className="login-submit-arrow" style={{ display: 'inline-flex', transition: 'transform 160ms ease-out' }}><LoginIcon name="arrow" size={20} /></span>}</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 14px', color: '#7b8ca3', fontSize: '13px' }}><span style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />hoặc<span style={{ height: '1px', flex: 1, background: '#e2e8f0' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '42px', borderRadius: '10px', color: '#52677f', background: '#eef3fb', fontSize: '13px' }}><LoginIcon name="shield" size={17} />Viettel Post · Hệ thống bảo mật nội bộ</div>
          </div>
          <p style={{ margin: '14px 0 0', textAlign: 'center', color: '#73839a', fontSize: '12px' }}>Vì một hành trình bưu chính tốt đẹp hơn</p><div style={{ width: '20px', height: '2px', margin: '8px auto 0', background: '#ec1b30' }} />
        </div>
      </section>
      <style>{`.login-submit-button:hover:not(:disabled) .login-submit-arrow { transform: translateX(4px); } @media (max-width: 900px) { main { height: auto !important; min-height: 100vh !important; overflow: auto !important; grid-template-columns: 1fr !important; } main > section:first-child { display: none !important; } main > section:last-child { min-height: 100vh !important; overflow: visible !important; padding: 28px 20px 40px !important; } }`}</style>
    </main>
  )
}
