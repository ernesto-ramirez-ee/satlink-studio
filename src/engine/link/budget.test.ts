import { describe, expect, it } from 'vitest'
import { linkBudget } from './budget'

describe('linkBudget', () => {
  // Worked example (docs/PHYSICS.md, "Link budget worked example"):
  // Ku GEO TV downlink, EIRP 50 dBW, slant range 38 000 km, 12 GHz, 1 m dish (39.8 dBi),
  // T_sys 150 K, L_atm 0.3 dB, L_pol 0, L_point 0.5 dB, 30 Mbit/s, required Eb/N0 6 dB.
  //   L_fs = 20·log10(4π·3.8e7·1.2e10 / 2.998e8)  = 205.63 dB
  //   G/T  = 39.8 − 10·log10(150)                  =  18.04 dB/K
  //   C/N0 = 50 − 205.63 − 0.3 − 0 − 0.5 + 18.04 + 228.60 = 90.21 dBHz
  //   Eb/N0 = 90.21 − 10·log10(3e7) = 90.21 − 74.77 = 15.44 dB → margin 9.44 dB
  const geo = linkBudget({
    eirpDbw: 50,
    freqHz: 12e9,
    rangeM: 38_000e3,
    rxGainDbi: 39.8,
    tSysK: 150,
    atmLossDb: 0.3,
    polLossDb: 0,
    pointingLossDb: 0.5,
    dataRateBps: 30e6,
    requiredEbN0Db: 6,
  })

  it('matches the worked GEO example step by step', () => {
    expect(geo.fsplDb).toBeCloseTo(205.63, 1)
    expect(geo.gOverTDbK).toBeCloseTo(18.04, 2)
    expect(geo.cn0DbHz).toBeCloseTo(90.21, 1)
    expect(geo.ebn0Db).toBeCloseTo(15.44, 1)
    expect(geo.marginDb).toBeCloseTo(9.44, 1)
  })

  it('loses 6 dB of margin when the range doubles', () => {
    const far = linkBudget({ ...inputs(), rangeM: 2000e3 })
    const near = linkBudget({ ...inputs(), rangeM: 1000e3 })
    expect(near.marginDb - far.marginDb).toBeCloseTo(6.02, 2)
  })

  it('gives FSPL 135.7 dB for 1000 km at 145.8 MHz', () => {
    expect(linkBudget(inputs()).fsplDb).toBeCloseTo(135.72, 1)
  })
})

function inputs() {
  return {
    eirpDbw: 7,
    freqHz: 145.8e6,
    rangeM: 1000e3,
    rxGainDbi: 2.15,
    tSysK: 1000,
    atmLossDb: 0,
    polLossDb: 3,
    pointingLossDb: 0,
    dataRateBps: 15e3,
    requiredEbN0Db: 10,
  }
}
