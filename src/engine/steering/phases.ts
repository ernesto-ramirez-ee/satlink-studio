// Phased-array element phases (docs/PHYSICS.md, Phase 4):
//   φ_mn = −(2π/λ)·(m·dx·u + n·dy·v) mod 2π,  u = sinθ·cosφ, v = sinθ·sinφ
// optionally quantized to 2^bits levels (digital phase shifters).

import { taperWeights } from '../antennas/phasedArray'

export interface PhaseSpec {
  nx: number
  ny: number
  dxLambda: number
  dyLambda: number
  thetaRad: number
  phiRad: number
  /** Phase-shifter bits; omit or 0 for continuous phase. */
  bits?: number
}

const TWO_PI = 2 * Math.PI

export const wrap2Pi = (a: number): number => ((a % TWO_PI) + TWO_PI) % TWO_PI

/** Rounds a phase to the nearest of 2^bits levels in [0, 2π). */
export function quantizePhase(phase: number, bits: number): number {
  const step = TWO_PI / 2 ** bits
  return wrap2Pi(Math.round(wrap2Pi(phase) / step) * step)
}

/** Phase matrix phases[n][m] (row n along y, column m along x), radians in [0, 2π). */
export function elementPhases(s: PhaseSpec): number[][] {
  const u = Math.sin(s.thetaRad) * Math.cos(s.phiRad)
  const v = Math.sin(s.thetaRad) * Math.sin(s.phiRad)
  const nx = Math.round(s.nx)
  const ny = Math.round(s.ny)
  const out: number[][] = []
  for (let n = 0; n < ny; n++) {
    const row: number[] = []
    for (let m = 0; m < nx; m++) {
      const p = wrap2Pi(-TWO_PI * (m * s.dxLambda * u + n * s.dyLambda * v))
      row.push(s.bits ? quantizePhase(p, s.bits) : p)
    }
    out.push(row)
  }
  return out
}

export interface ElementWeight {
  /** Column index along x (east). */
  m: number
  /** Row index along y (north). */
  n: number
  /** Amplitude from the taper, normalized so the largest is 1. */
  amplitude: number
  /** Phase in [0, 2π) (quantized if bits are set). */
  phaseRad: number
  re: number
  im: number
}

/**
 * Complex excitation w_mn = a_m·a_n·e^{jφ_mn} of every element: the steering phases from
 * `elementPhases` and the separable amplitude taper used by the phased-array model
 * (uniform, or cosine a_k = sin(π(k + ½)/N)). Listed row by row (n, then m).
 */
export function elementWeights(s: PhaseSpec & { taper: number }): ElementWeight[] {
  const phases = elementPhases(s)
  const nx = Math.round(s.nx)
  const ny = Math.round(s.ny)
  const ax = taperWeights(nx, s.taper)
  const ay = taperWeights(ny, s.taper)
  const peak = Math.max(...ax) * Math.max(...ay)
  const out: ElementWeight[] = []
  for (let n = 0; n < ny; n++) {
    for (let m = 0; m < nx; m++) {
      const a = (ax[m] * ay[n]) / peak
      const p = phases[n][m]
      out.push({ m, n, amplitude: a, phaseRad: p, re: a * Math.cos(p), im: a * Math.sin(p) })
    }
  }
  return out
}

/**
 * Normalized array gain |Σ e^{j(φ_mn + k·(m·dx·u + n·dy·v))}|² / N² toward (θ, φ) for a given
 * phase matrix (uniform amplitude). 1 means a perfectly formed beam in that direction.
 */
export function arrayGainFromPhases(phases: number[][], dxLambda: number, dyLambda: number, thetaRad: number, phiRad: number): number {
  const u = Math.sin(thetaRad) * Math.cos(phiRad)
  const v = Math.sin(thetaRad) * Math.sin(phiRad)
  let re = 0
  let im = 0
  let count = 0
  phases.forEach((row, n) =>
    row.forEach((p, m) => {
      const a = p + TWO_PI * (m * dxLambda * u + n * dyLambda * v)
      re += Math.cos(a)
      im += Math.sin(a)
      count++
    }),
  )
  return (re * re + im * im) / (count * count)
}

/** Scan loss of a flat array, cos^1.2(θ) (docs/PHYSICS.md), in dB (positive = loss). */
export const scanLossDb = (thetaRad: number): number => -12 * Math.log10(Math.max(Math.cos(thetaRad), 1e-6))

/** Steering direction (θ, φ) for a satellite at (az, el), panel facing up with x = east, y = north. */
export const steeringFromAzEl = (azRad: number, elRad: number): { thetaRad: number; phiRad: number } => ({
  thetaRad: Math.PI / 2 - elRad,
  phiRad: wrap2Pi(Math.PI / 2 - azRad),
})

/**
 * Average gain loss from B-bit phase quantization, [sin(π/2^B) / (π/2^B)]² (linear, ≤ 1):
 * 1 bit −3.9 dB, 2 bits −0.9 dB, 3 bits −0.22 dB.
 */
export function quantizationLoss(bits: number): number {
  if (!bits) return 1
  const x = Math.PI / 2 ** bits
  return (Math.sin(x) / x) ** 2
}
