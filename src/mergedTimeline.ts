export type CameraTimeline = { output_start: number; output_end: number; wall_start: number; wall_end: number }[]

export function wallAtOutput(timeline: CameraTimeline, time: number): number | null {
  const part = timeline.find(p => time >= Math.max(0, p.output_start) && time < p.output_end)
  return part ? part.wall_start + time - part.output_start : null
}

export function outputAtWall(timeline: CameraTimeline, wall: number, duration?: number): number | null {
  const part = timeline.find(p => wall >= p.wall_start && wall < p.wall_end)
  if (!part) return null
  const time = part.output_start + wall - part.wall_start


  const playableTime = time < 0 && time >= -.01 ? 0 : time
  return playableTime >= 0 && playableTime < part.output_end && (!Number.isFinite(duration) || playableTime < duration!) ? playableTime : null
}
