import { describe, expect, it } from 'vitest'
import { deg2rad, rad2deg } from '../units'
import { GOES19_OMM, ISS_OMM, NOTRE_DAME } from './fixtures'
import { findPasses, skyTrack } from './passes'
import { lookAngles, satrecFromOmm } from './sgp4'

const nd = { latRad: deg2rad(NOTRE_DAME.latDeg), lonRad: deg2rad(NOTRE_DAME.lonDeg), altM: NOTRE_DAME.altM }
const start = new Date('2026-11-10T06:00:00Z')

describe('findPasses', () => {
  const iss = satrecFromOmm(ISS_OMM)
  const passes = findPasses(iss, nd, start, 24 * 3600)

  it('finds a plausible number of ISS passes in 24 h at 41.7° N', () => {
    expect(passes.length).toBeGreaterThanOrEqual(3)
    expect(passes.length).toBeLessThanOrEqual(8)
  })

  it('refines rise and set to the horizon and orders the times', () => {
    for (const p of passes) {
      expect(p.rise.getTime()).toBeLessThan(p.culmination.getTime())
      expect(p.culmination.getTime()).toBeLessThan(p.set.getTime())
      const durMin = (p.set.getTime() - p.rise.getTime()) / 60e3
      expect(durMin).toBeGreaterThan(0.5)
      expect(durMin).toBeLessThan(12)
      expect(Math.abs(rad2deg(lookAngles(iss, nd, p.rise)!.elRad))).toBeLessThan(0.05)
      expect(Math.abs(rad2deg(lookAngles(iss, nd, p.set)!.elRad))).toBeLessThan(0.05)
    }
  })

  it('reports the true maximum elevation', () => {
    for (const p of passes) {
      const t = p.culmination.getTime()
      expect(rad2deg(p.maxElRad)).toBeGreaterThan(0)
      for (const dt of [-20e3, 20e3]) {
        expect(lookAngles(iss, nd, new Date(t + dt))!.elRad).toBeLessThanOrEqual(p.maxElRad + 1e-6)
      }
    }
  })

  it('filters by minimum elevation', () => {
    const high = findPasses(iss, nd, start, 24 * 3600, deg2rad(30))
    expect(high.length).toBeLessThan(passes.length)
    for (const p of high) expect(rad2deg(p.maxElRad)).toBeGreaterThanOrEqual(30)
  })

  it('treats a visible GEO satellite as one pass clipped at both ends', () => {
    const goes = findPasses(satrecFromOmm(GOES19_OMM), nd, start, 6 * 3600)
    expect(goes).toHaveLength(1)
    expect(goes[0].riseClipped).toBe(true)
    expect(goes[0].setClipped).toBe(true)
  })

  it('samples a sky track above the horizon during a pass', () => {
    const p = passes[0]
    const track = skyTrack(iss, nd, p.rise, p.set, 10)
    expect(track.length).toBeGreaterThan(3)
    for (const pt of track.slice(1, -1)) expect(pt.elRad).toBeGreaterThan(0)
  })
})
