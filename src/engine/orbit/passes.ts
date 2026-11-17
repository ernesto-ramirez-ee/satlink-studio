// Pass prediction: scan elevation over time, refine horizon crossings by bisection and the
// culmination by golden-section search.

import type { SatRec } from 'satellite.js'
import { geodeticToEcefM, type Observer } from './geodesy'
import { lookAngles, stateAt } from './sgp4'

export interface Pass {
  rise: Date
  culmination: Date
  set: Date
  maxElRad: number
  riseAzRad: number
  setAzRad: number
  /** True when the satellite was already up at the start of the search window. */
  riseClipped: boolean
  /** True when the satellite is still up at the end of the search window. */
  setClipped: boolean
}

const DOWN = -Math.PI / 2

export function findPasses(
  satrec: SatRec,
  o: Observer,
  start: Date,
  durationS: number,
  minElRad = 0,
  stepS = 30,
): Pass[] {
  const obsEcef = geodeticToEcefM(o)
  const t0 = start.getTime()
  const tEnd = t0 + durationS * 1000
  const el = (t: number): number => lookAngles(satrec, o, new Date(t), obsEcef)?.elRad ?? DOWN
  const az = (t: number): number => lookAngles(satrec, o, new Date(t), obsEcef)?.azRad ?? 0

  /** Time of the 0° crossing between a (below) and b (above), or vice versa. */
  const crossing = (a: number, b: number): number => {
    const rising = el(a) <= 0
    for (let i = 0; i < 12; i++) {
      const m = (a + b) / 2
      if (el(m) > 0 === rising) b = m
      else a = m
    }
    return (a + b) / 2
  }

  /** Golden-section search for the maximum elevation in [a, b]. */
  const culminate = (a: number, b: number): number => {
    const g = (Math.sqrt(5) - 1) / 2
    let c = b - g * (b - a)
    let d = a + g * (b - a)
    let fc = el(c)
    let fd = el(d)
    while (b - a > 500) {
      if (fc > fd) {
        b = d
        d = c
        fd = fc
        c = b - g * (b - a)
        fc = el(c)
      } else {
        a = c
        c = d
        fc = fd
        d = a + g * (b - a)
        fd = el(d)
      }
    }
    return (a + b) / 2
  }

  const passes: Pass[] = []
  const stepMs = stepS * 1000
  let prevT = t0
  let prevUp = el(t0) > 0
  let riseT: number | null = prevUp ? t0 : null
  let riseClipped = prevUp
  let bestT = t0
  let bestEl = prevUp ? el(t0) : DOWN

  const close = (setT: number, setClipped: boolean) => {
    if (riseT === null) return
    // Refine the culmination around the best coarse sample.
    const lo = Math.max(riseT, bestT - stepMs)
    const hi = Math.min(setT, bestT + stepMs)
    const culmT = hi - lo > 1000 ? culminate(lo, hi) : bestT
    const maxEl = Math.max(el(culmT), bestEl)
    if (maxEl >= minElRad) {
      passes.push({
        rise: new Date(riseT),
        culmination: new Date(culmT),
        set: new Date(setT),
        maxElRad: maxEl,
        riseAzRad: az(riseT),
        setAzRad: az(setT),
        riseClipped,
        setClipped,
      })
    }
    riseT = null
    riseClipped = false
    bestEl = DOWN
  }

  for (let t = t0 + stepMs; ; t += stepMs) {
    const tt = Math.min(t, tEnd)
    const e = el(tt)
    const up = e > 0
    if (up && !prevUp) {
      riseT = crossing(prevT, tt)
      bestEl = DOWN
    } else if (!up && prevUp) {
      close(crossing(prevT, tt), false)
    }
    if (up && e > bestEl) {
      bestEl = e
      bestT = tt
    }
    prevT = tt
    prevUp = up
    if (tt === tEnd) break
  }
  if (prevUp) close(tEnd, true)
  return passes
}

export interface TrackPoint {
  time: Date
  azRad: number
  elRad: number
}

/** Az/el samples between two times (e.g. a pass track for the sky plot). */
export function skyTrack(satrec: SatRec, o: Observer, from: Date, to: Date, stepS = 10): TrackPoint[] {
  const obsEcef = geodeticToEcefM(o)
  const out: TrackPoint[] = []
  for (let t = from.getTime(); t <= to.getTime(); t += stepS * 1000) {
    const look = lookAngles(satrec, o, new Date(t), obsEcef)
    if (look) out.push({ time: new Date(t), azRad: look.azRad, elRad: look.elRad })
  }
  return out
}

export interface GroundPoint {
  time: Date
  latRad: number
  lonRad: number
  altM: number
}

/** Sub-satellite points over an interval (e.g. one orbit for the globe). */
export function groundTrack(satrec: SatRec, from: Date, durationS: number, stepS = 30): GroundPoint[] {
  const out: GroundPoint[] = []
  const t0 = from.getTime()
  for (let t = t0; t <= t0 + durationS * 1000; t += stepS * 1000) {
    const s = stateAt(satrec, new Date(t))
    if (s) out.push({ time: new Date(t), latRad: s.latRad, lonRad: s.lonRad, altM: s.altM })
  }
  return out
}
