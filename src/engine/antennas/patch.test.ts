import { describe, expect, it } from 'vitest'
import { toDb } from '../units'
import { patternStats } from './directivity'
import { patch } from './patch'

const f = patch.defaultFreqHz

describe('microstrip patch', () => {
  it('has a peak gain in the textbook 6–8 dBi range for common substrates', () => {
    // Common PCB substrates: PTFE (2.2), FR-4 (4.4), Rogers RO3010 (10.2).
    for (const epsR of [2.2, 4.4, 10.2]) {
      const g = patch.peakGainDbi({ epsR }, f)
      expect(g).toBeGreaterThanOrEqual(6)
      expect(g).toBeLessThanOrEqual(8)
    }
  })

  it('closed form 2(n + 1) matches the numerical directivity', () => {
    const d = patternStats((t, p) => patch.gain(t, p, patch.defaults, f)).directivity
    expect(toDb(d)).toBeCloseTo(patch.peakGainDbi(patch.defaults, f), 1)
  })

  it('gains less on a higher-εr substrate', () => {
    expect(patch.peakGainDbi({ epsR: 10 }, f)).toBeLessThan(patch.peakGainDbi({ epsR: 2.2 }, f))
  })
})
