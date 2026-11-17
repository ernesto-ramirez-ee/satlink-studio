// Pattern sampling and readouts (peak, HPBW, first sidelobe). Pure functions; the UI only plots.

import { toDb } from '../units'
import type { AntennaModel, Params } from './types'

/** Smallest dB value reported (avoids −∞ in nulls). */
export const DB_FLOOR = -200

const safeDb = (g: number): number => (g > 0 ? Math.max(toDb(g), DB_FLOOR) : DB_FLOOR)

/**
 * A principal-plane cut. `thetaRad` is signed and runs from −π to π: positive values lie in
 * the half-plane φ = phiRad, negative values in φ = phiRad + π.
 */
export interface PatternCut {
  phiRad: number
  thetaRad: number[]
  gainDbi: number[]
}

export const DEFAULT_CUT_STEP_RAD = (0.025 * Math.PI) / 180

export function sampleCut(
  model: AntennaModel,
  params: Params,
  freqHz: number,
  phiRad: number,
  stepRad = DEFAULT_CUT_STEP_RAD,
): PatternCut {
  const n = Math.round((2 * Math.PI) / stepRad)
  const step = (2 * Math.PI) / n
  const thetaRad: number[] = []
  const gainDbi: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI + i * step
    const g = t >= 0 ? model.gain(t, phiRad, params, freqHz) : model.gain(-t, phiRad + Math.PI, params, freqHz)
    thetaRad.push(t)
    gainDbi.push(safeDb(g))
  }
  return { phiRad, thetaRad, gainDbi }
}

/** Index of the maximum (the first one, if several are equal). */
function argMax(values: number[]): number {
  let best = 0
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i
  return best
}

/** Periodic accessor: the last sample of a cut repeats the first (θ = ±π). */
function periodic(cut: PatternCut): { m: number; at: (k: number) => number; step: number } {
  const m = cut.gainDbi.length - 1
  return {
    m,
    at: (k) => cut.gainDbi[((k % m) + m) % m],
    step: cut.thetaRad[1] - cut.thetaRad[0],
  }
}

/** Angle (signed, rad) of the main-lobe peak in the cut. */
export const peakAngleRad = (cut: PatternCut): number => cut.thetaRad[argMax(cut.gainDbi)]

/**
 * Half-power (−3 dB) beamwidth of the main lobe, in radians, by linear interpolation.
 * Returns null when the pattern never drops 3 dB below the peak (e.g. an omni cut).
 */
export function hpbwRad(cut: PatternCut): number | null {
  const { m, at, step } = periodic(cut)
  const i0 = argMax(cut.gainDbi)
  const half = at(i0) - 3
  const crossing = (dir: 1 | -1): number | null => {
    for (let k = 1; k < m / 2; k++) {
      const a = at(i0 + dir * (k - 1))
      const b = at(i0 + dir * k)
      if (b < half) return k - 1 + (a - half) / (a - b)
    }
    return null
  }
  const right = crossing(1)
  const left = crossing(-1)
  if (right === null || left === null) return null
  return (right + left) * step
}

/**
 * Level of the first sidelobe relative to the peak (dB, negative): the higher of the first
 * local maxima on either side of the main lobe. A lobe within 0.5 dB of the peak is a second
 * main lobe (a dipole's other side, a grating lobe) and is ignored. Null if there is none.
 */
export function firstSidelobeDb(cut: PatternCut): number | null {
  const { m, at } = periodic(cut)
  const i0 = argMax(cut.gainDbi)
  const peak = at(i0)
  const side = (dir: 1 | -1): number | null => {
    let k = 0
    // Walk down the main lobe to the first null.
    while (k < m / 2 && at(i0 + dir * (k + 1)) <= at(i0 + dir * k)) k++
    if (k >= m / 2) return null
    // Walk up to the next local maximum.
    while (k < m / 2 && at(i0 + dir * (k + 1)) >= at(i0 + dir * k)) k++
    const level = at(i0 + dir * k) - peak
    return level < -0.5 ? level : null
  }
  const levels = [side(1), side(-1)].filter((x): x is number => x !== null)
  return levels.length ? Math.max(...levels) : null
}

export interface PatternMetrics {
  peakGainDbi: number
  cuts: [PatternCut, PatternCut]
  hpbwRad: [number | null, number | null]
  firstSidelobeDb: number | null
}

export function patternMetrics(model: AntennaModel, params: Params, freqHz: number): PatternMetrics {
  const [phiA, phiB] = model.cutPhis(params)
  const cuts: [PatternCut, PatternCut] = [
    sampleCut(model, params, freqHz, phiA),
    sampleCut(model, params, freqHz, phiB),
  ]
  const sll = cuts.map(firstSidelobeDb).filter((x): x is number => x !== null)
  return {
    peakGainDbi: model.peakGainDbi(params, freqHz),
    cuts,
    hpbwRad: [hpbwRad(cuts[0]), hpbwRad(cuts[1])],
    firstSidelobeDb: sll.length ? Math.max(...sll) : null,
  }
}

/** Gain on a (θ, φ) grid for the 3D plot. θ is spaced quadratically: dense near boresight. */
export interface PatternSurface {
  thetaRad: number[]
  phiRad: number[]
  /** gainDbi[i][j] at thetaRad[i], phiRad[j]. */
  gainDbi: number[][]
}

export function sampleSurface(
  model: AntennaModel,
  params: Params,
  freqHz: number,
  nTheta = 121,
  nPhi = 73,
): PatternSurface {
  const thetaRad = Array.from({ length: nTheta }, (_, i) => Math.PI * (i / (nTheta - 1)) ** 2)
  const phiRad = Array.from({ length: nPhi }, (_, j) => (2 * Math.PI * j) / (nPhi - 1))
  const gainDbi = thetaRad.map((t) => phiRad.map((p) => safeDb(model.gain(t, p, params, freqHz))))
  return { thetaRad, phiRad, gainDbi }
}

/**
 * Converts a surface to x, y, z for plotting, with radius = (gain − (peak − rangeDb)) / rangeDb,
 * clamped at 0. +z is boresight.
 */
export function surfaceToXyz(
  s: PatternSurface,
  peakDbi: number,
  rangeDb = 40,
): { x: number[][]; y: number[][]; z: number[][] } {
  const floor = peakDbi - rangeDb
  const x: number[][] = []
  const y: number[][] = []
  const z: number[][] = []
  s.thetaRad.forEach((t, i) => {
    const xr: number[] = []
    const yr: number[] = []
    const zr: number[] = []
    s.phiRad.forEach((p, j) => {
      const r = Math.max(s.gainDbi[i][j] - floor, 0) / rangeDb
      xr.push(r * Math.sin(t) * Math.cos(p))
      yr.push(r * Math.sin(t) * Math.sin(p))
      zr.push(r * Math.cos(t))
    })
    x.push(xr)
    y.push(yr)
    z.push(zr)
  })
  return { x, y, z }
}
