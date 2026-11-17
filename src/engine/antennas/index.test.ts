import { describe, expect, it } from 'vitest'
import { ANTENNAS, getAntenna } from './index'
import { sampleSurface } from './metrics'

describe('antenna registry', () => {
  it('has the 8 antenna types from docs/PHYSICS.md', () => {
    expect(ANTENNAS.map((a) => a.id)).toEqual([
      'dipole',
      'monopole',
      'qfh',
      'yagi',
      'helix',
      'patch',
      'dish',
      'phased-array',
    ])
    expect(getAntenna('dish').label).toBe('Parabolic dish')
  })

  it.each(ANTENNAS.map((a) => [a.id, a] as const))('%s: sampled gain never exceeds the stated peak', (_id, a) => {
    const peak = a.peakGainDbi(a.defaults, a.defaultFreqHz)
    const s = sampleSurface(a, a.defaults, a.defaultFreqHz, 61, 37)
    const max = Math.max(...s.gainDbi.flat())
    expect(max).toBeLessThanOrEqual(peak + 0.01)
    expect(Number.isFinite(peak)).toBe(true)
  })

  it.each(ANTENNAS.map((a) => [a.id, a] as const))('%s: defaults are within the slider ranges', (_id, a) => {
    expect(a.paramSpecs.map((s) => s.key).sort()).toEqual(Object.keys(a.defaults).sort())
    for (const spec of a.paramSpecs) {
      const shown = a.defaults[spec.key] * (spec.displayScale ?? 1)
      expect(shown).toBeGreaterThanOrEqual(spec.min)
      expect(shown).toBeLessThanOrEqual(spec.max)
    }
  })
})
