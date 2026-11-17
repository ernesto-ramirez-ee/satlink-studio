// Quarter-wave monopole over an ideal infinite ground plane (the z = 0 plane).
// Image theory: the dipole pattern in the upper half-space, nothing below → twice the
// dipole gain, 3.28 (5.15 dBi). Peak at the horizon (θ = 90°).

import { wavelength } from '../units'
import { HALF_WAVE_DIPOLE_GAIN, halfWaveDipolePower } from './dipole'
import { defineAntenna } from './define'

export type MonopoleParams = Record<string, never>

export const monopole = defineAntenna<MonopoleParams>({
  id: 'monopole',
  label: 'Quarter-wave monopole',
  description: 'λ/4 whip on an ideal ground plane. Omnidirectional, peak toward the horizon; linear polarization.',
  polarization: 'linear',
  defaults: {},
  defaultFreqHz: 437e6,
  paramSpecs: [],
  pattern: (theta) => (theta <= Math.PI / 2 ? halfWaveDipolePower(Math.cos(theta)) : 0),
  peakGain: () => 2 * HALF_WAVE_DIPOLE_GAIN,
  info: (_p, f) => [{ label: 'Length (λ/4)', value: (wavelength(f) / 4) * 100, unit: 'cm', digits: 1 }],
})
