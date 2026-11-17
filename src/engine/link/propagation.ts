// Simplified propagation and noise terms. All tabulated values are ASSUMED approximations
// (stated in the UI and docs/PHYSICS.md), good to a fraction of a dB in clear sky.

import type { Polarization } from '../antennas/types'
import { fromDb, wavelength } from '../units'

/**
 * Clear-sky zenith gaseous attenuation (dB), stepped by band. Rough values read from the
 * ITU-R P.676 zenith-attenuation curves for a mid-latitude standard atmosphere.
 */
const ZENITH_LOSS_TABLE: readonly [maxFreqHz: number, lossDb: number][] = [
  [1e9, 0.03],
  [3e9, 0.04],
  [8e9, 0.05],
  [15e9, 0.15],
  [30e9, 0.5],
  [Infinity, 0.4],
]

export function zenithAtmLossDb(freqHz: number): number {
  for (const [maxF, loss] of ZENITH_LOSS_TABLE) if (freqHz <= maxF) return loss
  return ZENITH_LOSS_TABLE[ZENITH_LOSS_TABLE.length - 1][1]
}

export const MIN_ATM_ELEVATION_RAD = (5 * Math.PI) / 180

/** L_atm = L_zenith / sin(el), with el clamped at 5° (flat-Earth slab model breaks down below). */
export const atmLossDb = (freqHz: number, elRad: number): number =>
  zenithAtmLossDb(freqHz) / Math.sin(Math.max(elRad, MIN_ATM_ELEVATION_RAD))

/** Cold-sky galactic background, T ≈ 60·λ^2.55 K (λ in m): dominant at VHF, negligible above ~2 GHz. */
export const galacticTempK = (freqHz: number): number => 60 * wavelength(freqHz) ** 2.55

/** Sky noise from atmospheric absorption at zenith: T = 290·(1 − 10^(−L/10)). */
export const atmosphericSkyTempK = (freqHz: number): number => 290 * (1 - fromDb(-zenithAtmLossDb(freqHz)))

/** Receiver (LNA) noise temperature from its noise figure: T = 290·(10^(NF/10) − 1). */
export const receiverTempK = (noiseFigureDb: number): number => 290 * (fromDb(noiseFigureDb) - 1)

/** T_sys = T_sky (galactic + atmosphere) + T_ground (pickup, per antenna) + T_receiver. */
export const systemTempK = (freqHz: number, groundPickupK: number, noiseFigureDb: number): number =>
  galacticTempK(freqHz) + atmosphericSkyTempK(freqHz) + groundPickupK + receiverTempK(noiseFigureDb)

/** Assumed cross-polar isolation between opposite circular senses. */
export const CROSS_POL_LOSS_DB = 20

/**
 * Polarization mismatch loss (dB): same circular sense 0; opposite sense 20 (assumed);
 * linear ↔ circular 3.01; linear ↔ linear 3 (average over unknown orientation and
 * Faraday rotation, docs/PHYSICS.md).
 */
export function polLossDb(tx: Polarization, rx: Polarization): number {
  const circ = (p: Polarization) => p !== 'linear'
  if (circ(tx) && circ(rx)) return tx === rx ? 0 : CROSS_POL_LOSS_DB
  if (circ(tx) !== circ(rx)) return 3.01
  return 3
}

/** Pointing loss of a beam off by `errRad`, parabolic main-lobe approximation, capped at 30 dB. */
export const pointingLossDb = (errRad: number, hpbwRad: number): number =>
  Math.min(12 * (errRad / hpbwRad) ** 2, 30)
