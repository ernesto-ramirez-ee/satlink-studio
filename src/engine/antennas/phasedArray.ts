// Planar phased array in the x-y plane, beam steered to (θ0, φ0).
// F(θ, φ) = |AFx(u)|² · |AFy(v)|² · cos^1.2 θ,  u = sinθ·cosφ, v = sinθ·sinφ
// AFx = Σ w_m·exp(j·m·k·dx·(u − u0)) / Σ w_m, and likewise for y.
// Element pattern cos^1.2 θ (front hemisphere) matches the scan loss in docs/PHYSICS.md.
// Gain is the numerical directivity (no mutual coupling or ohmic loss).

import { wavelength } from '../units'
import { DEG, defineAntenna } from './define'

export type PhasedArrayParams = {
  nx: number
  ny: number
  dxLambda: number
  dyLambda: number
  scanThetaRad: number
  scanPhiRad: number
  taper: number
}

export const ARRAY_TAPER_UNIFORM = 0
export const ARRAY_TAPER_COSINE = 1
export const ELEMENT_EXPONENT = 1.2

/** Amplitude weights for an n-element line: uniform, or a cosine (half-sine) taper. */
export function taperWeights(n: number, taper: number): number[] {
  return Array.from({ length: n }, (_, m) => (taper === ARRAY_TAPER_COSINE ? Math.sin((Math.PI * (m + 0.5)) / n) : 1))
}

/** |Σ w_m e^{j m ψ}|² / (Σ w_m)², via complex rotation (one sin/cos per call). */
export function lineFactorPower(weights: number[], psi: number): number {
  const c = Math.cos(psi)
  const s = Math.sin(psi)
  let re = 0
  let im = 0
  let pr = 1
  let pi = 0
  let sum = 0
  for (const w of weights) {
    re += w * pr
    im += w * pi
    sum += w
    const nr = pr * c - pi * s
    pi = pr * s + pi * c
    pr = nr
  }
  return (re * re + im * im) / (sum * sum)
}

/**
 * Grating lobes enter visible space when d/λ ≥ 1 / (1 + |sin θ0|) (docs/PHYSICS.md).
 * Returns true when that happens for the given spacing and scan angle.
 */
export const gratingLobeRisk = (spacingLambda: number, scanThetaRad: number): boolean =>
  spacingLambda >= 1 / (1 + Math.abs(Math.sin(scanThetaRad)))

// Weight arrays are rebuilt only when N or the taper changes.
let wCacheKey = ''
let wx: number[] = []
let wy: number[] = []
function weightsFor(p: PhasedArrayParams): [number[], number[]] {
  const key = `${p.nx},${p.ny},${p.taper}`
  if (key !== wCacheKey) {
    wx = taperWeights(Math.round(p.nx), p.taper)
    wy = taperWeights(Math.round(p.ny), p.taper)
    wCacheKey = key
  }
  return [wx, wy]
}

export function arrayPattern(theta: number, phi: number, p: PhasedArrayParams): number {
  if (theta > Math.PI / 2) return 0
  const [ax, ay] = weightsFor(p)
  const st = Math.sin(theta)
  const u = st * Math.cos(phi)
  const v = st * Math.sin(phi)
  const s0 = Math.sin(p.scanThetaRad)
  const u0 = s0 * Math.cos(p.scanPhiRad)
  const v0 = s0 * Math.sin(p.scanPhiRad)
  const twoPi = 2 * Math.PI
  return (
    lineFactorPower(ax, twoPi * p.dxLambda * (u - u0)) *
    lineFactorPower(ay, twoPi * p.dyLambda * (v - v0)) *
    Math.cos(theta) ** ELEMENT_EXPONENT
  )
}

export const phasedArray = defineAntenna<PhasedArrayParams>({
  id: 'phased-array',
  label: 'Planar phased array',
  description:
    'Grid of patch-like elements whose phases steer the beam electronically, with no moving parts (as in Starlink user terminals).',
  polarization: 'linear',
  defaults: { nx: 8, ny: 8, dxLambda: 0.5, dyLambda: 0.5, scanThetaRad: 0, scanPhiRad: 0, taper: ARRAY_TAPER_UNIFORM },
  defaultFreqHz: 11.7e9,
  paramSpecs: [
    { key: 'nx', label: 'Elements Nx', min: 2, max: 16, step: 1 },
    { key: 'ny', label: 'Elements Ny', min: 2, max: 16, step: 1 },
    { key: 'dxLambda', label: 'Spacing dx', min: 0.3, max: 1, step: 0.01, unit: 'λ' },
    { key: 'dyLambda', label: 'Spacing dy', min: 0.3, max: 1, step: 0.01, unit: 'λ' },
    { key: 'scanThetaRad', label: 'Steer θ0', min: 0, max: 60, step: 1, unit: '°', displayScale: DEG },
    { key: 'scanPhiRad', label: 'Steer φ0', min: 0, max: 359, step: 1, unit: '°', displayScale: DEG },
    {
      key: 'taper',
      label: 'Amplitude taper',
      min: 0,
      max: 1,
      step: 1,
      options: [
        { value: ARRAY_TAPER_UNIFORM, label: 'Uniform' },
        { value: ARRAY_TAPER_COSINE, label: 'Cosine' },
      ],
    },
  ],
  pattern: (theta, phi, p) => arrayPattern(theta, phi, p),
  numericNormalize: true,
  peakHints: (p) => [[p.scanThetaRad, p.scanPhiRad]],
  cutPhis: (p) => [p.scanPhiRad, p.scanPhiRad + Math.PI / 2],
  info: (p, f) => {
    const lambdaCm = wavelength(f) * 100
    return [
      { label: 'Elements', value: Math.round(p.nx) * Math.round(p.ny), unit: '', digits: 0 },
      { label: 'Aperture', value: Math.round(p.nx) * p.dxLambda * lambdaCm, unit: 'cm (x)', digits: 1 },
      { label: 'Aperture', value: Math.round(p.ny) * p.dyLambda * lambdaCm, unit: 'cm (y)', digits: 1 },
      { label: 'Grating-lobe limit at θ0', value: 1 / (1 + Math.abs(Math.sin(p.scanThetaRad))), unit: 'λ', digits: 2 },
    ]
  },
  warnings: (p) => {
    const worst = Math.max(p.dxLambda, p.dyLambda)
    return gratingLobeRisk(worst, p.scanThetaRad)
      ? [
          `Grating lobe: spacing ${worst.toFixed(2)} λ ≥ ${(1 / (1 + Math.abs(Math.sin(p.scanThetaRad)))).toFixed(2)} λ at this steering angle. A second full-strength beam appears.`,
        ]
      : []
  },
})
