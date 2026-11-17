import { describe, expect, it } from 'vitest'
import { findPasses, observerFromDeg, satrecFromOmm } from '../orbit'
import { ISS_OMM, NOTRE_DAME } from '../orbit/fixtures'
import { deg2rad, rad2deg } from '../units'
import { arrayLobeSurface, beamHopFrames, nearestFrame, passFrames, trackStarts } from './animation'
import { beamHopSchedule, type HopCandidate } from './beamhop'
import { scanLossDb } from './phases'

const nd = observerFromDeg(NOTRE_DAME)

describe('passFrames', () => {
  const iss = satrecFromOmm(ISS_OMM)
  const pass = findPasses(iss, nd, new Date('2026-11-10T06:00:00Z'), 86400, deg2rad(20))[0]
  const from = new Date(pass.rise.getTime() - 120e3)
  const to = new Date(pass.set.getTime() + 120e3)
  const frames = passFrames(iss, nd, from, to, 5)

  it('covers the window at the requested step', () => {
    expect(frames[0].time.getTime()).toBe(from.getTime())
    expect(frames[1].time.getTime() - frames[0].time.getTime()).toBe(5000)
    expect(frames.at(-1)!.time.getTime()).toBeLessThanOrEqual(to.getTime())
  })

  it('is out of range before rise and after set, visible in between', () => {
    expect(frames[0].visible).toBe(false)
    expect(frames.at(-1)!.visible).toBe(false)
    const mid = frames[nearestFrame(frames, pass.culmination)]
    expect(mid.visible).toBe(true)
    expect(rad2deg(mid.elRad)).toBeCloseTo(rad2deg(pass.maxElRad), 0)
  })

  it('finds the nearest frame and clamps outside the window', () => {
    expect(nearestFrame(frames, new Date(from.getTime() + 12_400))).toBe(2)
    expect(nearestFrame(frames, new Date(from.getTime() - 1e6))).toBe(0)
    expect(nearestFrame(frames, new Date(to.getTime() + 1e6))).toBe(frames.length - 1)
  })
})

describe('beamHopFrames', () => {
  // Same synthetic constellation as beamhop.test.ts: ISS-orbit copies 4° apart in mean anomaly.
  const cands: HopCandidate[] = Array.from({ length: 8 }, (_, k) => ({
    noradId: 90000 + k,
    name: `SAT-${k}`,
    satrec: satrecFromOmm({ ...ISS_OMM, NORAD_CAT_ID: 90000 + k, MEAN_ANOMALY: (351.1656 - 4 * k + 360) % 360 }),
  }))
  const schedule = beamHopSchedule(cands, nd, new Date('2026-11-10T01:17:00Z'), 20 * 60, 5)
  const frames = beamHopFrames(schedule, cands, nd)

  it('has one frame per schedule sample, matching its elevation and serving satellite', () => {
    expect(frames).toHaveLength(schedule.samples.length)
    schedule.samples.forEach((s, i) => {
      if (s.noradId === null) expect(frames[i].hidden).toBe(true)
      else {
        expect(frames[i].label).toBe(cands.find((c) => c.noradId === s.noradId)!.name)
        expect(rad2deg(frames[i].elRad)).toBeCloseTo(rad2deg(s.elRad), 6)
        expect(frames[i].rangeM).toBeGreaterThan(400e3)
      }
    })
  })

  it('starts a new track at every change of serving satellite', () => {
    const changes = schedule.samples.filter((s, i) => i > 0 && s.noradId !== schedule.samples[i - 1].noradId).length
    expect(trackStarts(frames)).toHaveLength(changes)
    expect(changes).toBeGreaterThanOrEqual(1)
  })
})

describe('arrayLobeSurface', () => {
  const p = { nx: 8, ny: 8, dxLambda: 0.5, dyLambda: 0.5, taper: 0 }

  it('peaks at 0 dB at broadside', () => {
    const s = arrayLobeSurface(p, 0, 0)
    expect(Math.max(...s.gainDbi.flat())).toBeCloseTo(0, 6)
    expect(s.gainDbi[0][0]).toBeCloseTo(0, 6)
  })

  it('peaks near the steering angle, lower by about the cos^1.2 scan loss', () => {
    const theta0 = deg2rad(40)
    const s = arrayLobeSurface(p, theta0, deg2rad(90), 91, 73)
    let best = { v: -Infinity, i: 0, j: 0 }
    s.gainDbi.forEach((row, i) => row.forEach((v, j) => v > best.v && (best = { v, i, j })))
    expect(Math.abs(rad2deg(s.thetaRad[best.i]) - 40)).toBeLessThanOrEqual(3)
    expect(Math.abs(rad2deg(s.phiRad[best.j]) - 90)).toBeLessThanOrEqual(5)
    expect(Math.abs(best.v + scanLossDb(theta0))).toBeLessThan(0.5)
  })
})
