import { describe, expect, it } from 'vitest'
import { besselJ0, besselJ1, besselJ2, jinc, jinc2 } from './bessel'

// Reference values: Abramowitz & Stegun Table 9.1.
describe('bessel', () => {
  it('matches tabulated J0, J1, J2', () => {
    expect(besselJ0(0)).toBeCloseTo(1, 7)
    expect(besselJ0(1)).toBeCloseTo(0.7651976866, 6)
    expect(besselJ0(5)).toBeCloseTo(-0.1775967713, 6)
    expect(besselJ1(1)).toBeCloseTo(0.4400505857, 6)
    expect(besselJ1(5)).toBeCloseTo(-0.3275791376, 6)
    expect(besselJ1(-1)).toBeCloseTo(-0.4400505857, 6)
    expect(besselJ2(1)).toBeCloseTo(0.1149034849, 6)
    expect(besselJ2(5)).toBeCloseTo(0.0465651163, 6)
  })

  it('has the first zero of J1 at 3.8317', () => {
    expect(Math.abs(besselJ1(3.8317))).toBeLessThan(1e-4)
  })

  it('normalizes the aperture functions to 1 at u = 0', () => {
    expect(jinc(0)).toBeCloseTo(1, 7)
    expect(jinc2(0)).toBeCloseTo(1, 7)
    // Continuity across the series / polynomial switch at 0.5.
    expect(jinc2(0.4999)).toBeCloseTo(jinc2(0.5001), 4)
  })
})
