export type StationStatus = 'active' | 'inactive'

export type Station = {
  id: number | string
  name: string
  employee: string
  code: string
  status: StationStatus
  order: string
  elapsed: string
  camera: string
  streamPath?: string
  detailStreamPath?: string
  currentSession?: SessionSummary
  sessionBlockedReason?: string | null
  returnWaitingForAction?: boolean
  history: SessionSummary[]
}

export type SessionSummary = {
  warehouseId?: string
  tableType?: string
  consecutiveCount?: number
  id: string
  code: string
  time: string
  duration: string
  startedAt?: string
  status?: string
  videoAvailable?: boolean
  snapshotAvailable?: boolean
}

// Default station collection.
export const stations: Station[] = []
