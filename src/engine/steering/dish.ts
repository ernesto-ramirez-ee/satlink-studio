// Mechanical (az/el) pointing: commands, slew rates, Doppler and the zenith keyhole.

import type { Observer, Vec3 } from '../orbit/geodesy'
import { geodeticToEcefM } from '../orbit/geodesy'
import type { Pass } from '../orbit/passes'
import { lookAngles, type SatRec } from '../orbit/sgp4'
import { C } from '../units'

/** Δf = −(ṙ / c)·f. Positive when the satellite approaches (ṙ < 0). */
export const dopplerShiftHz = (freqHz: number, rangeRateMps: number): number => (-rangeRateMps / C) * freqHz

/** Wraps an angle difference to (−π, π]. */
export function wrapPi(a: number): number {
  let x = a % (2 * Math.PI)
  if (x <= -Math.PI) x += 2 * Math.PI
  if (x > Math.PI) x -= 2 * Math.PI
  return x
}

export interface DishCommand {
  azRad: number
  elRad: number
  /** Azimuth rate (rad/s), sign = direction of travel (clockwise positive). */
  azRateRadS: number
  elRateRadS: number
  rangeM: number
  rangeRateMps: number
}

/** Az/el command and slew rates at `date`, by central difference over ±dtS. */
export function dishCommand(satrec: SatRec, o: Observer, date: Date, dtS = 0.5, obsEcef?: Vec3): DishCommand | null {
  const ecef = obsEcef ?? geodeticToEcefM(o)
  const t = date.getTime()
  const a = lookAngles(satrec, o, new Date(t - dtS * 1000), ecef)
  const m = lookAngles(satrec, o, date, ecef)
  const b = lookAngles(satrec, o, new Date(t + dtS * 1000), ecef)
  if (!a || !m || !b) return null
  return {
    azRad: m.azRad,
    elRad: m.elRad,
    azRateRadS: wrapPi(b.azRad - a.azRad) / (2 * dtS),
    elRateRadS: (b.elRad - a.elRad) / (2 * dtS),
    rangeM: m.rangeM,
    rangeRateMps: m.rangeRateMps,
  }
}

/** Typical TLE position error near epoch (docs/PHYSICS.md: ~1 km). */
export const TLE_POSITION_ERROR_M = 1000

/** Pointing error caused by a position error `errorM` at slant range `rangeM`. */
export const tleAngularErrorRad = (rangeM: number, errorM = TLE_POSITION_ERROR_M): number => Math.atan(errorM / rangeM)

/** Assumed maximum slew rate of an amateur az/el rotator. */
export const ROTATOR_MAX_RATE_RAD_S = (5 * Math.PI) / 180

/** Above this predicted maximum elevation an az/el mount hits the keyhole (azimuth rate blows up). */
export const KEYHOLE_EL_RAD = (85 * Math.PI) / 180

export const isKeyholePass = (p: Pass): boolean => p.maxElRad > KEYHOLE_EL_RAD

/** Peak |az rate| and |el rate| during a pass (rad/s), sampled every `stepS`. */
export function passPeakRates(satrec: SatRec, o: Observer, p: Pass, stepS = 2): { azRateRadS: number; elRateRadS: number } {
  const ecef = geodeticToEcefM(o)
  let az = 0
  let el = 0
  for (let t = p.rise.getTime(); t <= p.set.getTime(); t += stepS * 1000) {
    const c = dishCommand(satrec, o, new Date(t), 0.5, ecef)
    if (!c) continue
    az = Math.max(az, Math.abs(c.azRateRadS))
    el = Math.max(el, Math.abs(c.elRateRadS))
  }
  return { azRateRadS: az, elRateRadS: el }
}
