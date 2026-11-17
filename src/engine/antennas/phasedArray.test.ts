import { describe, expect, it } from 'vitest'
import { deg2rad, fromDb, toDb } from '../units'
import { ELEMENT_EXPONENT, gratingLobeRisk, lineFactorPower, phasedArray, taperWeights } from './phasedArray'

const f = phasedArray.defaultFreqHz
const base = phasedArray.defaults // 8 × 8, λ/2, broadside, uniform

describe('planar phased array', () => {
  it('broadside gain ≈ aperture directivity 4πA/λ² (8×8, λ/2 → 23.0 dBi)', () => {
    const aperture = 4 * Math.PI * 8 * 0.5 * 8 * 0.5
    expect(Math.abs(phasedArray.peakGainDbi(base, f) - toDb(aperture))).toBeLessThan(0.5)
  })

  it('broadside gain ≈ N·G_element (within 2 dB; the isolated-element gain overstates the embedded one)', () => {
    const elementGain = 2 * (ELEMENT_EXPONENT + 1) // cos^n over a hemisphere
    expect(Math.abs(phasedArray.peakGainDbi(base, f) - toDb(64 * elementGain))).toBeLessThan(2)
  })

  it('puts the beam where it is steered', () => {
    const p = { ...base, scanThetaRad: deg2rad(30), scanPhiRad: deg2rad(45) }
    const peak = phasedArray.peakGainDbi(p, f)
    expect(toDb(phasedArray.gain(p.scanThetaRad, p.scanPhiRad, p, f))).toBeGreaterThan(peak - 0.3)
    expect(phasedArray.gain(0, 0, p, f)).toBeLessThan(fromDb(peak - 10))
  })

  it('loses gain when scanned (scan loss)', () => {
    const scanned = { ...base, scanThetaRad: deg2rad(45) }
    const loss = phasedArray.peakGainDbi(base, f) - phasedArray.peakGainDbi(scanned, f)
    expect(loss).toBeGreaterThan(0.8)
    expect(loss).toBeLessThan(3)
  })

  it('flags grating lobes when d/λ ≥ 1/(1 + |sin θ0|)', () => {
    expect(gratingLobeRisk(0.5, 0)).toBe(false)
    expect(gratingLobeRisk(0.5, deg2rad(60))).toBe(false)
    expect(gratingLobeRisk(0.6, deg2rad(60))).toBe(true)
    expect(gratingLobeRisk(1, 0)).toBe(true)
    expect(phasedArray.warnings({ ...base, dxLambda: 0.7, scanThetaRad: deg2rad(40) }, f)).toHaveLength(1)
    expect(phasedArray.warnings(base, f)).toHaveLength(0)
  })

  it('normalizes the line factor to 1 in the steered direction', () => {
    expect(lineFactorPower(taperWeights(8, 0), 0)).toBeCloseTo(1, 12)
    expect(lineFactorPower(taperWeights(8, 1), 0)).toBeCloseTo(1, 12)
    // Uniform 8-element null at ψ = 2π/8.
    expect(lineFactorPower(taperWeights(8, 0), (2 * Math.PI) / 8)).toBeCloseTo(0, 10)
  })
})
