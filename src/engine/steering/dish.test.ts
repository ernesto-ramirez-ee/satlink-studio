import { describe, expect, it } from 'vitest'
import { findPasses, observerFromDeg, satrecFromOmm } from '../orbit'
import { GOES19_OMM, ISS_OMM, NOTRE_DAME } from '../orbit/fixtures'
import { deg2rad, rad2deg } from '../units'
import { dishCommand, dopplerShiftHz, isKeyholePass, passPeakRates, tleAngularErrorRad, wrapPi } from './dish'

const nd = observerFromDeg(NOTRE_DAME)

describe('Doppler', () => {
  it('gives +3.40 kHz at 145.8 MHz for a satellite approaching at 7 km/s', () => {
    expect(dopplerShiftHz(145.8e6, -7000)).toBeCloseTo(3404.4, 0)
    expect(dopplerShiftHz(145.8e6, 7000)).toBeCloseTo(-3404.4, 0)
  })
})

describe('TLE pointing error', () => {
  it('is ~0.11° for 1 km at 500 km range and ~0.0016° at GEO', () => {
    expect(rad2deg(tleAngularErrorRad(500e3))).toBeCloseTo(0.1146, 3)
    expect(rad2deg(tleAngularErrorRad(36_000e3))).toBeLessThan(0.002)
  })
})

describe('dish pointing', () => {
  it('wraps azimuth differences across north', () => {
    expect(rad2deg(wrapPi(deg2rad(359) - deg2rad(1)))).toBeCloseTo(-2, 10)
    expect(rad2deg(wrapPi(deg2rad(1) - deg2rad(359)))).toBeCloseTo(2, 10)
  })

  it('barely moves for a GEO satellite', () => {
    const c = dishCommand(satrecFromOmm(GOES19_OMM), nd, new Date('2026-11-10T12:00:00Z'))!
    expect(Math.abs(rad2deg(c.azRateRadS))).toBeLessThan(0.001)
    expect(Math.abs(rad2deg(c.elRateRadS))).toBeLessThan(0.001)
  })

  it('has its fastest elevation rate at mid-pass and sees the range rate change sign', () => {
    const iss = satrecFromOmm(ISS_OMM)
    const p = findPasses(iss, nd, new Date('2026-11-10T06:00:00Z'), 86400, deg2rad(40))[0]
    const early = dishCommand(iss, nd, new Date(p.rise.getTime() + 60e3))!
    const late = dishCommand(iss, nd, new Date(p.set.getTime() - 60e3))!
    expect(early.rangeRateMps).toBeLessThan(0)
    expect(late.rangeRateMps).toBeGreaterThan(0)
    expect(early.elRateRadS).toBeGreaterThan(0)
    expect(late.elRateRadS).toBeLessThan(0)
  })

  it('flags the ~87° ISS pass as a keyhole pass with a fast azimuth slew', () => {
    const iss = satrecFromOmm(ISS_OMM)
    const passes = findPasses(iss, nd, new Date('2026-11-10T00:00:00Z'), 86400, 0)
    const high = passes.find((p) => rad2deg(p.maxElRad) > 85)!
    const low = passes.find((p) => rad2deg(p.maxElRad) < 30)!
    expect(isKeyholePass(high)).toBe(true)
    expect(isKeyholePass(low)).toBe(false)
    // Near zenith the azimuth must swing ~180° in seconds: far above a ~5°/s rotator.
    expect(rad2deg(passPeakRates(iss, nd, high).azRateRadS)).toBeGreaterThan(5)
    expect(rad2deg(passPeakRates(iss, nd, low).azRateRadS)).toBeLessThan(2)
  })
})
