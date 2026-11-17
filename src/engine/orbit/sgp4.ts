// SGP4 via satellite.js: OMM record → satrec → ECEF state, look angles and sub-satellite point.

import {
  eciToEcf,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  type OMMJsonObject,
  type SatRec,
} from 'satellite.js'
import { EARTH_ROTATION_RAD_S, geodeticToEcefM, lookFromEcef, type Observer, type Vec3 } from './geodesy'

export type { OMMJsonObject, SatRec }

/** Observer in display units (degrees), as stored in UI state. */
export interface ObserverDeg {
  latDeg: number
  lonDeg: number
  altM: number
}

export const observerFromDeg = (o: ObserverDeg): Observer => ({
  latRad: (o.latDeg * Math.PI) / 180,
  lonRad: (o.lonDeg * Math.PI) / 180,
  altM: o.altM,
})

export const satrecFromOmm = (omm: OMMJsonObject): SatRec => json2satrec(omm)

export interface SatState {
  /** Position in Earth-fixed coordinates (m). */
  posEcefM: Vec3
  /** Velocity relative to the rotating Earth (m/s). */
  velEcefMps: Vec3
  /** Sub-satellite point. */
  latRad: number
  lonRad: number
  altM: number
}

/** Satellite state at `date`, or null if SGP4 fails (decayed or bad elements). */
export function stateAt(satrec: SatRec, date: Date): SatState | null {
  const pv = propagate(satrec, date)
  if (!pv) return null
  const gmst = gstime(date)
  const pKm = eciToEcf(pv.position, gmst)
  const vKm = eciToEcf(pv.velocity, gmst)
  const geo = eciToGeodetic(pv.position, gmst)
  const pos = { x: pKm.x * 1000, y: pKm.y * 1000, z: pKm.z * 1000 }
  // Rotating-frame velocity: v_ecef = R·v_eci − ω × r_ecef.
  const w = EARTH_ROTATION_RAD_S
  return {
    posEcefM: pos,
    velEcefMps: { x: vKm.x * 1000 + w * pos.y, y: vKm.y * 1000 - w * pos.x, z: vKm.z * 1000 },
    latRad: geo.latitude,
    lonRad: geo.longitude,
    altM: geo.height * 1000,
  }
}

export interface LookAngles {
  azRad: number
  elRad: number
  rangeM: number
  /** Positive when the satellite moves away from the observer. */
  rangeRateMps: number
}

export function lookAnglesFromState(o: Observer, s: SatState, observerEcefM = geodeticToEcefM(o)): LookAngles {
  const look = lookFromEcef(o, s.posEcefM, observerEcefM)
  const d = {
    x: s.posEcefM.x - observerEcefM.x,
    y: s.posEcefM.y - observerEcefM.y,
    z: s.posEcefM.z - observerEcefM.z,
  }
  const rangeRate = (d.x * s.velEcefMps.x + d.y * s.velEcefMps.y + d.z * s.velEcefMps.z) / look.rangeM
  return { ...look, rangeRateMps: rangeRate }
}

/** Az/el/range/range-rate of a satellite from the observer at `date`, or null if SGP4 fails. */
export function lookAngles(satrec: SatRec, o: Observer, date: Date, observerEcefM?: Vec3): LookAngles | null {
  const s = stateAt(satrec, date)
  return s ? lookAnglesFromState(o, s, observerEcefM) : null
}

/** Element-set epoch as a Date. */
export const epochOf = (satrec: SatRec): Date => new Date((satrec.jdsatepoch - 2440587.5) * 86_400_000)

/** Orbital period in seconds (satrec.no is the mean motion in rad/min). */
export const orbitalPeriodS = (satrec: SatRec): number => ((2 * Math.PI) / satrec.no) * 60

/** Mean motion in revolutions per day (satrec.no is in rad/min). */
export const meanMotionRevPerDay = (satrec: SatRec): number => (satrec.no * 1440) / (2 * Math.PI)

export type OrbitClass = 'LEO' | 'MEO' | 'GEO' | 'HEO'

/**
 * LEO: period ≤ 128 min (n ≥ 11.25 rev/day). GEO: n ≈ 1 rev/day and near-circular.
 * HEO: eccentricity ≥ 0.25. Everything else is MEO.
 */
export function classifyOrbit(revPerDay: number, eccentricity: number): OrbitClass {
  if (eccentricity >= 0.25) return 'HEO'
  if (revPerDay >= 11.25) return 'LEO'
  if (revPerDay > 0.9 && revPerDay < 1.1) return 'GEO'
  return 'MEO'
}
