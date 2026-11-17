import { describe, expect, it } from 'vitest'
import { rad2deg, wavelength } from '../units'
import { DISH_TAPER_PARABOLIC, DISH_TAPER_UNIFORM, dish } from './dish'
import { firstSidelobeDb, hpbwRad, sampleCut } from './metrics'

const f = 12e9
const uniform = { diameterM: 1, efficiency: 0.6, taper: DISH_TAPER_UNIFORM }
const tapered = { diameterM: 1, efficiency: 0.6, taper: DISH_TAPER_PARABOLIC }
const lambdaOverD = wavelength(f) / 1

describe('parabolic dish', () => {
  it('has G = η(πD/λ)² ≈ 39.8 dBi for 1 m at 12 GHz, η = 0.6', () => {
    expect(dish.peakGainDbi(uniform, f)).toBeCloseTo(39.8, 1)
    expect(dish.peakGainDbi(tapered, f)).toBeCloseTo(39.8, 1)
  })

  it('uniform aperture: first sidelobe −17.6 dB, HPBW 58.9·λ/D', () => {
    const cut = sampleCut(dish, uniform, f, 0)
    expect(firstSidelobeDb(cut)).toBeCloseTo(-17.6, 1)
    expect(rad2deg(hpbwRad(cut)!) / (58.9 * lambdaOverD)).toBeCloseTo(1, 1)
  })

  it('tapered aperture: HPBW ≈ 70·λ/D (within 5%), first sidelobe −24.6 dB', () => {
    const cut = sampleCut(dish, tapered, f, 0)
    const ratio = rad2deg(hpbwRad(cut)!) / (70 * lambdaOverD)
    expect(Math.abs(ratio - 1)).toBeLessThan(0.05)
    expect(firstSidelobeDb(cut)).toBeCloseTo(-24.6, 0)
  })
})
