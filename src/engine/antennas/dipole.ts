// Half-wave dipole: E(ψ) = cos(π/2·cosψ)/sinψ, where ψ is the angle from the dipole axis.
// Directivity 1.641 (2.15 dBi). The axis is +z, tilted by `tiltRad` toward +x.

import { wavelength } from '../units'
import { DEG, defineAntenna } from './define'

export type DipoleParams = { tiltRad: number }

/** Normalized half-wave dipole power pattern, given cos of the angle from the wire axis. */
export function halfWaveDipolePower(cosPsi: number): number {
  const sin2 = 1 - cosPsi * cosPsi
  if (sin2 < 1e-12) return 0
  const e = Math.cos((Math.PI / 2) * cosPsi)
  return (e * e) / sin2
}

export const HALF_WAVE_DIPOLE_GAIN = 1.641

export const dipole = defineAntenna<DipoleParams>({
  id: 'dipole',
  label: 'Half-wave dipole',
  description: 'Thin λ/2 wire. Doughnut pattern with nulls along the wire; linear polarization.',
  polarization: 'linear',
  defaults: { tiltRad: 0 },
  defaultFreqHz: 137.5e6,
  paramSpecs: [{ key: 'tiltRad', label: 'Axis tilt from z', min: 0, max: 90, step: 1, unit: '°', displayScale: DEG }],
  pattern: (theta, phi, p) => {
    const cosPsi = Math.sin(theta) * Math.cos(phi) * Math.sin(p.tiltRad) + Math.cos(theta) * Math.cos(p.tiltRad)
    return halfWaveDipolePower(cosPsi)
  },
  peakGain: () => HALF_WAVE_DIPOLE_GAIN,
  info: (_p, f) => [{ label: 'Length (λ/2)', value: (wavelength(f) / 2) * 100, unit: 'cm', digits: 1 }],
})
