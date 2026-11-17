// Builds an AntennaModel from a power pattern F(θ, φ) and (optionally) a closed-form peak gain.
// gain(θ, φ) = G_peak · F(θ, φ) / F_max.

import { toDb } from '../units'
import { patternStats, type PatternStats } from './directivity'
import type { AntennaId, AntennaModel, InfoItem, ParamSpec, Params, Polarization } from './types'

export interface AntennaDefinition<P extends Params> {
  id: AntennaId
  label: string
  description: string
  polarization: Polarization
  defaults: P
  defaultFreqHz: number
  paramSpecs: ParamSpec[]
  /** Relative power pattern. Its maximum must be 1 unless `numericNormalize` is true. */
  pattern(thetaRad: number, phiRad: number, params: P, freqHz: number): number
  /** Closed-form linear peak gain. If omitted, the numerical directivity is used. */
  peakGain?(params: P, freqHz: number): number
  /** Find F_max (and the directivity) by integrating over a grid. */
  numericNormalize?: boolean
  /** Directions where the peak is known to lie, to help the numerical search. */
  peakHints?(params: P): [number, number][]
  cutPhis?(params: P): [number, number]
  info?(params: P, freqHz: number): InfoItem[]
  warnings?(params: P, freqHz: number): string[]
}

const CACHE_LIMIT = 32

export function defineAntenna<P extends Params>(def: AntennaDefinition<P>): AntennaModel<P> {
  const needsStats = def.numericNormalize === true || def.peakGain === undefined
  const cache = new Map<string, PatternStats>()
  let lastParams: P | undefined
  let lastFreq = Number.NaN
  let lastStats: PatternStats | undefined

  const stats = (p: P, f: number): PatternStats => {
    if (p === lastParams && f === lastFreq && lastStats) return lastStats
    const key = `${f}|${JSON.stringify(p)}`
    let s = cache.get(key)
    if (!s) {
      s = patternStats((t, ph) => def.pattern(t, ph, p, f), 360, 180, def.peakHints?.(p) ?? [])
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
      cache.set(key, s)
    }
    lastParams = p
    lastFreq = f
    lastStats = s
    return s
  }

  const peak = (p: P, f: number): number => (def.peakGain ? def.peakGain(p, f) : stats(p, f).directivity)
  const fMax = (p: P, f: number): number => (needsStats ? stats(p, f).fMax : 1)

  return {
    id: def.id,
    label: def.label,
    description: def.description,
    polarization: def.polarization,
    defaults: def.defaults,
    defaultFreqHz: def.defaultFreqHz,
    paramSpecs: def.paramSpecs,
    gain: (theta, phi, p, f) => (peak(p, f) * def.pattern(theta, phi, p, f)) / fMax(p, f),
    peakGainDbi: (p, f) => toDb(peak(p, f)),
    cutPhis: (p) => def.cutPhis?.(p) ?? [0, Math.PI / 2],
    info: (p, f) => def.info?.(p, f) ?? [],
    warnings: (p, f) => def.warnings?.(p, f) ?? [],
  }
}

/** Shared ParamSpec helper for angles stored in radians and shown in degrees. */
export const DEG = 180 / Math.PI
