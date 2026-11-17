import { propagate, twoline2satrec } from 'satellite.js'
import { describe, expect, it } from 'vitest'
import { deg2rad, rad2deg } from '../units'
import { GOES19_OMM, ISS_OMM, NOTRE_DAME, VALLADO_00005 } from './fixtures'
import {
  classifyOrbit,
  epochOf,
  lookAngles,
  meanMotionRevPerDay,
  orbitalPeriodS,
  satrecFromOmm,
  stateAt,
} from './sgp4'

const nd = { latRad: deg2rad(NOTRE_DAME.latDeg), lonRad: deg2rad(NOTRE_DAME.lonDeg), altM: NOTRE_DAME.altM }

describe('SGP4 wrapper', () => {
  it('reproduces the Vallado verification vector for 00005 at epoch', () => {
    const rec = twoline2satrec(VALLADO_00005.line1, VALLADO_00005.line2)
    const pv = propagate(rec, epochOf(rec))
    expect(pv).not.toBeNull()
    const r = pv!.position
    // Epoch round-trip through a JS Date loses < 1 ms → < 10 m at 7 km/s.
    expect(Math.abs(r.x - VALLADO_00005.r0Km[0])).toBeLessThan(0.01)
    expect(Math.abs(r.y - VALLADO_00005.r0Km[1])).toBeLessThan(0.01)
    expect(Math.abs(r.z - VALLADO_00005.r0Km[2])).toBeLessThan(0.01)
    expect(pv!.velocity.x).toBeCloseTo(VALLADO_00005.v0Kms[0], 4)
  })

  it('parses the epoch of an OMM record', () => {
    const iss = satrecFromOmm(ISS_OMM)
    expect(Math.abs(epochOf(iss).getTime() - Date.parse('2026-11-10T04:12:02.822Z'))).toBeLessThan(5)
  })

  it('puts the ISS at ~420 km altitude, inside ±51.6° latitude', () => {
    const iss = satrecFromOmm(ISS_OMM)
    for (let h = 0; h < 6; h++) {
      const s = stateAt(iss, new Date(Date.parse('2026-11-10T06:00:00Z') + h * 900e3))!
      expect(s.altM).toBeGreaterThan(380e3)
      expect(s.altM).toBeLessThan(440e3)
      expect(Math.abs(rad2deg(s.latRad))).toBeLessThanOrEqual(51.7)
    }
  })

  it('range rate matches the finite difference of range', () => {
    const iss = satrecFromOmm(ISS_OMM)
    const t = Date.parse('2026-11-10T12:00:00Z')
    const a = lookAngles(iss, nd, new Date(t - 500))!
    const b = lookAngles(iss, nd, new Date(t + 500))!
    const mid = lookAngles(iss, nd, new Date(t))!
    expect(Math.abs(mid.rangeRateMps - (b.rangeM - a.rangeM) / 1)).toBeLessThan(1)
  })

  it('sees GOES-19 (75.2° W) from Notre Dame at a fixed az/el south of the zenith', () => {
    const goes = satrecFromOmm(GOES19_OMM)
    const a = lookAngles(goes, nd, new Date('2026-11-10T12:00:00Z'))!
    const b = lookAngles(goes, nd, new Date('2026-11-10T18:00:00Z'))!
    // Hand calculation for a GEO slot 11° east of an observer at 41.7° N:
    // central angle γ = acos(cos 41.7°·cos 11°) = 42.9°, el = atan((cos γ − R/r)/sin γ) ≈ 40.5°,
    // az = 180° − atan(tan 11° / sin 41.7°) ≈ 163.7°.
    expect(rad2deg(a.elRad)).toBeGreaterThan(38)
    expect(rad2deg(a.elRad)).toBeLessThan(43)
    expect(rad2deg(a.azRad)).toBeGreaterThan(160)
    expect(rad2deg(a.azRad)).toBeLessThan(170)
    expect(Math.abs(rad2deg(a.elRad - b.elRad))).toBeLessThan(0.1)
  })

  it('gives the ISS a ~93 min period and GEO a sidereal day', () => {
    expect(orbitalPeriodS(satrecFromOmm(ISS_OMM)) / 60).toBeCloseTo(92.9, 0)
    expect(orbitalPeriodS(satrecFromOmm(GOES19_OMM)) / 3600).toBeCloseTo(23.93, 1)
  })

  it('classifies orbits', () => {
    expect(classifyOrbit(meanMotionRevPerDay(satrecFromOmm(ISS_OMM)), 0.0007)).toBe('LEO')
    expect(classifyOrbit(meanMotionRevPerDay(satrecFromOmm(GOES19_OMM)), 0.0001)).toBe('GEO')
    expect(classifyOrbit(2.005, 0.01)).toBe('MEO') // GPS
    expect(classifyOrbit(2.006, 0.7)).toBe('HEO') // Molniya
  })
})
