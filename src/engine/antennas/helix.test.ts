import { describe, expect, it } from 'vitest'
import { rad2deg, toDb } from '../units'
import { helix, helixGain } from './helix'
import { hpbwRad, sampleCut } from './metrics'

const f = helix.defaultFreqHz

describe('axial-mode helix', () => {
  it('matches Kraus G = 15·C²·N·S (10 turns, S = 0.25λ, C = 1λ → 15.74 dBic)', () => {
    expect(helixGain(helix.defaults)).toBeCloseTo(37.5, 6)
    expect(helix.peakGainDbi(helix.defaults, f)).toBeCloseTo(15.74, 2)
  })

  it('is in the textbook 10–16 dBic range for typical designs', () => {
    expect(helix.peakGainDbi({ turns: 6, spacingLambda: 0.23, circLambda: 1 }, f)).toBeGreaterThan(10)
    expect(helix.peakGainDbi({ turns: 12, spacingLambda: 0.25, circLambda: 1 }, f)).toBeLessThan(17)
  })

  it('has the Kraus HPBW 52/(C·√(NS)) degrees', () => {
    const hpbw = hpbwRad(sampleCut(helix, helix.defaults, f, 0))
    expect(rad2deg(hpbw!)).toBeCloseTo(52 / Math.sqrt(2.5), 0)
  })

  it('peaks on boresight', () => {
    expect(toDb(helix.gain(0, 0, helix.defaults, f))).toBeCloseTo(15.74, 2)
  })
})
