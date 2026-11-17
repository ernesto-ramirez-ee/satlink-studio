// Data for the 3D pass animation: satellite position and look angles over a time window, and the
// phased array's steered lobe. No graphics here; the UI turns these into a three.js scene.

import { arrayPattern, type PhasedArrayParams } from '../antennas/phasedArray'
import type { PatternSurface } from '../antennas/metrics'
import { geodeticToEcefM, type Observer } from '../orbit/geodesy'
import { lookAnglesFromState, stateAt, type SatRec } from '../orbit/sgp4'
import { toDb } from '../units'
import type { BeamHopSchedule, HopCandidate } from './beamhop'

export interface PassFrame {
  time: Date
  /** Sub-satellite point and altitude. */
  latRad: number
  lonRad: number
  altM: number
  azRad: number
  elRad: number
  rangeM: number
  rangeRateMps: number
  /** Above the observer's horizon. */
  visible: boolean
  /** Which continuous track this frame belongs to (changes at beam-hop hand-overs). */
  trackId?: number
  /** Name of the satellite in this frame, when it varies (beam-hop). */
  label?: string
  /** No satellite to show (beam-hop outage). */
  hidden?: boolean
}

/** Frames every `stepS` seconds from `from` to `to` (inclusive). Failed propagations are skipped. */
export function passFrames(satrec: SatRec, o: Observer, from: Date, to: Date, stepS = 5): PassFrame[] {
  const obsEcef = geodeticToEcefM(o)
  const out: PassFrame[] = []
  for (let t = from.getTime(); t <= to.getTime(); t += stepS * 1000) {
    const s = stateAt(satrec, new Date(t))
    if (!s) continue
    const l = lookAnglesFromState(o, s, obsEcef)
    out.push({
      time: new Date(t),
      latRad: s.latRad,
      lonRad: s.lonRad,
      altM: s.altM,
      azRad: l.azRad,
      elRad: l.elRad,
      rangeM: l.rangeM,
      rangeRateMps: l.rangeRateMps,
      visible: l.elRad > 0,
    })
  }
  return out
}

/**
 * Frames for animating a beam-hop schedule: at each sample, the serving satellite's position and
 * look angles. `trackId` increases at every hand-over so the drawn track can break there; during an
 * outage the frame is `hidden`.
 */
export function beamHopFrames(schedule: BeamHopSchedule, cands: readonly HopCandidate[], o: Observer): PassFrame[] {
  const byId = new Map(cands.map((c) => [c.noradId, c]))
  const obsEcef = geodeticToEcefM(o)
  const out: PassFrame[] = []
  let trackId = -1
  let lastId: number | null | undefined
  let last: PassFrame | null = null
  for (const s of schedule.samples) {
    if (s.noradId !== lastId) {
      trackId++
      lastId = s.noradId
    }
    const c = s.noradId !== null ? byId.get(s.noradId) : undefined
    const st = c ? stateAt(c.satrec, s.time) : null
    if (!c || !st) {
      const base: PassFrame = last ?? { time: s.time, latRad: 0, lonRad: 0, altM: 0, azRad: 0, elRad: -Math.PI / 2, rangeM: 1, rangeRateMps: 0, visible: false }
      out.push({ ...base, time: s.time, visible: false, hidden: true, trackId, label: undefined })
      continue
    }
    const l = lookAnglesFromState(o, st, obsEcef)
    last = {
      time: s.time,
      latRad: st.latRad,
      lonRad: st.lonRad,
      altM: st.altM,
      azRad: l.azRad,
      elRad: l.elRad,
      rangeM: l.rangeM,
      rangeRateMps: l.rangeRateMps,
      visible: l.elRad > 0,
      trackId,
      label: c.name,
    }
    out.push(last)
  }
  return out
}

/** Frame indices where a new track starts (hand-overs), excluding the first frame. */
export const trackStarts = (frames: readonly PassFrame[]): number[] =>
  frames.flatMap((f, i) => (i > 0 && f.trackId !== frames[i - 1].trackId ? [i] : []))

/** Index of the frame closest to `t` (frames must be time-ordered). */
export function nearestFrame(frames: readonly PassFrame[], t: Date): number {
  if (frames.length === 0) return -1
  const t0 = frames[0].time.getTime()
  const step = frames.length > 1 ? frames[1].time.getTime() - t0 : 1
  return Math.min(frames.length - 1, Math.max(0, Math.round((t.getTime() - t0) / step)))
}

export type ArrayLobeParams = Pick<PhasedArrayParams, 'nx' | 'ny' | 'dxLambda' | 'dyLambda' | 'taper'>

/**
 * The phased array's power pattern steered to (θ0, φ0), in dB relative to the broadside peak, over
 * the upper hemisphere (panel frame: z up). Its maximum is −(scan loss), so the lobe visibly
 * shrinks as it is steered away from zenith.
 */
export function arrayLobeSurface(
  p: ArrayLobeParams,
  theta0Rad: number,
  phi0Rad: number,
  nTheta = 46,
  nPhi = 73,
): PatternSurface {
  const params: PhasedArrayParams = { ...p, scanThetaRad: theta0Rad, scanPhiRad: phi0Rad }
  const thetaRad = Array.from({ length: nTheta }, (_, i) => (Math.PI / 2) * (i / (nTheta - 1)))
  const phiRad = Array.from({ length: nPhi }, (_, j) => (2 * Math.PI * j) / (nPhi - 1))
  const gainDbi = thetaRad.map((t) =>
    phiRad.map((ph) => {
      const f = arrayPattern(t, ph, params)
      return f > 0 ? Math.max(toDb(f), -200) : -200
    }),
  )
  return { thetaRad, phiRad, gainDbi }
}
