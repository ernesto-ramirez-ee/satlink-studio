// WGS-84 geodesy and topocentric (ENU) look angles. Pure math, SI units, radians.
// Written independently of satellite.js so it can be tested against hand-computed cases.

export const WGS84_A_M = 6_378_137
export const WGS84_F = 1 / 298.257223563
const E2 = WGS84_F * (2 - WGS84_F)

/** Earth rotation rate (rad/s), IERS value. */
export const EARTH_ROTATION_RAD_S = 7.292115e-5

export interface Observer {
  latRad: number
  lonRad: number
  altM: number
}

export type Vec3 = { x: number; y: number; z: number }

export function geodeticToEcefM(o: Observer): Vec3 {
  const sinLat = Math.sin(o.latRad)
  const cosLat = Math.cos(o.latRad)
  const n = WGS84_A_M / Math.sqrt(1 - E2 * sinLat * sinLat)
  return {
    x: (n + o.altM) * cosLat * Math.cos(o.lonRad),
    y: (n + o.altM) * cosLat * Math.sin(o.lonRad),
    z: (n * (1 - E2) + o.altM) * sinLat,
  }
}

/** East, north, up components of an ECEF vector seen from the observer. */
export function ecefToEnu(o: Observer, d: Vec3): { e: number; n: number; u: number } {
  const sl = Math.sin(o.latRad)
  const cl = Math.cos(o.latRad)
  const so = Math.sin(o.lonRad)
  const co = Math.cos(o.lonRad)
  return {
    e: -so * d.x + co * d.y,
    n: -sl * co * d.x - sl * so * d.y + cl * d.z,
    u: cl * co * d.x + cl * so * d.y + sl * d.z,
  }
}

export interface TopoLook {
  /** Azimuth, clockwise from north, in [0, 2π). */
  azRad: number
  /** Elevation above the horizon. */
  elRad: number
  rangeM: number
}

/** Look angles from the observer to a point given in ECEF metres. */
export function lookFromEcef(o: Observer, targetEcefM: Vec3, observerEcefM = geodeticToEcefM(o)): TopoLook {
  const d = {
    x: targetEcefM.x - observerEcefM.x,
    y: targetEcefM.y - observerEcefM.y,
    z: targetEcefM.z - observerEcefM.z,
  }
  const { e, n, u } = ecefToEnu(o, d)
  const horiz = Math.hypot(e, n)
  let az = Math.atan2(e, n)
  if (az < 0) az += 2 * Math.PI
  return { azRad: az, elRad: Math.atan2(u, horiz), rangeM: Math.hypot(horiz, u) }
}
