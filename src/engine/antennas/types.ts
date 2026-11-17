// Shared antenna types. Angles in radians, gains linear, frequency in Hz.
// θ is measured from the antenna boresight (+z), φ around it (docs/PHYSICS.md).

export type AntennaId = 'dipole' | 'monopole' | 'qfh' | 'yagi' | 'helix' | 'patch' | 'dish' | 'phased-array'

export type Polarization = 'linear' | 'rhcp' | 'lhcp'

/** All antenna parameters are numbers (options are encoded as 0, 1, …). */
export type Params = Record<string, number>

/**
 * Describes one slider (or drop-down when `options` is set) for the UI.
 * `key` is a plain string: a `keyof P` key would make every model incompatible with the
 * generic registry type (keyof is contravariant). index.test.ts checks the keys instead.
 */
export interface ParamSpec {
  key: string
  label: string
  /** min, max and step are in display units (value × displayScale). */
  min: number
  max: number
  step: number
  unit?: string
  /** display value = engine value × displayScale (e.g. 180/π for an angle in degrees). Default 1. */
  displayScale?: number
  options?: { value: number; label: string }[]
}

/** An extra readout, already in display units. */
export interface InfoItem {
  label: string
  value: number
  unit: string
  digits?: number
}

export interface AntennaModel<P extends Params = Params> {
  id: AntennaId
  label: string
  description: string
  polarization: Polarization
  defaults: P
  defaultFreqHz: number
  paramSpecs: ParamSpec[]
  /** Linear gain toward (θ, φ). */
  gain(thetaRad: number, phiRad: number, params: P, freqHz: number): number
  peakGainDbi(params: P, freqHz: number): number
  /** The two φ values of the principal-plane cuts (default 0 and π/2). */
  cutPhis(params: P): [number, number]
  info(params: P, freqHz: number): InfoItem[]
  warnings(params: P, freqHz: number): string[]
}
