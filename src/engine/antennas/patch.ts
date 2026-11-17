// Rectangular microstrip patch, approximated by cosⁿθ in the front hemisphere.
// Closed form: ∫ cosⁿθ dΩ over the hemisphere = 2π/(n + 1) → D = 2(n + 1).
// n = 1.5 + 1/εr is an ASSUMED trend (a lower εr gives a larger patch and a narrower beam),
// chosen so that D falls in the textbook 6–8 dBi range. See D-007.

import { wavelength } from '../units'
import { defineAntenna } from './define'

export type PatchParams = { epsR: number }

export const patchExponent = (p: PatchParams): number => 1.5 + 1 / p.epsR

export const patch = defineAntenna<PatchParams>({
  id: 'patch',
  label: 'Microstrip patch',
  description: 'Flat metal patch over a ground plane on a dielectric substrate. Broad single-lobe beam; linear polarization.',
  polarization: 'linear',
  defaults: { epsR: 2.2 },
  defaultFreqHz: 1.57542e9,
  paramSpecs: [{ key: 'epsR', label: 'Substrate εr', min: 1, max: 12, step: 0.1 }],
  pattern: (theta, _phi, p) => (theta <= Math.PI / 2 ? Math.cos(theta) ** patchExponent(p) : 0),
  peakGain: (p) => 2 * (patchExponent(p) + 1),
  info: (p, f) => [
    // Resonant length without fringing correction: L ≈ λ / (2√εr).
    { label: 'Patch length (approx.)', value: (wavelength(f) / (2 * Math.sqrt(p.epsR))) * 1000, unit: 'mm', digits: 1 },
  ],
})
