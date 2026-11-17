import { describe, expect, it } from 'vitest'
import { deg2rad, rad2deg, toDb } from '../units'
import {
  arrayGainFromPhases,
  elementPhases,
  elementWeights,
  quantizationLoss,
  quantizePhase,
  scanLossDb,
  steeringFromAzEl,
  wrap2Pi,
} from './phases'

describe('element phases', () => {
  it('are all zero at broadside', () => {
    const p = elementPhases({ nx: 4, ny: 3, dxLambda: 0.5, dyLambda: 0.5, thetaRad: 0, phiRad: 0 })
    expect(p).toHaveLength(3)
    expect(p[0]).toHaveLength(4)
    for (const row of p) for (const x of row) expect(x).toBe(0)
  })

  it('step by −2π·d·sinθ along x when steered in the x-z plane (λ/2, 30° → −90° per element)', () => {
    const p = elementPhases({ nx: 4, ny: 1, dxLambda: 0.5, dyLambda: 0.5, thetaRad: deg2rad(30), phiRad: 0 })
    expect(p[0].map((x) => Math.round(rad2deg(x)))).toEqual([0, 270, 180, 90])
  })

  it('form a perfect beam toward the steering direction (continuous phase)', () => {
    const p = elementPhases({ nx: 8, ny: 8, dxLambda: 0.5, dyLambda: 0.5, thetaRad: deg2rad(40), phiRad: deg2rad(120) })
    expect(arrayGainFromPhases(p, 0.5, 0.5, deg2rad(40), deg2rad(120))).toBeCloseTo(1, 10)
    expect(arrayGainFromPhases(p, 0.5, 0.5, 0, 0)).toBeLessThan(0.1)
  })

  it('quantize to 2^bits levels', () => {
    const p = elementPhases({ nx: 16, ny: 16, dxLambda: 0.5, dyLambda: 0.5, thetaRad: deg2rad(23), phiRad: deg2rad(17), bits: 2 })
    const levels = new Set(p.flat().map((x) => Math.round(rad2deg(x))))
    for (const l of levels) expect([0, 90, 180, 270]).toContain(l)
    expect(quantizePhase(deg2rad(50), 2)).toBeCloseTo(deg2rad(90), 10)
    expect(quantizePhase(deg2rad(359), 3)).toBeCloseTo(0, 10)
    expect(wrap2Pi(-Math.PI / 2)).toBeCloseTo(1.5 * Math.PI, 12)
  })
})

describe('element weights', () => {
  const spec = { nx: 4, ny: 3, dxLambda: 0.5, dyLambda: 0.5, thetaRad: deg2rad(30), phiRad: 0 }

  it('lists every element with unit amplitude for a uniform taper, phases matching elementPhases', () => {
    const w = elementWeights({ ...spec, taper: 0 })
    const p = elementPhases(spec)
    expect(w).toHaveLength(12)
    for (const e of w) {
      expect(e.amplitude).toBeCloseTo(1, 12)
      expect(e.phaseRad).toBe(p[e.n][e.m])
      expect(Math.hypot(e.re, e.im)).toBeCloseTo(e.amplitude, 12)
      expect(Math.atan2(e.im, e.re)).toBeCloseTo(e.phaseRad > Math.PI ? e.phaseRad - 2 * Math.PI : e.phaseRad, 12)
    }
  })

  it('applies the cosine taper (edges weaker than the centre, peak 1)', () => {
    const w = elementWeights({ ...spec, nx: 8, ny: 8, taper: 1 })
    const amp = (m: number, n: number) => w.find((e) => e.m === m && e.n === n)!.amplitude
    expect(Math.max(...w.map((e) => e.amplitude))).toBeCloseTo(1, 12)
    expect(amp(0, 0)).toBeLessThan(amp(3, 3))
    expect(amp(0, 3)).toBeCloseTo(amp(7, 3), 12) // symmetric
  })

  it('form the beam: Σ w·e^{jk(m·dx·u + n·dy·v)} is maximal toward the steering direction', () => {
    const w = elementWeights({ ...spec, nx: 8, ny: 8, taper: 1 })
    const af = (thetaDeg: number) => {
      const u = Math.sin(deg2rad(thetaDeg))
      let re = 0
      let im = 0
      for (const e of w) {
        const a = 2 * Math.PI * e.m * 0.5 * u
        re += e.re * Math.cos(a) - e.im * Math.sin(a)
        im += e.re * Math.sin(a) + e.im * Math.cos(a)
      }
      return Math.hypot(re, im)
    }
    expect(af(30)).toBeGreaterThan(af(20))
    expect(af(30)).toBeGreaterThan(af(40))
  })
})

describe('scan geometry', () => {
  it('scan loss is 0 dB at broadside and 3.6 dB at 60° (cos^1.2)', () => {
    expect(scanLossDb(0)).toBeCloseTo(0, 10)
    expect(scanLossDb(deg2rad(60))).toBeCloseTo(3.61, 2)
  })
  it('maps zenith to θ = 0, and a satellite low in the east to θ ≈ 90°, φ = 0', () => {
    expect(steeringFromAzEl(0, deg2rad(90)).thetaRad).toBeCloseTo(0, 12)
    const east = steeringFromAzEl(deg2rad(90), deg2rad(10))
    expect(rad2deg(east.thetaRad)).toBeCloseTo(80, 10)
    expect(rad2deg(east.phiRad)).toBeCloseTo(0, 10)
    expect(rad2deg(steeringFromAzEl(0, deg2rad(45)).phiRad)).toBeCloseTo(90, 10) // north = +y
  })
})

describe('quantization loss', () => {
  it('matches [sin(π/2^B)/(π/2^B)]²: 1 bit −3.92 dB, 2 bits −0.91 dB, 3 bits −0.22 dB', () => {
    expect(toDb(quantizationLoss(1))).toBeCloseTo(-3.92, 2)
    expect(toDb(quantizationLoss(2))).toBeCloseTo(-0.91, 2)
    expect(toDb(quantizationLoss(3))).toBeCloseTo(-0.22, 2)
    expect(quantizationLoss(0)).toBe(1)
  })

  it('agrees with the gain of an actual quantized 16×16 array within 0.5 dB (3 bits)', () => {
    const spec = { nx: 16, ny: 16, dxLambda: 0.5, dyLambda: 0.5, thetaRad: deg2rad(33), phiRad: deg2rad(21) }
    const g = arrayGainFromPhases(elementPhases({ ...spec, bits: 3 }), 0.5, 0.5, spec.thetaRad, spec.phiRad)
    expect(Math.abs(toDb(g) - toDb(quantizationLoss(3)))).toBeLessThan(0.5)
  })
})
