// Parabolic dish (circular aperture of diameter D).
// Uniform illumination: E(u) = 2·J1(u)/u   (HPBW ≈ 58.9·λ/D deg, first sidelobe −17.6 dB)
// (1 − r²) taper:       E(u) = 8·J2(u)/u²  (HPBW ≈ 72.8·λ/D deg, first sidelobe −24.6 dB)
// with u = (πD/λ)·sinθ. Gain G = η·(πD/λ)². Back hemisphere set to zero (no spillover modelled).

import { jinc, jinc2 } from '../math/bessel'
import { wavelength } from '../units'
import { defineAntenna } from './define'

export type DishParams = { diameterM: number; efficiency: number; taper: number }

export const DISH_TAPER_UNIFORM = 0
export const DISH_TAPER_PARABOLIC = 1

export const dishGain = (p: DishParams, freqHz: number): number =>
  p.efficiency * ((Math.PI * p.diameterM) / wavelength(freqHz)) ** 2

export const dish = defineAntenna<DishParams>({
  id: 'dish',
  label: 'Parabolic dish',
  description: 'Reflector focusing a circular aperture. Very high gain and a narrow beam that must be pointed accurately.',
  polarization: 'linear',
  defaults: { diameterM: 1, efficiency: 0.6, taper: DISH_TAPER_PARABOLIC },
  defaultFreqHz: 12e9,
  paramSpecs: [
    { key: 'diameterM', label: 'Diameter', min: 0.3, max: 5, step: 0.05, unit: 'm' },
    { key: 'efficiency', label: 'Aperture efficiency η', min: 0.3, max: 0.85, step: 0.01 },
    {
      key: 'taper',
      label: 'Illumination',
      min: 0,
      max: 1,
      step: 1,
      options: [
        { value: DISH_TAPER_UNIFORM, label: 'Uniform' },
        { value: DISH_TAPER_PARABOLIC, label: 'Tapered (1 − r²)' },
      ],
    },
  ],
  pattern: (theta, _phi, p, f) => {
    if (theta > Math.PI / 2) return 0
    const u = ((Math.PI * p.diameterM) / wavelength(f)) * Math.sin(theta)
    const e = p.taper === DISH_TAPER_UNIFORM ? jinc(u) : jinc2(u)
    return e * e
  },
  peakGain: dishGain,
  info: (p, f) => [{ label: 'D/λ', value: p.diameterM / wavelength(f), unit: '', digits: 1 }],
})
