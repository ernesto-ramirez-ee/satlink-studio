import { describe, expect, it } from 'vitest'
import { getAntenna } from '../antennas'
import { deg2rad, rad2deg } from '../units'
import { gainTowardDbi, practicality, receiveContext, skyToAntennaFrame } from './receive'

const ctx = (id: Parameters<typeof getAntenna>[0], freqHz: number) => {
  const m = getAntenna(id)
  return receiveContext(m, m.defaults, freqHz)
}

describe('receive gain toward a satellite', () => {
  it('maps zenith to boresight and the eastern horizon to φ = 0', () => {
    expect(skyToAntennaFrame(0, deg2rad(90)).theta).toBeCloseTo(0, 12)
    const east = skyToAntennaFrame(deg2rad(90), 0)
    expect(rad2deg(east.theta)).toBeCloseTo(90, 10)
    expect(rad2deg(east.phi)).toBeCloseTo(0, 10)
  })

  it('gives a zenith-facing QFH its peak overhead and −3 dB at the horizon', () => {
    const c = ctx('qfh', 137.9e6)
    expect(gainTowardDbi(c, 0, deg2rad(90)).gainDbi).toBeCloseTo(c.peakGainDbi, 3)
    expect(c.peakGainDbi - gainTowardDbi(c, 0, deg2rad(0.001)).gainDbi).toBeCloseTo(3.01, 1)
  })

  it('gives a vertical monopole its peak at the horizon and a null overhead', () => {
    const c = ctx('monopole', 437e6)
    expect(gainTowardDbi(c, deg2rad(45), deg2rad(0.01)).gainDbi).toBeCloseTo(5.15, 1)
    expect(gainTowardDbi(c, 0, deg2rad(89.9)).gainDbi).toBeLessThan(-20)
  })

  it('keeps a tracked dish at its peak minus a small pointing loss', () => {
    const c = ctx('dish', 12e9)
    const g = gainTowardDbi(c, deg2rad(200), deg2rad(30))
    // 0.2° error on a ~1.8° beam: 12·(0.2/1.8)² ≈ 0.15 dB
    expect(g.pointingLossDb).toBeGreaterThan(0.1)
    expect(g.pointingLossDb).toBeLessThan(0.2)
    expect(g.gainDbi).toBeCloseTo(c.peakGainDbi - g.pointingLossDb, 10)
  })

  it('applies cos^1.2 scan loss to the phased array, and falls off beyond 60° scan', () => {
    const c = ctx('phased-array', 11.7e9)
    const at30el = gainTowardDbi(c, 0, deg2rad(30)) // θ = 60°, at the scan limit
    expect(c.peakGainDbi - at30el.gainDbi).toBeCloseTo(-12 * Math.log10(0.5), 2) // 3.61 dB
    const at10el = gainTowardDbi(c, 0, deg2rad(10))
    expect(at10el.gainDbi).toBeLessThan(at30el.gainDbi - 3)
  })
})

describe('practicality', () => {
  it('rejects a 1 m dish at 137 MHz but accepts it at 1.7 GHz (GOES HRIT) and 12 GHz', () => {
    const dish = getAntenna('dish')
    expect(practicality(dish, dish.defaults, 137.9e6).ok).toBe(false)
    expect(practicality(dish, dish.defaults, 1.6941e9).ok).toBe(true)
    expect(practicality(dish, dish.defaults, 12e9).ok).toBe(true)
  })

  it('rejects a VHF phased array (panel metres wide)', () => {
    const arr = getAntenna('phased-array')
    expect(practicality(arr, arr.defaults, 137.9e6).ok).toBe(false)
    expect(practicality(arr, arr.defaults, 11.7e9).ok).toBe(true)
  })

  it('rejects dipoles above 3 GHz', () => {
    const d = getAntenna('dipole')
    expect(practicality(d, d.defaults, 12e9).ok).toBe(false)
  })
})
