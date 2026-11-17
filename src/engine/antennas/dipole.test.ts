import { describe, expect, it } from 'vitest'
import { deg2rad, toDb } from '../units'
import { dipole } from './dipole'
import { hpbwRad, sampleCut } from './metrics'

const f = dipole.defaultFreqHz

describe('half-wave dipole', () => {
  it('has a peak gain of 2.15 dBi', () => {
    expect(Math.abs(dipole.peakGainDbi(dipole.defaults, f) - 2.15)).toBeLessThan(0.5)
    expect(toDb(dipole.gain(Math.PI / 2, 0, dipole.defaults, f))).toBeCloseTo(2.15, 1)
  })

  it('has nulls along the wire axis', () => {
    expect(dipole.gain(0, 0, dipole.defaults, f)).toBe(0)
  })

  it('has a 78° half-power beamwidth', () => {
    const hpbw = hpbwRad(sampleCut(dipole, dipole.defaults, f, 0))
    expect(hpbw).not.toBeNull()
    expect(hpbw! * (180 / Math.PI)).toBeCloseTo(78, 0)
  })

  it('moves the null when tilted', () => {
    const tilted = { tiltRad: deg2rad(90) }
    expect(dipole.gain(Math.PI / 2, 0, tilted, f)).toBeCloseTo(0, 10)
    expect(toDb(dipole.gain(0, 0, tilted, f))).toBeCloseTo(2.15, 1)
  })
})
