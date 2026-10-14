import { clearAuth, dashboardEventsUrl, getAuthToken } from './api'

export type LiveEvent = { type?: string; resource?: string }
const listeners = new Set<(event: LiveEvent) => void>()
let stream: { close: () => void } | null = null
let reconnect: ReturnType<typeof setTimeout> | undefined

function connect() {
  if (document.hidden || !listeners.size || stream) return
  const controller = new AbortController()
  const current = { close: () => controller.abort() }
  stream = current
  // Fetch streaming supports Authorization; never put login tokens in URLs/logs.
  void (async () => {
    try {
      const token = getAuthToken()
      const response = await fetch(dashboardEventsUrl(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
      })
      if (response.status === 401) {
        clearAuth(); window.dispatchEvent(new CustomEvent('vtp:unauthorized')); return
      }
      if (!response.ok || !response.body) throw new Error('Không kết nối được sự kiện dashboard')
      const reader = response.body.getReader(), decoder = new TextDecoder()
      let buffer = ''
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let newline: number
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1)
            if (!line.startsWith('data:')) continue
            try { const event = JSON.parse(line.slice(5)); listeners.forEach(listener => listener(event)) } catch { /* malformed event */ }
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    } catch { /* polling continues; reconnect below */ }
    finally {
      if (stream === current) {
        stream = null; clearTimeout(reconnect)
        if (!document.hidden && listeners.size) reconnect = setTimeout(connect, 3000)
      }
    }
  })()
}
function visibility() {
  if (document.hidden) { stream?.close(); stream = null; clearTimeout(reconnect) }
  else { connect(); listeners.forEach((listener) => listener({ type: 'visible' })) }
}
export function subscribeEvents(listener: (event: LiveEvent) => void) {
  if (!listeners.size) document.addEventListener('visibilitychange', visibility)
  listeners.add(listener); connect()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      stream?.close(); stream = null; clearTimeout(reconnect)
      document.removeEventListener('visibilitychange', visibility)
    }
  }
}

/** One in-flight task, coalesced notifications, visibility pause and error backoff. */
export function watchRefresh(task: (signal: AbortSignal) => Promise<void>, options: {
  accepts?: (event: LiveEvent) => boolean; interval?: number
} = {}) {
  let stopped = false, running = false, pending = false, failures = 0
  let lastStart = -Infinity, nextAllowed = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  const interval = options.interval ?? 2000
  const schedule = (immediate = false) => {
    if (stopped) return
    pending = true
    if (running) return
    clearTimeout(timer)
    if (document.hidden) return
    const delay = immediate && failures === 0 ? 0 : Math.max(0, lastStart + interval - Date.now(), nextAllowed - Date.now())
    timer = setTimeout(run, delay)
  }
  const run = async () => {
    if (stopped || document.hidden || running) return
    running = true; pending = false; lastStart = Date.now()
    controller = new AbortController()
    try {
      await task(controller.signal)
      failures = 0; nextAllowed = 0
    } catch (error) {
      if (!controller.signal.aborted) {
        failures++; nextAllowed = Date.now() + Math.min(30000, 4000 * 2 ** (failures - 1))
      }
    } finally {
      running = false
      if (!stopped) {
        if (pending || failures) schedule()
        else { clearTimeout(timer); timer = setTimeout(() => schedule(), interval) }
      }
    }
  }
  const pause = () => { if (document.hidden) { clearTimeout(timer); controller?.abort() } }
  document.addEventListener('visibilitychange', pause)
  const off = subscribeEvents((event) => {
    if (event.type === 'visible') schedule(true)
    else if (!options.accepts || options.accepts(event)) schedule()
  })
  schedule(true)
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', pause); off() }
}
