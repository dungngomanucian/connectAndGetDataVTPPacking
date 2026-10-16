import { useEffect, useRef, useState } from 'react'
import {
  loadAudioSettingFile,
  loadAudioSettings,
  loadSessionTimeout,
  resetAudioSetting,
  updateSessionTimeout,
  uploadAudioSetting,
  type AudioAssetInfo,
  type AudioEventType,
  type SessionTimeoutSettings,
} from './api'
import defaultEndSound from '../assets/voicebosch-barcode-scanner-182459_T4HwHzVz.mp3'
import defaultStartSound from '../assets/voicebosch-barcode-scanner-182459_EQqEFjpP.mp3'

const EVENTS: { key: AudioEventType; title: string; description: string }[] = [
  { key: 'start', title: 'Đơn bắt đầu', description: 'Phát khi camera nhận diện đơn mới và bắt đầu ghi hình.' },
  { key: 'end', title: 'Đơn kết thúc', description: 'Phát khi phiên đơn hàng kết thúc.' },
]
const DEFAULT_SOUNDS: Record<AudioEventType, string> = { start: defaultStartSound, end: defaultEndSound }

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatDuration(seconds: number | null) {
  return seconds === null ? '' : `${seconds.toFixed(1)} giây`
}

export default function SettingsPage({ role }: { role: string }) {
  const canEdit = role === 'ADMIN' || role === 'OPERATOR'
  const [assets, setAssets] = useState<Record<AudioEventType, AudioAssetInfo> | null>(null)
  const [sessionTimeout, setSessionTimeout] = useState<SessionTimeoutSettings | null>(null)
  const [timeoutDraft, setTimeoutDraft] = useState('10')
  const [timeoutSaving, setTimeoutSaving] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<Partial<Record<AudioEventType, string>>>({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<AudioEventType | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const previewUrlsRef = useRef(previewUrls)

  useEffect(() => () => Object.values(previewUrlsRef.current).forEach((url) => url && URL.revokeObjectURL(url)), [])

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const [audioResponse, timeoutResponse] = await Promise.all([
        loadAudioSettings(),
        loadSessionTimeout(),
      ])
      setAssets(audioResponse.assets)
      setSessionTimeout(timeoutResponse)
      setTimeoutDraft(String(timeoutResponse.max_session_minutes))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được cấu hình âm thanh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const saveSessionTimeout = async () => {
    if (!sessionTimeout) return
    const minutes = Number(timeoutDraft)
    const seconds = minutes * 60
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(seconds)) {
      setError('Nhập thời lượng lớn hơn 0 phút bằng một giá trị số hợp lệ.')
      return
    }
    setTimeoutSaving(true)
    setError('')
    setNotice('')
    try {
      const saved = await updateSessionTimeout(minutes, sessionTimeout.version)
      setSessionTimeout(saved)
      setTimeoutDraft(String(saved.max_session_minutes))
      setNotice('Đã lưu thời lượng phiên tối đa toàn hệ thống. Các phiên đang chạy giữ thời lượng đã áp dụng khi bắt đầu.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được thời lượng phiên tối đa.')
      if (reason instanceof Error && reason.message.includes('thay đổi ở nơi khác')) void refresh()
    } finally {
      setTimeoutSaving(false)
    }
  }

  const setPreview = (eventType: AudioEventType, url: string | null) => {
    const previous = previewUrlsRef.current[eventType]
    if (previous) URL.revokeObjectURL(previous)
    const next = { ...previewUrlsRef.current }
    if (url) next[eventType] = url
    else delete next[eventType]
    previewUrlsRef.current = next
    setPreviewUrls(next)
  }

  const preview = async (eventType: AudioEventType) => {
    setWorking(eventType)
    setError('')
    try {
      const blob = await loadAudioSettingFile(eventType)
      setPreview(eventType, URL.createObjectURL(blob))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được file để nghe thử.')
    } finally {
      setWorking(null)
    }
  }

  const upload = async (eventType: AudioEventType, file: File) => {
    if (!assets) return
    setWorking(eventType)
    setError('')
    setNotice('')
    try {
      const saved = await uploadAudioSetting(eventType, file, assets[eventType].version)
      setAssets((current) => current ? { ...current, [eventType]: saved } : current)
      setPreview(eventType, URL.createObjectURL(file))
      setNotice(`Đã lưu âm thanh “${EVENTS.find((item) => item.key === eventType)?.title.toLowerCase()}”. Âm thanh sẽ được áp dụng theo cấu hình hệ thống.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải lên được file âm thanh.')
      if (reason instanceof Error && reason.message.includes('cập nhật ở nơi khác')) void refresh()
    } finally {
      setWorking(null)
    }
  }

  const reset = async (eventType: AudioEventType) => {
    if (!assets) return
    setWorking(eventType)
    setError('')
    setNotice('')
    try {
      const saved = await resetAudioSetting(eventType, assets[eventType].version)
      setAssets((current) => current ? { ...current, [eventType]: saved } : current)
      setPreview(eventType, null)
      setNotice(`Đã khôi phục âm mặc định cho “${EVENTS.find((item) => item.key === eventType)?.title.toLowerCase()}”.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không khôi phục được âm thanh mặc định.')
      if (reason instanceof Error && reason.message.includes('cập nhật ở nơi khác')) void refresh()
    } finally {
      setWorking(null)
    }
  }

  return <section className="settings-page" aria-labelledby="settings-title">
    <header className="settings-heading">
      <div><p>CẤU HÌNH HỆ THỐNG</p><h1 id="settings-title">Cài đặt</h1><span>Quản lý thời lượng phiên và âm báo đơn hàng dùng chung cho mọi bàn.</span></div>
      <button type="button" className="settings-refresh" onClick={() => { setLoading(true); void refresh() }} disabled={loading}>Tải lại</button>
    </header>

    {error && <div className="settings-message is-error" role="alert">{error}</div>}
    {notice && <div className="settings-message is-success" role="status">{notice}</div>}

    <section className="settings-section settings-session-timeout" aria-labelledby="session-timeout-title">
      <header className="settings-section-heading"><div><h2 id="session-timeout-title">Thời lượng phiên tối đa</h2><p>Áp dụng chung cho đơn PACKING và RETURN. Phiên sẽ tự kết thúc khi đạt giới hạn này, kể cả khi QR vẫn còn trong hình.</p></div><span className="settings-scope-badge">Dùng chung toàn hệ thống</span></header>
      {!canEdit && <p className="settings-readonly-note">Tài khoản của bạn có thể xem cài đặt nhưng không thể thay đổi.</p>}
      {loading || !sessionTimeout ? <div className="settings-loading" role="status">Đang tải thời lượng phiên…</div> : <div className="settings-timeout-form">
        <label htmlFor="max-session-minutes">Giới hạn mỗi phiên (phút)</label>
        <div className="settings-timeout-input-row">
          <input id="max-session-minutes" type="number" min="0" step="any" value={timeoutDraft} disabled={!canEdit || timeoutSaving} onChange={(event) => setTimeoutDraft(event.target.value)} />
          <span>phút</span>
          {canEdit && <button type="button" className="settings-save-button" onClick={() => void saveSessionTimeout()} disabled={timeoutSaving || !Number.isFinite(Number(timeoutDraft) * 60) || Number(timeoutDraft) <= 0 || Number(timeoutDraft) === sessionTimeout.max_session_minutes}>{timeoutSaving ? 'Đang lưu…' : 'Lưu thời lượng'}</button>}
        </div>
        <p className="settings-timeout-note">Nhập bất kỳ số phút dương nào, có thể dùng số thập phân. Thay đổi áp dụng cho đơn bắt đầu sau khi lưu; đơn đang chạy giữ giới hạn lúc bắt đầu.</p>
      </div>}
    </section>

    <section className="settings-section" aria-labelledby="audio-settings-title">
      <header className="settings-section-heading"><div><h2 id="audio-settings-title">Âm thanh đơn hàng</h2><p>Tải lên âm riêng cho thời điểm bắt đầu và kết thúc đơn. Thay đổi được áp dụng chung cho các bàn.</p></div><span className="settings-scope-badge">Dùng chung toàn hệ thống</span></header>
      {!canEdit && <p className="settings-readonly-note">Tài khoản của bạn có thể nghe thử âm thanh nhưng không thể thay đổi cấu hình.</p>}
      {loading ? <div className="settings-loading" role="status">Đang tải cài đặt âm thanh…</div> : <div className="settings-audio-grid">
        {EVENTS.map(({ key, title, description }) => {
          const asset = assets?.[key]
          const isWorking = working === key
          return <article className="settings-audio-card" key={key}>
            <div className="settings-audio-card-heading"><span className={`settings-audio-icon is-${key}`} aria-hidden="true">♫</span><div><h3>{title}</h3><p>{description}</p></div></div>
            <div className="settings-audio-status">
              <span className={`settings-audio-status-dot ${asset?.configured ? 'is-custom' : ''}`} />
              <span>{asset?.configured ? 'Âm tùy chỉnh' : 'Đang dùng âm mặc định'}</span>
            </div>
            {asset?.configured && <div className="settings-audio-file"><strong>{asset.filename}</strong><span>{formatBytes(asset.size_bytes)} · {formatDuration(asset.duration_seconds)}</span></div>}
            <div className="settings-audio-player">
              {asset?.configured
                ? previewUrls[key] ? <audio controls preload="none" src={previewUrls[key]} aria-label={`Nghe thử âm ${title.toLowerCase()}`} />
                  : <button type="button" className="settings-secondary-button" onClick={() => void preview(key)} disabled={isWorking}>Nghe thử âm tùy chỉnh</button>
                : <audio controls preload="none" src={DEFAULT_SOUNDS[key]} aria-label={`Nghe thử âm mặc định ${title.toLowerCase()}`} />}
            </div>
            {canEdit && <div className="settings-audio-actions">
              <label className={`settings-upload-button${isWorking ? ' is-disabled' : ''}`}>
                {isWorking ? 'Đang xử lý…' : asset?.configured ? 'Thay file' : 'Tải file lên'}
                <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" disabled={isWorking || !assets} onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void upload(key, file)
                }} />
              </label>
              {asset?.configured && <button type="button" className="settings-reset-button" onClick={() => void reset(key)} disabled={isWorking}>Khôi phục mặc định</button>}
            </div>}
          </article>
        })}
      </div>}
      <p className="settings-audio-footnote">Định dạng MP3 hoặc WAV PCM không nén · tối đa 10 MB và 15 giây cho mỗi file.</p>
    </section>
  </section>
}
