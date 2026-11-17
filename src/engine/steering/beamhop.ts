// Beam-hop schedule (docs/PHYSICS.md): the array serves the highest-elevation visible satellite
// and hands over when the current one drops below the minimum elevation (25°) and a better one
// exists.
//
// Cost: the current satellite is propagated once per step; the full catalog is searched only at
// the start, at hand-overs and during outages, so ~10⁴ Starlink satellites stay fast.

import { geodeticToEcefM, type Observer, type Vec3 } from '../orbit/geodesy'
import { lookAngles, type SatRec } from '../orbit/sgp4'

export const BEAM_HOP_MIN_EL_RAD = (25 * Math.PI) / 180

export interface HopCandidate {
  noradId: number
  name: string
  satrec: SatRec
}

export interface HopSample {
  time: Date
  /** Serving satellite, or null during an outage. */
  noradId: number | null
  azRad: number
  elRad: number
}

export interface HopSegment {
  noradId: number
  name: string
  start: Date
  end: Date
  maxElRad: number
}

export interface HopEvent {
  time: Date
  fromId: number | null
  toId: number | null
  /** Elevation of the old satellite when it was dropped, and of the new one when taken. */
  fromElRad: number | null
  toElRad: number | null
}

export interface BeamHopSchedule {
  samples: HopSample[]
  segments: HopSegment[]
  handovers: HopEvent[]
}

/** The highest satellite at `t` with elevation ≥ minElRad, or null. */
export function bestCandidate(
  cands: readonly HopCandidate[],
  o: Observer,
  t: Date,
  minElRad: number,
  obsEcef: Vec3 = geodeticToEcefM(o),
): { cand: HopCandidate; azRad: number; elRad: number } | null {
  let best: { cand: HopCandidate; azRad: number; elRad: number } | null = null
  for (const c of cands) {
    const l = lookAngles(c.satrec, o, t, obsEcef)
    if (l && l.elRad >= minElRad && (!best || l.elRad > best.elRad)) best = { cand: c, azRad: l.azRad, elRad: l.elRad }
  }
  return best
}

export function beamHopSchedule(
  cands: readonly HopCandidate[],
  o: Observer,
  start: Date,
  durationS: number,
  stepS = 10,
  minElRad = BEAM_HOP_MIN_EL_RAD,
): BeamHopSchedule {
  const obsEcef = geodeticToEcefM(o)
  const samples: HopSample[] = []
  const handovers: HopEvent[] = []
  const t0 = start.getTime()
  let serving: HopCandidate | null = null

  for (let t = t0; t <= t0 + durationS * 1000; t += stepS * 1000) {
    const date = new Date(t)
    let look = serving ? lookAngles(serving.satrec, o, date, obsEcef) : null
    if (!serving || !look || look.elRad < minElRad) {
      const best = bestCandidate(cands, o, date, minElRad, obsEcef)
      const changed = (best?.cand.noradId ?? null) !== (serving?.noradId ?? null)
      if (changed && (t > t0 || serving)) {
        handovers.push({
          time: date,
          fromId: serving?.noradId ?? null,
          toId: best?.cand.noradId ?? null,
          fromElRad: look?.elRad ?? null,
          toElRad: best?.elRad ?? null,
        })
      }
      serving = best?.cand ?? null
      look = best ? { azRad: best.azRad, elRad: best.elRad, rangeM: 0, rangeRateMps: 0 } : null
    }
    samples.push({ time: date, noradId: serving?.noradId ?? null, azRad: look?.azRad ?? 0, elRad: look?.elRad ?? -Math.PI / 2 })
  }

  // Collapse samples into serving segments.
  const names = new Map(cands.map((c) => [c.noradId, c.name]))
  const segments: HopSegment[] = []
  for (const s of samples) {
    const last = segments[segments.length - 1]
    if (s.noradId === null) continue
    if (last && last.noradId === s.noradId && last.end.getTime() === s.time.getTime() - stepS * 1000) {
      last.end = s.time
      last.maxElRad = Math.max(last.maxElRad, s.elRad)
    } else {
      segments.push({ noradId: s.noradId, name: names.get(s.noradId) ?? String(s.noradId), start: s.time, end: s.time, maxElRad: s.elRad })
    }
  }
  return { samples, segments, handovers }
}

/** The sample at or just before `t` (null outside the schedule). */
export function sampleAt(schedule: BeamHopSchedule, t: Date): HopSample | null {
  const s = schedule.samples
  if (s.length === 0 || t < s[0].time || t > s[s.length - 1].time) return null
  let lo = 0
  let hi = s.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (s[mid].time <= t) lo = mid
    else hi = mid - 1
  }
  return s[lo]
}
