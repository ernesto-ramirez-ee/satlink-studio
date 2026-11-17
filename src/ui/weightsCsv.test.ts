import { describe, expect, it } from 'vitest'
import { elementWeights } from '../engine/steering'
import { deg2rad } from '../engine/units'
import { weightsCsv } from './weightsCsv'

describe('weightsCsv', () => {
  const w = elementWeights({ nx: 2, ny: 2, dxLambda: 0.5, dyLambda: 0.5, thetaRad: deg2rad(30), phiRad: 0, bits: 0, taper: 0 })
  const csv = weightsCsv(w, {
    target: 'ISS (ZARYA)',
    time: new Date('2026-11-11T07:03:39Z'),
    thetaDeg: 30,
    phiDeg: 0,
    bits: 0,
    taper: 'uniform',
    nx: 2,
    ny: 2,
    dxLambda: 0.5,
    dyLambda: 0.5,
  })
  const lines = csv.trim().split('\n')
  const data = lines.filter((l) => !l.startsWith('#'))

  it('has metadata comments, a header and one row per element', () => {
    expect(lines[0]).toMatch(/^# SatLink Studio/)
    expect(csv).toContain('# time_utc: 2026-11-11T07:03:39.000Z')
    expect(data[0]).toBe('m,n,amplitude,phase_deg,re,im')
    expect(data).toHaveLength(1 + 4)
  })

  it('writes the exact weights (λ/2, 30° in x → element (1,0) at 270°, w = −j)', () => {
    const row = data.find((l) => l.startsWith('1,0,'))!.split(',').map(Number)
    expect(row[2]).toBeCloseTo(1, 6)
    expect(row[3]).toBeCloseTo(270, 4)
    expect(row[4]).toBeCloseTo(0, 6)
    expect(row[5]).toBeCloseTo(-1, 6)
  })
})
