// Yagi-Uda, end-fire along +z, driven element parallel to x.
// Pattern: Hansen-Woodyard end-fire array factor × half-wave dipole element.
// Gain: log-linear interpolation of the optimized-Yagi table in NBS Technical Note 688
// (Viezbicke, 1976), which depends on boom length, not element count. See D-007.

import { fromDb, wavelength } from '../units'
import { defineAntenna } from './define'
import { HALF_WAVE_DIPOLE_GAIN, halfWaveDipolePower } from './dipole'

export type YagiParams = { elements: number; boomLambda: number }

/** NBS TN 688 optimized designs: boom length (λ) → gain over a dipole (dBd). */
export const NBS_YAGI_TABLE: readonly [number, number][] = [
  [0.4, 7.1],
  [0.8, 9.2],
  [1.2, 10.2],
  [2.2, 12.25],
  [3.2, 13.4],
  [4.2, 14.2],
]

export function yagiGainDbd(boomLambda: number): number {
  const t = NBS_YAGI_TABLE
  const x = Math.log10(Math.min(Math.max(boomLambda, t[0][0]), t[t.length - 1][0]))
  for (let i = 1; i < t.length; i++) {
    const x1 = Math.log10(t[i][0])
    if (x <= x1) {
      const x0 = Math.log10(t[i - 1][0])
      return t[i - 1][1] + ((x - x0) / (x1 - x0)) * (t[i][1] - t[i - 1][1])
    }
  }
  return t[t.length - 1][1]
}

export const yagi = defineAntenna<YagiParams>({
  id: 'yagi',
  label: 'Yagi-Uda',
  description:
    'Driven dipole plus reflector and directors along a boom. Directional, linear polarization; gain grows with boom length.',
  polarization: 'linear',
  defaults: { elements: 5, boomLambda: 1.2 },
  defaultFreqHz: 437e6,
  paramSpecs: [
    { key: 'elements', label: 'Elements', min: 3, max: 20, step: 1 },
    { key: 'boomLambda', label: 'Boom length', min: 0.4, max: 4.2, step: 0.1, unit: 'λ' },
  ],
  pattern: (theta, phi, p) => {
    const n = Math.round(p.elements)
    const kd = (2 * Math.PI * p.boomLambda) / (n - 1)
    // Hansen-Woodyard: progressive phase −(kd + π/N).
    const psi = kd * (Math.cos(theta) - 1) - Math.PI / n
    const s = Math.sin(psi / 2)
    const af = Math.abs(s) < 1e-12 ? n * n : (Math.sin((n * psi) / 2) / s) ** 2
    return af * halfWaveDipolePower(Math.sin(theta) * Math.cos(phi))
  },
  numericNormalize: true,
  peakHints: () => [[0, 0]],
  peakGain: (p) => fromDb(yagiGainDbd(p.boomLambda)) * HALF_WAVE_DIPOLE_GAIN,
  info: (p, f) => [
    { label: 'Boom length', value: p.boomLambda * wavelength(f), unit: 'm', digits: 2 },
    { label: 'Element spacing', value: p.boomLambda / (Math.round(p.elements) - 1), unit: 'λ', digits: 2 },
  ],
  warnings: (p) =>
    p.boomLambda / (Math.round(p.elements) - 1) > 0.45
      ? ['Element spacing above 0.45 λ: real Yagis use more elements on a boom this long. The pattern shows extra lobes.']
      : [],
})
