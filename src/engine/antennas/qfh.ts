// QFH / turnstile: two crossed short dipoles fed 90° apart → RHCP toward zenith.
// Turnstile power pattern (1 + cos²θ)/2: 1 at zenith, 0.5 (−3 dB) at the horizon.
// A QFH suppresses the lower hemisphere; that is modelled as a front-to-back ratio k
// (assumed default 10 dB). Closed form: ∮F dΩ = (4π/3)(1 + k) → D = 3/(1 + k).

import { fromDb } from '../units'
import { defineAntenna } from './define'

export type QfhParams = { frontBackDb: number }

export const qfh = defineAntenna<QfhParams>({
  id: 'qfh',
  label: 'QFH / turnstile',
  description:
    'Crossed dipoles in quadrature (RHCP). Broad hemispherical coverage, ideal for LEO weather satellites. Back lobe set by the front-to-back ratio (assumed).',
  polarization: 'rhcp',
  defaults: { frontBackDb: 10 },
  defaultFreqHz: 137.5e6,
  paramSpecs: [{ key: 'frontBackDb', label: 'Front-to-back ratio', min: 0, max: 25, step: 1, unit: 'dB' }],
  pattern: (theta, _phi, p) => {
    const c = Math.cos(theta)
    const base = (1 + c * c) / 2
    return theta <= Math.PI / 2 ? base : base * fromDb(-p.frontBackDb)
  },
  peakGain: (p) => 3 / (1 + fromDb(-p.frontBackDb)),
})
