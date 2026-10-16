import { useEffect, useState } from 'react'
import { loadRepresentativeMerge, loadMergePlayback, type MergeJob, type MergeOutput } from './api'
import { watchRefresh } from './liveRefresh'
export function useRepresentativeMerge(seedId: string | null) {
  const [automatic, setAutomatic] = useState<{ seedId: string; state: string | null; revision: number | null } | null>(null)
  const [result, setResult] = useState<{ seedId: string; job: MergeJob; outputs: MergeOutput[]; sourceCount: number } | null>(null)
  useEffect(() => {
    setResult(null)
    setAutomatic(null)
    if (!seedId) return
    let active = true, loaded = '', loadedAt = 0
    const stop = watchRefresh(async signal => {
      try {
      const next = await loadRepresentativeMerge(seedId, signal)
      if (!active || signal.aborted) return
      setAutomatic({seedId,state:next.automatic_state ?? null,revision:next.group_revision ?? null})
      if (!next.job) { loaded = ''; setResult(null); return }
      const key = `${next.job.id}:${next.job.version}`

      if (loaded === key && Date.now() - loadedAt < 10 * 60 * 1000) return
      const playback = await loadMergePlayback(next.job.id, signal)
      if (!active || signal.aborted) return
      loaded = key; loadedAt = Date.now()
      setResult({ seedId, job: next.job, outputs: playback.outputs, sourceCount: next.source_count })
      } catch (error) {
        if (active && !signal.aborted) { loaded = ''; setResult(null) }
        throw error
      }
    }, { interval: 5000, accepts: event => event.type !== 'node_heartbeat' })
    return () => { active = false; stop() }
  }, [seedId])
  return { representative: result?.seedId === seedId ? result : null, automatic: automatic?.seedId === seedId ? automatic : null }
}


