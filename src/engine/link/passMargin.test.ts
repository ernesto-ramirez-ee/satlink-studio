import { describe, expect, it } from 'vitest'
import { ANTENNAS } from '../antennas'
import { findPasses, observerFromDeg, satrecFromOmm } from '../orbit'
import { GOES19_OMM, ISS_OMM, NOTRE_DAME } from '../orbit/fixtures'
import { deg2rad } from '../units'
import { eirpAt, failureIntervals, marginTimeline, recommend, type MarginTimeline } from './passMargin'

const nd = observerFromDeg(NOTRE_DAME)
const allAntennas = ANTENNAS.map((m) => ({ model: m, params: m.defaults }))

describe('marginTimeline + recommend on real geometry', () => {
  it('ISS 145.8 MHz FM pass: recommends a simple fixed antenna', () => {
    const iss = satrecFromOmm(ISS_OMM)
    const pass = findPasses(iss, nd, new Date('2026-11-10T06:00:00Z'), 86400, deg2rad(30))[0]
    const tl = marginTimeline(
      iss,
      nd,
      pass.rise,
      pass.set,
      { label: 'FM voice', freqHz: 145.8e6, polarization: 'linear', eirpDbw: 7, dataRateBps: 15e3, requiredEbN0Db: 10 },
      allAntennas,
      1,
    )
    expect(tl.times.length).toBeGreaterThan(20)
    for (const s of tl.series) expect(s.marginDb).toHaveLength(tl.times.length)
    // The margin is best near culmination for a tracked antenna (shortest range).
    const yagi = tl.series.find((s) => s.antennaId === 'yagi')!
    const iMax = tl.elRad.indexOf(Math.max(...tl.elRad))
    expect(yagi.marginDb[iMax]).toBeGreaterThan(yagi.marginDb[0])
    const rec = recommend(tl)
    expect(rec.best).not.toBeNull()
    expect(['monopole', 'dipole', 'qfh', 'patch', 'yagi']).toContain(rec.best!.antennaId)
    expect(rec.verdicts.find((v) => v.antennaId === 'dish')!.practical).toBe(false)
  })

  it('GEO Ku TV (EIRP 50 dBW, 30 Mbit/s): only the dish or array closes', () => {
    const goes = satrecFromOmm(GOES19_OMM)
    const from = new Date('2026-11-10T12:00:00Z')
    const tl = marginTimeline(
      goes,
      nd,
      from,
      new Date(from.getTime() + 3600e3),
      { label: 'Ku TV', freqHz: 12e9, polarization: 'linear', eirpDbw: 50, dataRateBps: 30e6, requiredEbN0Db: 6 },
      allAntennas,
      1,
    )
    const rec = recommend(tl)
    expect(rec.best?.antennaId).toBe('dish')
    expect(rec.simplerFailures.length).toBeGreaterThan(0)
  })
})

describe('eirpAt', () => {
  const d = { label: '', freqHz: 7.812e9, polarization: 'rhcp' as const, eirpDbw: 0, dataRateBps: 1, requiredEbN0Db: 0 }
  it('returns the constant EIRP without a table', () => {
    expect(eirpAt({ ...d, eirpDbw: 7 }, deg2rad(40))).toBe(7)
  })
  it('interpolates and clamps an EIRP-vs-elevation table (NOAA-20 HRD ICD capability)', () => {
    const t: [number, number][] = [[5, 13.1], [40, 5.2], [70, 3.6], [90, 1.2]]
    expect(eirpAt({ ...d, eirpByElevationDeg: t }, deg2rad(40))).toBeCloseTo(5.2, 10)
    expect(eirpAt({ ...d, eirpByElevationDeg: t }, deg2rad(55))).toBeCloseTo(4.4, 10)
    expect(eirpAt({ ...d, eirpByElevationDeg: t }, deg2rad(1))).toBeCloseTo(13.1, 10)
  })
})

describe('failureIntervals', () => {
  it('groups consecutive failing samples, including one running to the end', () => {
    const t = [0, 1, 2, 3, 4, 5].map((s) => new Date(s * 1000))
    const iv = failureIntervals(t, [-1, -2, 1, 2, -1, -1])
    expect(iv.map((i) => [i.start.getTime(), i.end.getTime()])).toEqual([
      [0, 2000],
      [4000, 5000],
    ])
    expect(failureIntervals(t, [1, 1, 1, 1, 1, 1])).toEqual([])
  })
})

describe('recommend rule on synthetic data', () => {
  const tl = (series: { id: 'monopole' | 'qfh' | 'yagi' | 'dish'; rank: number; m: number[]; practical?: boolean }[]): MarginTimeline => ({
    times: [0, 1, 2, 3].map((i) => new Date(i * 1000)),
    elRad: [deg2rad(5), deg2rad(20), deg2rad(60), deg2rad(5)],
    azRad: [0, 0, 0, 0],
    rangeM: [1, 1, 1, 1],
    fsplDb: [0, 0, 0, 0],
    series: series.map((s) => ({
      antennaId: s.id,
      label: s.id,
      complexityRank: s.rank,
      mountLabel: '',
      practical: s.practical ?? true,
      impracticalReason: s.practical === false ? 'too big' : '',
      tSysK: 300,
      polLossDb: 0,
      marginDb: s.m,
      gainDbi: [0, 0, 0, 0],
    })),
  })

  it('ignores samples below 10° and picks the simplest antenna with ≥ 3 dB', () => {
    const rec = recommend(
      tl([
        { id: 'yagi', rank: 5, m: [-9, 8, 12, -9] },
        { id: 'monopole', rank: 1, m: [-9, 2.9, 10, -9] },
        { id: 'qfh', rank: 3, m: [-20, 3.0, 4, -20] },
        { id: 'dish', rank: 7, m: [20, 20, 20, 20] },
      ]),
    )
    expect(rec.best?.antennaId).toBe('qfh')
    expect(rec.runnerUp?.antennaId).toBe('yagi')
    expect(rec.simplerFailures.map((v) => v.antennaId)).toEqual(['monopole'])
    expect(rec.best?.minMarginDb).toBe(3)
  })

  it('skips impractical antennas even if their margin is fine', () => {
    const rec = recommend(
      tl([
        { id: 'monopole', rank: 1, m: [9, 9, 9, 9], practical: false },
        { id: 'qfh', rank: 3, m: [5, 5, 5, 5] },
      ]),
    )
    expect(rec.best?.antennaId).toBe('qfh')
  })

  it('reports the closest antenna when nothing passes', () => {
    const rec = recommend(tl([{ id: 'qfh', rank: 3, m: [0, 1, 2, 0] }]))
    expect(rec.best).toBeNull()
    expect(rec.reason).toContain('Closest')
  })
})
