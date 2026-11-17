// Link margin vs. time over a pass for every antenna, and the antenna recommendation.

import type { AntennaId, AntennaModel, Params, Polarization } from '../antennas/types'
import { geodeticToEcefM, type Observer } from '../orbit/geodesy'
import { lookAngles, type SatRec } from '../orbit/sgp4'
import { linkBudget } from './budget'
import { atmLossDb, polLossDb, systemTempK } from './propagation'
import { gainTowardDbi, practicality, receiveContext } from './receive'

export interface Downlink {
  label: string
  freqHz: number
  polarization: Polarization
  eirpDbw: number
  /**
   * Optional EIRP (dBW) vs. ground elevation (degrees, ascending), for satellites with shaped
   * (isoflux) antennas. Linearly interpolated and clamped; overrides `eirpDbw` when present.
   */
  eirpByElevationDeg?: [number, number][]
  dataRateBps: number
  requiredEbN0Db: number
}

/** Satellite EIRP toward a ground station at elevation `elRad` (dBW). */
export function eirpAt(d: Downlink, elRad: number): number {
  const t = d.eirpByElevationDeg
  if (!t || t.length === 0) return d.eirpDbw
  const el = (elRad * 180) / Math.PI
  if (el <= t[0][0]) return t[0][1]
  for (let i = 1; i < t.length; i++) {
    if (el <= t[i][0]) {
      const [e0, p0] = t[i - 1]
      const [e1, p1] = t[i]
      return p0 + ((el - e0) / (e1 - e0)) * (p1 - p0)
    }
  }
  return t[t.length - 1][1]
}

export interface AntennaChoice {
  model: AntennaModel
  params: Params
}

export interface AntennaSeries {
  antennaId: AntennaId
  label: string
  complexityRank: number
  mountLabel: string
  practical: boolean
  impracticalReason: string
  tSysK: number
  polLossDb: number
  marginDb: number[]
  gainDbi: number[]
}

export interface MarginTimeline {
  times: Date[]
  elRad: number[]
  azRad: number[]
  rangeM: number[]
  fsplDb: number[]
  series: AntennaSeries[]
}

export function marginTimeline(
  satrec: SatRec,
  observer: Observer,
  from: Date,
  to: Date,
  downlink: Downlink,
  antennas: AntennaChoice[],
  noiseFigureDb: number,
  maxSamples = 240,
): MarginTimeline {
  const obsEcef = geodeticToEcefM(observer)
  const t0 = from.getTime()
  const span = Math.max(to.getTime() - t0, 1000)
  const stepMs = Math.max(5000, span / maxSamples)
  const times: Date[] = []
  const elRad: number[] = []
  const azRad: number[] = []
  const rangeM: number[] = []
  for (let t = t0; t <= t0 + span + 1; t += stepMs) {
    const look = lookAngles(satrec, observer, new Date(t), obsEcef)
    if (!look) continue
    times.push(new Date(t))
    elRad.push(look.elRad)
    azRad.push(look.azRad)
    rangeM.push(look.rangeM)
  }

  let fsplDb: number[] = []
  const series = antennas.map(({ model, params }): AntennaSeries => {
    const ctx = receiveContext(model, params, downlink.freqHz)
    const prac = practicality(model, ctx.params, downlink.freqHz)
    const tSysK = systemTempK(downlink.freqHz, ctx.setup.groundPickupK, noiseFigureDb)
    const pol = polLossDb(downlink.polarization, model.polarization)
    const marginDb: number[] = []
    const gainDbi: number[] = []
    const fs: number[] = []
    for (let i = 0; i < times.length; i++) {
      const g = gainTowardDbi(ctx, azRad[i], elRad[i])
      const r = linkBudget({
        eirpDbw: eirpAt(downlink, elRad[i]),
        freqHz: downlink.freqHz,
        rangeM: rangeM[i],
        rxGainDbi: g.gainDbi,
        tSysK,
        atmLossDb: atmLossDb(downlink.freqHz, elRad[i]),
        polLossDb: pol,
        pointingLossDb: 0, // already inside gainDbi
        dataRateBps: downlink.dataRateBps,
        requiredEbN0Db: downlink.requiredEbN0Db,
      })
      marginDb.push(r.marginDb)
      gainDbi.push(g.gainDbi)
      fs.push(r.fsplDb)
    }
    fsplDb = fs
    return {
      antennaId: model.id,
      label: model.label,
      complexityRank: ctx.setup.complexityRank,
      mountLabel: ctx.setup.mountLabel,
      practical: prac.ok,
      impracticalReason: prac.reason,
      tSysK,
      polLossDb: pol,
      marginDb,
      gainDbi,
    }
  })
  return { times, elRad, azRad, rangeM, fsplDb, series }
}

/** Contiguous time intervals where `marginDb` is below `thresholdDb` (for shading failures). */
export function failureIntervals(times: Date[], marginDb: number[], thresholdDb = 0): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = []
  let start: Date | null = null
  for (let i = 0; i < times.length; i++) {
    const bad = marginDb[i] < thresholdDb
    if (bad && !start) start = times[i]
    if (!bad && start) {
      out.push({ start, end: times[i] })
      start = null
    }
  }
  if (start) out.push({ start, end: times[times.length - 1] })
  return out
}

export const MIN_ELEVATION_FOR_RECOMMENDATION_RAD = (10 * Math.PI) / 180
export const REQUIRED_MARGIN_DB = 3

export interface AntennaVerdict {
  antennaId: AntennaId
  label: string
  /** Worst margin while the satellite is above 10° (null if it never is). */
  minMarginDb: number | null
  /** Elevation where the worst margin occurs (rad). */
  worstElRad: number | null
  passes: boolean
  practical: boolean
  impracticalReason: string
}

export interface Recommendation {
  best: AntennaVerdict | null
  runnerUp: AntennaVerdict | null
  /** Simpler practical antennas that failed, for the explanation. */
  simplerFailures: AntennaVerdict[]
  verdicts: AntennaVerdict[]
  reason: string
}

/**
 * Rule (docs/PHYSICS.md): among antennas practical for the band, choose the one with the lowest
 * complexity that keeps margin ≥ 3 dB for the whole pass above 10° elevation.
 */
export function recommend(
  tl: MarginTimeline,
  minElRad = MIN_ELEVATION_FOR_RECOMMENDATION_RAD,
  requiredMarginDb = REQUIRED_MARGIN_DB,
): Recommendation {
  const idx = tl.elRad.map((e, i) => (e >= minElRad ? i : -1)).filter((i) => i >= 0)
  const verdicts = [...tl.series]
    .sort((a, b) => a.complexityRank - b.complexityRank)
    .map((s): AntennaVerdict => {
      let min: number | null = null
      let worstEl: number | null = null
      for (const i of idx) {
        if (min === null || s.marginDb[i] < min) {
          min = s.marginDb[i]
          worstEl = tl.elRad[i]
        }
      }
      return {
        antennaId: s.antennaId,
        label: s.label,
        minMarginDb: min,
        worstElRad: worstEl,
        passes: s.practical && min !== null && min >= requiredMarginDb,
        practical: s.practical,
        impracticalReason: s.impracticalReason,
      }
    })

  const deg = (r: number | null) => (r === null ? '—' : `${((r * 180) / Math.PI).toFixed(0)}°`)
  if (idx.length === 0) {
    return { best: null, runnerUp: null, simplerFailures: [], verdicts, reason: 'This pass never rises above 10°, so no antenna is recommended.' }
  }
  const passing = verdicts.filter((v) => v.passes)
  const best = passing[0] ?? null
  const runnerUp = passing[1] ?? null
  if (!best) {
    const practical = verdicts.filter((v) => v.practical && v.minMarginDb !== null)
    const closest = practical.sort((a, b) => (b.minMarginDb ?? -Infinity) - (a.minMarginDb ?? -Infinity))[0]
    return {
      best: null,
      runnerUp: null,
      simplerFailures: [],
      verdicts,
      reason: closest
        ? `No practical antenna keeps ≥ ${requiredMarginDb} dB above 10°. Closest: ${closest.label}, worst margin ${closest.minMarginDb!.toFixed(1)} dB at ${deg(closest.worstElRad)} elevation.`
        : 'No practical antenna for this band.',
    }
  }
  // verdicts are sorted simplest first, so "simpler" means earlier in the list.
  const simplerFailures = verdicts.slice(0, verdicts.indexOf(best)).filter((v) => v.practical && !v.passes)
  return {
    best,
    runnerUp,
    simplerFailures,
    verdicts,
    reason: `Simplest practical antenna that keeps ≥ ${requiredMarginDb} dB margin for the whole pass above 10°: worst case ${best.minMarginDb!.toFixed(1)} dB at ${deg(best.worstElRad)} elevation.`,
  }
}
