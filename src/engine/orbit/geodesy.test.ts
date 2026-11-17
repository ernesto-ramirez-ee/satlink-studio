import { describe, expect, it } from 'vitest'
import { deg2rad, rad2deg } from '../units'
import { WGS84_A_M, geodeticToEcefM, lookFromEcef } from './geodesy'

const nd = { latRad: deg2rad(41.7002), lonRad: deg2rad(-86.2379), altM: 220 }

describe('geodesy', () => {
  it('puts the equator / prime meridian at (a, 0, 0)', () => {
    const p = geodeticToEcefM({ latRad: 0, lonRad: 0, altM: 0 })
    expect(p.x).toBeCloseTo(WGS84_A_M, 6)
    expect(p.y).toBeCloseTo(0, 6)
    expect(p.z).toBeCloseTo(0, 6)
  })

  it('gives the WGS-84 polar radius 6 356 752.314 m at the pole', () => {
    expect(geodeticToEcefM({ latRad: Math.PI / 2, lonRad: 0, altM: 0 }).z).toBeCloseTo(6_356_752.314, 2)
  })

  it('sees a point 500 km straight up at 90° elevation and 500 km range', () => {
    const up = geodeticToEcefM({ ...nd, altM: nd.altM + 500e3 })
    const look = lookFromEcef(nd, up)
    expect(rad2deg(look.elRad)).toBeCloseTo(90, 6)
    expect(look.rangeM).toBeCloseTo(500e3, 0)
  })

  it('measures azimuth clockwise from north', () => {
    const base = { latRad: 0, lonRad: 0, altM: 0 }
    const north = lookFromEcef(base, { x: WGS84_A_M, y: 0, z: 1000 })
    const east = lookFromEcef(base, { x: WGS84_A_M, y: 1000, z: 0 })
    const west = lookFromEcef(base, { x: WGS84_A_M, y: -1000, z: 0 })
    expect(rad2deg(north.azRad)).toBeCloseTo(0, 6)
    expect(rad2deg(east.azRad)).toBeCloseTo(90, 6)
    expect(rad2deg(west.azRad)).toBeCloseTo(270, 6)
    expect(rad2deg(east.elRad)).toBeCloseTo(0, 6)
  })
})
