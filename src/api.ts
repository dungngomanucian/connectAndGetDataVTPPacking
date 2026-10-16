
import { type SessionSummary, type Station } from './data'

type DashboardSession = {
  warehouse_id?: string
  table_type?: string
  id: string
  tracking_code: string
  status: string
  started_at?: string | null
  ended_at?: string | null
  end_reason?: string | null
  video_available?: boolean
  snapshot_available?: boolean
}

export type DashboardTable = {
  id: string; code: string; name: string; enabled: boolean; table_type: string;
  status: 'ONLINE' | 'OFFLINE'; activity: 'BUSY' | 'ARMED' | 'IDLE';
  cameras?: { overview?: { enabled?: boolean; webrtc_url?: string }; detail?: { enabled?: boolean; webrtc_url?: string } };
  current_session?: DashboardSession | null;
}
export type DashboardWarehouse = { id: string; code: string; name: string; tables: DashboardTable[] }
type DashboardResponse = { warehouses: DashboardWarehouse[] }
export type PackingSession = {
  consecutive_session_count?: number
  id: string
  tracking_code: string
  status: string
  table_type: 'PACKING' | 'RETURN_INSPECTION' | string
  table_id: string
  table_code: string
  table_name: string
  started_at?: string | null
  ended_at?: string | null
  end_reason?: string | null
  processing_status?: string
  camera_count?: number
  video_available?: boolean
  snapshot_available?: boolean
}

export type PlaybackData = {
  session: { id: string; tracking_code: string; status: string; table_name?: string | null; started_at?: string | null; ended_at?: string | null; thumbnail_url?: string | null }
  record_detail_video: boolean
  encode_pip_video?: boolean
  clips: { id: string; lens_type: 'OVERVIEW' | 'DETAIL' | 'COMPLEX'; status: string; urls: string[] }[]
  download_clips?: { id: string; lens_type: 'OVERVIEW' | 'DETAIL' | 'COMPLEX'; is_pip: boolean; is_complex?: boolean; urls: string[] }[]
  snapshots: { id: string; status: string; lens_type: 'OVERVIEW' | 'DETAIL'; urls: string[] }[]
}

export type User = {
  id: string
  username: string
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
  enabled: boolean
  full_name?: string | null
}

const API_BASE_URL = '/api'
const TOKEN_KEY = 'vtp_auth_token'
const USER_KEY = 'vtp_auth_user'

function localMediaUrl(url: string): string {
  try {
    const media = new URL(url)
    if (!media.pathname.startsWith('/vtp-video-evidence/')) return url



    if (media.origin === window.location.origin) return url
    return `/media-proxy${media.pathname}${media.search}`
  } catch {
    return url
  }
}

function routePlaybackMediaThroughLocalProxy(playback: PlaybackData): PlaybackData {
  return {
    ...playback,
    session: {
      ...playback.session,
      thumbnail_url: playback.session.thumbnail_url ? localMediaUrl(playback.session.thumbnail_url) : playback.session.thumbnail_url,
    },
    clips: playback.clips.map((clip) => ({ ...clip, urls: clip.urls.map(localMediaUrl) })),
    download_clips: playback.download_clips?.map((clip) => ({ ...clip, urls: clip.urls.map(localMediaUrl) })),
    snapshots: playback.snapshots.map((snapshot) => ({ ...snapshot, urls: snapshot.urls.map(localMediaUrl) })),
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

export function setAuth(token: string, user: User, remember = true) {
  const storage = remember ? localStorage : sessionStorage
  const otherStorage = remember ? sessionStorage : localStorage
  otherStorage.removeItem(TOKEN_KEY)
  otherStorage.removeItem(USER_KEY)
  storage.setItem(TOKEN_KEY, token)
  storage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

export async function loginUser(username: string, password: string, remember = true): Promise<{ token: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Tên đăng nhập hoặc mật khẩu không đúng')
  }
  const data = await response.json()
  setAuth(data.access_token, data.user, remember)
  return { token: data.access_token, user: data.user }
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getAuthToken()
  if (!token) return null
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAuth()
      }
      return null
    }
    const user = (await response.json()) as User
    const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage
    storage.setItem(USER_KEY, JSON.stringify(user))
    return user
  } catch {
    return null
  }
}

export const dashboardEventsUrl = () => `${API_BASE_URL}/v1/ui/events`

export class ApiHttpError extends Error {
  constructor(readonly status: number, readonly path: string, readonly detail?: unknown) {
    super(`API ${status}: ${path}`)
    this.name = 'ApiHttpError'
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, signal })
  if (!response.ok) {
    if (response.status === 401) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('vtp:unauthorized'))
    }
    const body = await response.json().catch(() => undefined)
    throw new ApiHttpError(response.status, path, body?.detail)
  }
  return response.json() as Promise<T>
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'
}

function duration(start?: string | null, end?: string | null) {
  if (!start || !end) return '—'
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function sessionSummary(session: DashboardSession): SessionSummary {
  return {
    id: session.id,
    code: session.tracking_code,
    warehouseId: session.warehouse_id,
    tableType: session.table_type,
    time: formatTime(session.started_at),
    duration: duration(session.started_at, session.ended_at),
    startedAt: session.started_at ?? undefined,
    status: session.status,
    videoAvailable: session.video_available,
    snapshotAvailable: session.snapshot_available,
  }
}

async function fetchDashboardStations(signal?: AbortSignal): Promise<{ stations: Station[]; warehouseName: string; tables: DashboardTable[]; warehouses: DashboardWarehouse[] }> {
  const dashboard = await get<DashboardResponse>('/v1/ui/dashboard', signal)
  const warehouses = dashboard.warehouses
  const warehouseName = warehouses[0]?.name ?? 'Kho chưa cấu hình'
  const tables = dashboard.warehouses.flatMap((warehouse) => warehouse.tables)
  const mapped = tables.map((table): Station => {
    return {
      id: table.id,
      name: table.name || table.code,
      code: table.code,
      status: table.status === 'ONLINE' ? 'active' : 'inactive',
      employee: '—',
      order: table.current_session?.tracking_code ?? '—',
      elapsed: '—',
      camera: table.code,
      currentSession: table.current_session ? sessionSummary(table.current_session) : undefined,
      returnWaitingForAction: table.activity === 'ARMED',
      history: [],
    }
  })
  return { stations: mapped, warehouseName, tables, warehouses }
}

type DashboardData = Awaited<ReturnType<typeof fetchDashboardStations>>
let dashboardCache: DashboardData | undefined
let dashboardCacheAt = 0
let dashboardPending: Promise<DashboardData> | undefined
let dashboardAuth = ''
let dashboardPendingAuth = ''
let dashboardPendingSignal: AbortSignal | undefined
let dashboardLastStart = -Infinity

export function loadDashboardStations(signal?: AbortSignal): Promise<DashboardData> {
  const auth = getAuthToken() ?? ''
  if (auth !== dashboardAuth) { dashboardAuth = auth; dashboardCache = undefined; dashboardCacheAt = 0 }
  if (dashboardCache && Date.now() - dashboardCacheAt < 2000) return Promise.resolve(dashboardCache)
  if (dashboardPending && (dashboardPendingAuth !== auth || dashboardPendingSignal?.aborted)) {
    return dashboardPending.catch(() => undefined).then(() => loadDashboardStations(signal))
  }
  if (!dashboardPending) {
    dashboardPendingAuth = auth
    dashboardPendingSignal = signal
    const waitForSlot = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() },
        Math.max(0, dashboardLastStart + 2000 - Date.now()))
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
    })
    dashboardPending = waitForSlot.then(() => {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      dashboardLastStart = Date.now()
      return fetchDashboardStations(signal)
    }).then((data) => {
      if (auth === dashboardAuth) { dashboardCache = data; dashboardCacheAt = dashboardLastStart }
      return data
    }).finally(() => { dashboardPending = undefined })
  }
  return dashboardPending
}

export async function loadPlayback(sessionId: string, signal?: AbortSignal) {
  const playback = await get<PlaybackData>(`/v1/ui/sessions/${encodeURIComponent(sessionId)}/playback`, signal)
  return routePlaybackMediaThroughLocalProxy(playback)
}

export type MergeLayout = 'overview_main' | 'detail_main' | 'vertical' | 'horizontal' | 'horizontal_40_60' | 'horizontal_60_40'

export async function downloadMergedPip(sessionId: string, mergeJob = false, layout: MergeLayout = 'overview_main'): Promise<Blob> {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}/v1/ui/${mergeJob ? 'video-merges' : 'sessions'}/${encodeURIComponent(sessionId)}/download-pip?layout=${encodeURIComponent(layout)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    if (response.status === 401) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('vtp:unauthorized'))
    }
    const errorData = await response.json().catch(() => ({})) as { detail?: string | { code?: string } }
    const messages: Record<string, string> = {
      PIP_BUSY: 'Một video PIP đang được xử lý. Vui lòng thử lại sau.',
      PIP_REQUIRES_TWO_CAMERAS: 'Cần video từ cả hai camera để tạo PIP.',
      PIP_NO_OVERLAP: 'Hai camera không có khoảng thời gian chung để tạo PIP.',
      PIP_TOO_MANY_PARTS: 'Video có quá nhiều khoảng gián đoạn để tạo PIP.',
      PIP_TIMEOUT: 'Tạo video PIP quá thời gian cho phép. Vui lòng thử lại.',
      PIP_EXPORT_FAILED: 'Không thể tạo video PIP. Vui lòng thử lại.',
      NOT_READY: 'Video ghép chưa sẵn sàng để tải.',
      OUTPUT_MISSING: 'Video ghép hiện không còn khả dụng.',
      STORAGE_UNAVAILABLE: 'Kho video tạm thời không khả dụng.',
    }
    const detail = errorData.detail
    const code = typeof detail === 'object' && detail ? detail.code : undefined
    throw new Error((code && messages[code]) || (typeof detail === 'string' ? detail : 'Không thể tải video PIP. Vui lòng thử lại.'))
  }
  return response.blob()
}

export type PackingSessionQuery = {
  limit?: number
  offset?: number
  query?: string
  tableType?: string
  startedFrom?: string
  startedBefore?: string
  perTableLimit?: number
  groupConsecutive?: boolean
  tableId?: string
}

export function loadPackingSessions(options: number | PackingSessionQuery = 100, signal?: AbortSignal) {
  const filters = typeof options === 'number' ? { limit: options } : options
  const params = new URLSearchParams()
  params.set('limit', String(Math.min(500, Math.max(1, filters.limit ?? 100))))
  if (filters.offset !== undefined) params.set('offset', String(Math.max(0, filters.offset)))
  if (filters.query?.trim()) params.set('q', filters.query.trim())
  if (filters.tableType) params.set('table_type', filters.tableType)
  if (filters.startedFrom) params.set('started_from', filters.startedFrom)
  if (filters.startedBefore) params.set('started_before', filters.startedBefore)
  if (filters.perTableLimit !== undefined) params.set('per_table_limit', String(Math.min(50, Math.max(1, filters.perTableLimit))))
  if (filters.tableId) params.set('table_id', filters.tableId)
  if (filters.groupConsecutive) params.set('group_consecutive', 'true')
  return get<PackingSession[]>(`/v1/ui/sessions?${params.toString()}`, signal)
}

export type SessionPage = { items: PackingSession[]; total: number; limit: number; offset: number }
export function loadSessionPage(filters: PackingSessionQuery & {
  status?: string; group?: 'packing' | 'returned'; tab?: string
}, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: String(filters.limit ?? 20), offset: String(filters.offset ?? 0) })
  for (const [key, value] of Object.entries({ q: filters.query?.trim(), table_type: filters.tableType,
    table_id: filters.tableId, started_from: filters.startedFrom, started_before: filters.startedBefore,
    status: filters.status, group: filters.group, tab: filters.tab, group_consecutive: filters.groupConsecutive ? "true" : undefined })) {
    if (value) params.set(key, value)
  }
  return get<SessionPage>(`/v1/ui/sessions/page?${params}`, signal)
}

export type PackingTableOption = { id: string; code: string; name: string }

export function loadPackingTableOptions() {
  return get<PackingTableOption[]>('/v1/ui/tables')
}

export type MergeOutput = { camera: string; labels?: string[]; url?: string; download_url?: string; timeline?: { output_start: number; output_end: number; wall_start: number; wall_end: number }[] }
export type MergeJob = { id: string; version: number; state: string }
export const loadRepresentativeMerge = (seedId: string, signal?: AbortSignal) => get<{ job: MergeJob | null; source_count: number; automatic_state?: string | null; group_revision?: number | null }>('/v1/ui/video-merges/representative?session_group_seed_id=' + encodeURIComponent(seedId), signal)
export async function loadMergePlayback(id: string, signal?: AbortSignal) {
  const playback = await get<{ outputs: MergeOutput[] }>('/v1/ui/video-merges/' + encodeURIComponent(id) + '/playback', signal)
  return { outputs: playback.outputs.map(output => ({ ...output, url: output.url ? localMediaUrl(output.url) : undefined, download_url: output.download_url ? localMediaUrl(output.download_url) : undefined })) }
}
export type NearbySessionPage = Omit<SessionPage, "items"> & { items: PackingSession[]; seed: { id: string; tracking_code: string; table_id: string; warehouse_id: string; table_type: string; started_at: string } }
export const loadNearbySessions = (seedId: string, offset = 0, signal?: AbortSignal) => get<NearbySessionPage>('/v1/ui/sessions/' + encodeURIComponent(seedId) + '/nearby?limit=20&offset=' + offset, signal)

export type ReportWarehouse = { id: string; code: string; name: string; tables: { id: string; code: string; name: string; table_type: string }[] }
export type ReportSummary = {
  orders: number
  videos: number
  daily: { date: string; orders: number; videos: number }[]
  tables: { table_id: string; table_code: string; table_name: string; table_type: string; warehouse_id: string; warehouse_name: string; orders: number; videos: number }[]
}

export type ReportFilters = { warehouseId?: string; tableId?: string; tableType?: string; startedFrom?: string; startedBefore?: string; query?: string; timezone?: string }

function reportParams(filters: ReportFilters) {
  const params = new URLSearchParams()
  if (filters.warehouseId) params.set('warehouse_id', filters.warehouseId)
  if (filters.tableId) params.set('table_id', filters.tableId)
  if (filters.tableType) params.set('table_type', filters.tableType)
  if (filters.startedFrom) params.set('started_from', filters.startedFrom)
  if (filters.startedBefore) params.set('started_before', filters.startedBefore)
  if (filters.query?.trim()) params.set('q', filters.query.trim())
  if (filters.timezone) params.set('timezone', filters.timezone)
  return params.toString()
}

export function loadReportSummary(filters: ReportFilters) {
  return get<ReportSummary>(`/v1/ui/reports/summary?${reportParams(filters)}`)
}

export function reportExcelFilename(filters: ReportFilters) {
  const endpoint = (value: string, end = false) => {

    const date = new Date(new Date(value).getTime() - (end ? 1000 : 0))
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: filters.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
    const day = `${part('year')}-${part('month')}-${part('day')}`
    const time = `${part('hour')}-${part('minute')}-${part('second')}`
    return time === (end ? '23-59-59' : '00-00-00') ? day : `${day}_${time}`
  }
  const from = filters.startedFrom ? endpoint(filters.startedFrom) : ''
  const to = filters.startedBefore ? endpoint(filters.startedBefore, true) : ''
  const range = from && to ? (from === to ? from : `${from}_den_${to}`)
    : from ? `tu_${from}` : to ? `den_${to}` : 'tat-ca-thoi-gian'
  return `bao-cao-${range}.xlsx`
}

export async function downloadReportExcel(filters: ReportFilters) {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}/v1/ui/reports/export-public?${reportParams(filters)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    if (response.status === 401) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('vtp:unauthorized'))
    }
    throw new Error('Không thể xuất Excel. Vui lòng thử lại.')
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = reportExcelFilename(filters)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type WarehouseChoice = { id: string; name: string; enabled: boolean }
export function loadWarehouseChoices(params: { q?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20), offset: String(params.offset ?? 0) })
  if (params.q) query.set('q', params.q)
  return get<{ items: WarehouseChoice[]; total: number; limit: number; offset: number }>(`/v1/ui/warehouses/page?${query}`)
}
export function loadWarehouseChoice(id: string) {
  return get<WarehouseChoice>(`/v1/ui/warehouses/${encodeURIComponent(id)}/choice`)
}


export async function loadReportOptions(warehouseId?: string): Promise<ReportWarehouse[]> {
  if (!warehouseId) return []

  const warehouse = await get<ReportWarehouse>(`/v1/warehouses/${encodeURIComponent(warehouseId)}/catalog`)
  return [warehouse]
}

export type WarehouseListItem = {
  id: string
  created_at: string
  code: string
  name: string
  enabled: boolean
  version: number
  province?: string | null
  address?: string | null
  updated_at: string
  sort_order: number
  camera_total: number
  camera_enabled: number
  status: 'ACTIVE' | 'WARNING' | 'PAUSED'
}

export type WarehouseRecord = Omit<WarehouseListItem, 'camera_total' | 'camera_enabled' | 'status'>

export type WorkerNodeListItem = { id: string; code: string; name: string; enabled: boolean }

export type WarehouseListResponse = {
  items: WarehouseListItem[]
  total: number
  offset: number
  limit: number
}

export type WarehouseCreateInput = {
  code: string
  name: string
  province?: string
  address?: string
  enabled?: boolean
  sort_order?: number
}

export type WarehouseUpdateInput = {
  expected_version: number
  name?: string
  province?: string
  address?: string
  enabled?: boolean
}


export function loadWarehouses(params: { q?: string; province?: string; status?: string; offset?: number; limit?: number } = {}, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.province) query.set('province', params.province)
  if (params.status) query.set('status', params.status)
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  return get<WarehouseListResponse>(`/v1/warehouses/list?${query.toString()}`, signal)
}


export function createWarehouse(input: WarehouseCreateInput) {
  return post<WarehouseRecord>('/v1/warehouses', input)
}

export function deleteWarehouse(id: string) {
  return remove<{ id: string; deleted: boolean }>(`/v1/warehouses/${encodeURIComponent(id)}`)
}

export function updateWarehouse(id: string, input: WarehouseUpdateInput) {
  return patch<WarehouseRecord>(`/v1/warehouses/${encodeURIComponent(id)}`, input)
}


async function warehouseMutation<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    if (response.status === 401) { clearAuth(); window.dispatchEvent(new CustomEvent('vtp:unauthorized')) }
    const messages: Record<number, string> = {403: 'Tài khoản không có quyền quản lý kho.', 409: 'Dữ liệu có xung đột hoặc kho không thể xóa. Hãy tải lại danh sách.', 422: 'Thông tin kho không hợp lệ.'}
    throw new Error(messages[response.status] || 'Không thể xử lý yêu cầu. Vui lòng thử lại.')
  }
  return response.json() as Promise<T>
}
const post = <T>(path: string, body: unknown) => warehouseMutation<T>('POST', path, body)
const patch = <T>(path: string, body: unknown) => warehouseMutation<T>('PATCH', path, body)
const remove = <T>(path: string) => warehouseMutation<T>('DELETE', path)
export type WarehouseDesk = { id: string; code: string; name: string; table_type: string; enabled: boolean; status: string; activity: string; current_session?: { id: string; tracking_code: string; status: string } | null }
export type WarehouseDesks = { id: string; code: string; name: string; enabled: boolean; tables: WarehouseDesk[] }
export const loadWarehouseDesks = (id: string, signal?: AbortSignal) => get<WarehouseDesks>(`/v1/ui/warehouses/${encodeURIComponent(id)}/tables`, signal)

export async function deleteLiveTable(id: string): Promise<void> {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}/v1/tables/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    if (response.status === 401) { clearAuth(); window.dispatchEvent(new CustomEvent('vtp:unauthorized')) }
    const messages: Record<number, string> = {403: 'Tài khoản không có quyền xóa bàn.', 409: 'Bàn đang được sử dụng hoặc có dữ liệu liên quan, không thể xóa.', 404: 'Bàn không còn tồn tại. Hãy cập nhật danh sách.'}
    throw new Error(messages[response.status] || 'Không thể xóa bàn. Vui lòng thử lại.')
  }
  dashboardCache = undefined
  dashboardCacheAt = 0
}

export type AudioEventType = 'start' | 'end'
export type AudioAssetInfo = {
  event_type: AudioEventType
  version: number
  configured: boolean
  filename: string | null
  media_type: string | null
  duration_seconds: number | null
  size_bytes: number
}
export type AudioSettingsResponse = { assets: Record<AudioEventType, AudioAssetInfo> }
export type SessionTimeoutSettings = {
  version: number
  max_session_seconds: number
  max_session_minutes: number
}

export function loadAudioSettings() {
  return get<AudioSettingsResponse>('/v1/ui/audio-settings')
}

export function loadSessionTimeout() {
  return get<SessionTimeoutSettings>('/v1/ui/session-timeout')
}

export function updateSessionTimeout(maxSessionMinutes: number, expectedVersion: number) {
  return put<SessionTimeoutSettings>('/v1/ui/session-timeout', {
    max_session_minutes: maxSessionMinutes,
    expected_version: expectedVersion,
  })
}

export async function loadAudioSettingFile(eventType: AudioEventType): Promise<Blob> {
  const token = getAuthToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const path = `/v1/ui/audio-settings/${eventType}/file`
  const response = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { detail?: string }
    if (response.status === 401) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('vtp:unauthorized'))
    }
    throw new Error(errorData.detail || `API ${response.status}: ${path}`)
  }
  return response.blob()
}

export async function uploadAudioSetting(eventType: AudioEventType, file: File, expectedVersion: number) {
  const token = getAuthToken()
  const form = new FormData()
  form.set('expected_version', String(expectedVersion))
  form.set('file', file)
  const path = `/v1/ui/audio-settings/${eventType}`
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'PUT', headers, body: form })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { detail?: string | { error?: string; version?: number } }
    if (response.status === 401) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('vtp:unauthorized'))
    }
    const detail = typeof errorData.detail === 'object'
      ? errorData.detail.error === 'version_conflict' ? 'Âm thanh đã được cập nhật ở nơi khác. Hãy tải lại cài đặt.' : undefined
      : errorData.detail
    throw new Error(detail || `API ${response.status}: ${path}`)
  }
  return response.json() as Promise<AudioAssetInfo>
}

export async function resetAudioSetting(eventType: AudioEventType, expectedVersion: number) {
  const token = getAuthToken()
  const path = `/v1/ui/audio-settings/${eventType}?expected_version=${expectedVersion}`
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'DELETE', headers })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { detail?: string | { error?: string; version?: number } }
    if (response.status === 401) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('vtp:unauthorized'))
    }
    const detail = typeof errorData.detail === 'object'
      ? errorData.detail.error === 'version_conflict' ? 'Âm thanh đã được cập nhật ở nơi khác. Hãy tải lại cài đặt.' : undefined
      : errorData.detail
    throw new Error(detail || `API ${response.status}: ${path}`)
  }
  return response.json() as Promise<AudioAssetInfo>
}


async function put<T>(path: string, body: unknown): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) }, body: JSON.stringify(body) })
  if (!response.ok) {
    if (response.status === 401) { clearAuth(); window.dispatchEvent(new CustomEvent('vtp:unauthorized')) }
    if (response.status === 409) throw new Error('Cài đặt đã thay đổi ở nơi khác. Hãy tải lại.')
    throw new Error('Không thể lưu cài đặt. Kiểm tra quyền truy cập và dữ liệu nhập.')
  }
  return response.json() as Promise<T>
}
