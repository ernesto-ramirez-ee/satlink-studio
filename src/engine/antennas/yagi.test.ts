import { describe, expect, it } from 'vitest'
import { NBS_YAGI_TABLE, yagi, yagiGainDbd } from './yagi'

const f = yagi.defaultFreqHz

describe('Yagi-Uda', () => {
  it('reproduces the NBS TN 688 table at its points (dBi = dBd + 2.15)', () => {
    for (const [boom, dbd] of NBS_YAGI_TABLE) {
      expect(Math.abs(yagi.peakGainDbi({ elements: 6, boomLambda: boom }, f) - (dbd + 2.15))).toBeLessThan(0.5)
    }
  })

  it('stays within the ~7–15 dBi textbook range over the slider range', () => {
    for (const boom of [0.4, 1, 2, 3, 4.2]) {
      const g = yagiGainDbd(boom) + 2.15
      expect(g).toBeGreaterThanOrEqual(7)
      expect(g).toBeLessThanOrEqual(16.5)
    }
  })

  it('beams toward +z, with the peak equal to the stated gain', () => {
    const p = yagi.defaults
    const fwd = yagi.gain(0, 0, p, f)
    expect(10 * Math.log10(fwd)).toBeCloseTo(yagi.peakGainDbi(p, f), 1)
    expect(yagi.gain(Math.PI, 0, p, f)).toBeLessThan(fwd / 3)
  })
})
