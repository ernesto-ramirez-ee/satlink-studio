import { describe, expect, it } from 'vitest'
import { deg2rad } from '../units'
import {
  atmLossDb,
  galacticTempK,
  pointingLossDb,
  polLossDb,
  receiverTempK,
  systemTempK,
  zenithAtmLossDb,
} from './propagation'

describe('propagation and noise', () => {
  it('scales atmospheric loss as 1/sin(el), clamped at 5°', () => {
    const z = zenithAtmLossDb(12e9)
    expect(atmLossDb(12e9, deg2rad(90))).toBeCloseTo(z, 10)
    expect(atmLossDb(12e9, deg2rad(30))).toBeCloseTo(2 * z, 10)
    expect(atmLossDb(12e9, deg2rad(1))).toBeCloseTo(atmLossDb(12e9, deg2rad(5)), 10)
  })

  it('grows zenith attenuation from VHF to Ka band', () => {
    expect(zenithAtmLossDb(137e6)).toBeLessThan(zenithAtmLossDb(12e9))
    expect(zenithAtmLossDb(12e9)).toBeLessThan(zenithAtmLossDb(20e9))
  })

  it('converts noise figure to temperature: 3.01 dB → 290 K, 0 dB → 0 K', () => {
    expect(receiverTempK(3.0103)).toBeCloseTo(290, 1)
    expect(receiverTempK(0)).toBeCloseTo(0, 10)
  })

  it('has a few hundred K of galactic noise at 137 MHz and almost none at 12 GHz', () => {
    expect(galacticTempK(137e6)).toBeGreaterThan(300)
    expect(galacticTempK(137e6)).toBeLessThan(600)
    expect(galacticTempK(12e9)).toBeLessThan(0.1)
    expect(systemTempK(137e6, 60, 1)).toBeGreaterThan(systemTempK(12e9, 60, 1))
  })

  it('applies polarization mismatch losses', () => {
    expect(polLossDb('rhcp', 'rhcp')).toBe(0)
    expect(polLossDb('rhcp', 'lhcp')).toBe(20)
    expect(polLossDb('rhcp', 'linear')).toBeCloseTo(3.01, 2)
    expect(polLossDb('linear', 'rhcp')).toBeCloseTo(3.01, 2)
    expect(polLossDb('linear', 'linear')).toBe(3)
  })

  it('loses 3 dB when pointed off by half the beamwidth', () => {
    expect(pointingLossDb(deg2rad(1), deg2rad(2))).toBeCloseTo(3, 10)
    expect(pointingLossDb(deg2rad(50), deg2rad(2))).toBe(30)
  })
})
