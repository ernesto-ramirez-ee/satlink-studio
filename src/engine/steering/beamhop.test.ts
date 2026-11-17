import { describe, expect, it } from 'vitest'
import { lookAngles, observerFromDeg, satrecFromOmm } from '../orbit'
import { ISS_OMM, NOTRE_DAME } from '../orbit/fixtures'
import { deg2rad, rad2deg } from '../units'
import { BEAM_HOP_MIN_EL_RAD, beamHopSchedule, bestCandidate, sampleAt, type HopCandidate } from './beamhop'

const nd = observerFromDeg(NOTRE_DAME)

// A synthetic "constellation": the ISS orbit with copies spaced 4° apart in mean anomaly
// (~1 minute apart), so they cross the sky one after another.
const cands: HopCandidate[] = Array.from({ length: 8 }, (_, k) => ({
  noradId: 90000 + k,
  name: `SAT-${k}`,
  satrec: satrecFromOmm({ ...ISS_OMM, NORAD_CAT_ID: 90000 + k, MEAN_ANOMALY: (351.1656 - 4 * k + 360) % 360 }),
}))

// Window around the ~87° ISS pass over Notre Dame (01:21 UTC on Nov 10).
const start = new Date('2026-11-10T01:17:00Z')
const schedule = beamHopSchedule(cands, nd, start, 20 * 60, 5)

describe('beam-hop schedule', () => {
  it('serves satellites and hands over at least once', () => {
    expect(schedule.segments.length).toBeGreaterThanOrEqual(2)
    expect(schedule.handovers.length).toBeGreaterThanOrEqual(1)
  })

  it('hands over only when the current satellite drops below 25°, to the highest one available', () => {
    for (const h of schedule.handovers) {
      if (h.fromElRad !== null) expect(h.fromElRad).toBeLessThan(BEAM_HOP_MIN_EL_RAD)
      if (h.toId !== null) {
        expect(h.toElRad!).toBeGreaterThanOrEqual(BEAM_HOP_MIN_EL_RAD)
        const best = bestCandidate(cands, nd, h.time, BEAM_HOP_MIN_EL_RAD)
        expect(best?.cand.noradId).toBe(h.toId)
      }
    }
  })

  it('keeps every served sample at or above 25°', () => {
    for (const s of schedule.samples) if (s.noradId !== null) expect(rad2deg(s.elRad)).toBeGreaterThanOrEqual(25)
  })

  it('has non-overlapping segments in time order', () => {
    for (let i = 1; i < schedule.segments.length; i++) {
      expect(schedule.segments[i].start.getTime()).toBeGreaterThan(schedule.segments[i - 1].end.getTime())
    }
  })

  it('reports the sample at a given time, and the elevation matches SGP4', () => {
    const t = new Date(schedule.segments[0].start.getTime() + 30e3)
    const s = sampleAt(schedule, t)!
    const sat = cands.find((c) => c.noradId === s.noradId)!
    expect(rad2deg(s.elRad)).toBeCloseTo(rad2deg(lookAngles(sat.satrec, nd, s.time)!.elRad), 6)
    expect(sampleAt(schedule, new Date(start.getTime() - 1000))).toBeNull()
  })

  it('has an outage (null) when nothing is above 25°', () => {
    const quiet = beamHopSchedule(cands.slice(0, 1), nd, new Date('2026-11-10T03:00:00Z'), 600, 30, deg2rad(25))
    expect(quiet.samples.every((s) => s.noradId === null)).toBe(true)
    expect(quiet.segments).toHaveLength(0)
  })
})
