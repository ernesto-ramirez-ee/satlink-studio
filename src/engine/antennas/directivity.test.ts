import { describe, expect, it } from 'vitest'
import { toDb } from '../units'
import { halfWaveDipolePower } from './dipole'
import { patternStats } from './directivity'

describe('patternStats', () => {
  it('gives directivity 1 (0 dBi) for an isotropic pattern', () => {
    expect(patternStats(() => 1).directivity).toBeCloseTo(1, 4)
  })

  it('gives 1.5 (1.76 dBi) for a short dipole, sin²θ', () => {
    expect(patternStats((t) => Math.sin(t) ** 2).directivity).toBeCloseTo(1.5, 3)
  })

  it('gives 2.15 dBi for a half-wave dipole (Balanis)', () => {
    const d = patternStats((t) => halfWaveDipolePower(Math.cos(t))).directivity
    expect(toDb(d)).toBeCloseTo(2.15, 1)
  })
})
