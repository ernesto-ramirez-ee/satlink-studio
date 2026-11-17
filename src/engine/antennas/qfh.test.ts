import { describe, expect, it } from 'vitest'
import { toDb } from '../units'
import { patternStats } from './directivity'
import { qfh } from './qfh'

const f = qfh.defaultFreqHz

describe('QFH / turnstile', () => {
  it('has a peak gain in the textbook 2–5 dBic range', () => {
    const g = qfh.peakGainDbi(qfh.defaults, f)
    expect(g).toBeGreaterThanOrEqual(2)
    expect(g).toBeLessThanOrEqual(5)
  })

  it('reduces to a free-space turnstile (1.76 dBi) with no front-to-back ratio', () => {
    expect(qfh.peakGainDbi({ frontBackDb: 0 }, f)).toBeCloseTo(1.76, 2)
  })

  it('closed form matches the numerical directivity', () => {
    const d = patternStats((t, p) => qfh.gain(t, p, qfh.defaults, f)).directivity
    expect(toDb(d)).toBeCloseTo(qfh.peakGainDbi(qfh.defaults, f), 1)
  })

  it('is 3 dB down at the horizon', () => {
    const zenith = qfh.gain(0, 0, qfh.defaults, f)
    const horizon = qfh.gain(Math.PI / 2, 0, qfh.defaults, f)
    expect(toDb(zenith / horizon)).toBeCloseTo(3.01, 2)
  })
})
