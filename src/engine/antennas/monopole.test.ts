import { describe, expect, it } from 'vitest'
import { patternStats } from './directivity'
import { monopole } from './monopole'

const f = monopole.defaultFreqHz

describe('quarter-wave monopole', () => {
  it('has a peak gain of 5.15 dBi over an ideal ground', () => {
    expect(Math.abs(monopole.peakGainDbi({}, f) - 5.15)).toBeLessThan(0.5)
  })

  it('agrees with the numerical directivity', () => {
    const d = patternStats((t, p) => monopole.gain(t, p, {}, f)).directivity
    expect(10 * Math.log10(d)).toBeCloseTo(5.15, 1)
  })

  it('radiates nothing below the ground plane', () => {
    expect(monopole.gain(Math.PI * 0.75, 0, {}, f)).toBe(0)
  })
})
