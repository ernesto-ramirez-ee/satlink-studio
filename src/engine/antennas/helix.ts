// Axial-mode helix over a ground plane (Kraus).
// Gain: G = 15·C²·N·S (C, S in wavelengths). HPBW ≈ 52°/(C·√(N·S)).
// Pattern: cosⁿθ in the front hemisphere, with n chosen to give that HPBW.
// Kraus's formula is known to be optimistic by 1–2 dB; it is the textbook reference here.

import { wavelength } from '../units'
import { defineAntenna } from './define'

export type HelixParams = { turns: number; spacingLambda: number; circLambda: number }

export const helixGain = (p: HelixParams): number => 15 * p.circLambda ** 2 * Math.round(p.turns) * p.spacingLambda

export const helixHpbwRad = (p: HelixParams): number =>
  ((52 / (p.circLambda * Math.sqrt(Math.round(p.turns) * p.spacingLambda))) * Math.PI) / 180

/** Exponent n such that cosⁿ(HPBW/2) = 1/2. */
const cosExponent = (p: HelixParams): number => Math.log(0.5) / Math.log(Math.cos(helixHpbwRad(p) / 2))

export const helix = defineAntenna<HelixParams>({
  id: 'helix',
  label: 'Axial-mode helix',
  description: 'Helical winding about one wavelength around, over a ground plane. Directional, circularly polarized (RHCP).',
  polarization: 'rhcp',
  defaults: { turns: 10, spacingLambda: 0.25, circLambda: 1 },
  defaultFreqHz: 2.4e9,
  paramSpecs: [
    { key: 'turns', label: 'Turns', min: 3, max: 30, step: 1 },
    { key: 'spacingLambda', label: 'Turn spacing', min: 0.2, max: 0.3, step: 0.01, unit: 'λ' },
    { key: 'circLambda', label: 'Circumference', min: 0.8, max: 1.2, step: 0.01, unit: 'λ' },
  ],
  pattern: (theta, _phi, p) => (theta <= Math.PI / 2 ? Math.cos(theta) ** cosExponent(p) : 0),
  peakGain: helixGain,
  info: (p, f) => {
    const lambda = wavelength(f)
    return [
      { label: 'Diameter', value: ((p.circLambda * lambda) / Math.PI) * 100, unit: 'cm', digits: 1 },
      { label: 'Axial length', value: Math.round(p.turns) * p.spacingLambda * lambda * 100, unit: 'cm', digits: 1 },
    ]
  },
})
