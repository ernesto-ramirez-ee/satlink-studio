import { describe, expect, it } from 'vitest'
import { K_BOLTZMANN_DB, fromDb, fspl, toDb, wavelength } from './units'

describe('units', () => {
  it('round-trips dB', () => {
    expect(fromDb(toDb(42))).toBeCloseTo(42, 10)
    expect(toDb(2)).toBeCloseTo(3.0103, 4)
  })

  it('computes wavelength', () => {
    expect(wavelength(299_792_458)).toBeCloseTo(1, 12)
    expect(wavelength(137e6)).toBeCloseTo(2.188, 3)
  })

  it('matches the textbook Boltzmann constant in dB', () => {
    expect(K_BOLTZMANN_DB).toBeCloseTo(-228.6, 1)
  })

  it('matches a known free-space path loss', () => {
    // GEO, 35 786 km at 12 GHz: about 205.1 dB
    expect(fspl(35_786e3, 12e9)).toBeCloseTo(205.1, 1)
  })
})
