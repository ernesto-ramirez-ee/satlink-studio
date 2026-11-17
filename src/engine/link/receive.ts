// How each antenna type is installed at the ground station, its receive gain toward a satellite,
// and whether it is practical for a given band.
//
// Antenna frame for fixed mounts: +z = up, +x = east, +y = north, so a satellite at (az, el)
// is at θ = 90° − el, φ = 90° − az.

import { hpbwRad, sampleCut } from '../antennas/metrics'
import type { AntennaId, AntennaModel, Params } from '../antennas/types'
import { toDb, wavelength } from '../units'
import { pointingLossDb } from './propagation'

export type MountKind = 'fixed' | 'tracking' | 'electronic'

export interface GroundSetup {
  antennaId: AntennaId
  mount: MountKind
  /** Lower = simpler / cheaper; used to pick the "smallest" antenna that works. */
  complexityRank: number
  mountLabel: string
  /** Noise picked up from the warm ground (K), ASSUMED per antenna type. */
  groundPickupK: number
  /** RMS pointing error for tracking mounts (rad), ASSUMED. */
  pointingErrorRad: number
}

const DEG = Math.PI / 180

export const GROUND_SETUPS: Record<AntennaId, GroundSetup> = {
  monopole: { antennaId: 'monopole', mount: 'fixed', complexityRank: 1, mountLabel: 'Fixed, vertical', groundPickupK: 120, pointingErrorRad: 0 },
  dipole: { antennaId: 'dipole', mount: 'fixed', complexityRank: 2, mountLabel: 'Fixed (tilt from the Antenna Lab)', groundPickupK: 120, pointingErrorRad: 0 },
  qfh: { antennaId: 'qfh', mount: 'fixed', complexityRank: 3, mountLabel: 'Fixed, pointing up', groundPickupK: 60, pointingErrorRad: 0 },
  patch: { antennaId: 'patch', mount: 'fixed', complexityRank: 4, mountLabel: 'Fixed, facing up', groundPickupK: 50, pointingErrorRad: 0 },
  yagi: { antennaId: 'yagi', mount: 'tracking', complexityRank: 5, mountLabel: 'Az/el rotator', groundPickupK: 40, pointingErrorRad: 5 * DEG },
  helix: { antennaId: 'helix', mount: 'tracking', complexityRank: 6, mountLabel: 'Az/el rotator', groundPickupK: 40, pointingErrorRad: 5 * DEG },
  dish: { antennaId: 'dish', mount: 'tracking', complexityRank: 7, mountLabel: 'Motorized az/el', groundPickupK: 20, pointingErrorRad: 0.2 * DEG },
  'phased-array': { antennaId: 'phased-array', mount: 'electronic', complexityRank: 8, mountLabel: 'Flat panel facing up, steered electronically', groundPickupK: 30, pointingErrorRad: 0 },
}

/** Maximum electronic scan angle from the panel normal. */
export const ARRAY_MAX_SCAN_RAD = 60 * DEG

/** Direction (θ, φ) of a satellite in the frame of an upward-facing antenna. */
export const skyToAntennaFrame = (azRad: number, elRad: number): { theta: number; phi: number } => ({
  theta: Math.PI / 2 - elRad,
  phi: Math.PI / 2 - azRad,
})

/** Narrowest half-power beamwidth of the two principal cuts. */
export function beamwidthRad(model: AntennaModel, params: Params, freqHz: number): number {
  const [a, b] = model.cutPhis(params)
  const widths = [a, b].map((phi) => hpbwRad(sampleCut(model, params, freqHz, phi))).filter((w): w is number => w !== null)
  return widths.length ? Math.min(...widths) : Math.PI
}

/** Parameters with the array beam at broadside (the Link Check steers it itself). */
const broadside = (model: AntennaModel, params: Params): Params =>
  model.id === 'phased-array' ? { ...params, scanThetaRad: 0, scanPhiRad: 0 } : params

export interface ReceiveContext {
  setup: GroundSetup
  model: AntennaModel
  params: Params
  freqHz: number
  peakGainDbi: number
  hpbwRad: number
}

/** Precomputes the per-antenna values (peak gain, beamwidth) used at every time step. */
export function receiveContext(model: AntennaModel, params: Params, freqHz: number): ReceiveContext {
  const p = broadside(model, params)
  return {
    setup: GROUND_SETUPS[model.id],
    model,
    params: p,
    freqHz,
    peakGainDbi: model.peakGainDbi(p, freqHz),
    hpbwRad: beamwidthRad(model, p, freqHz),
  }
}

/** Receive gain toward the satellite (dBi), and the pointing / scan loss included in it. */
export function gainTowardDbi(ctx: ReceiveContext, azRad: number, elRad: number): { gainDbi: number; pointingLossDb: number } {
  const { setup, model, params, freqHz, peakGainDbi, hpbwRad: hpbw } = ctx
  if (setup.mount === 'tracking') {
    const loss = pointingLossDb(setup.pointingErrorRad, hpbw)
    return { gainDbi: peakGainDbi - loss, pointingLossDb: loss }
  }
  const { theta, phi } = skyToAntennaFrame(azRad, elRad)
  if (setup.mount === 'electronic') {
    // Scan loss cos^1.2(θ) inside the scan range; beyond it the beam stays at the limit and the
    // satellite falls off the side of the (broadened) beam.
    const scan = Math.min(theta, ARRAY_MAX_SCAN_RAD)
    const scanLossDb = -12 * Math.log10(Math.cos(scan))
    const offBeamDb = theta > ARRAY_MAX_SCAN_RAD ? pointingLossDb(theta - ARRAY_MAX_SCAN_RAD, hpbw / Math.cos(ARRAY_MAX_SCAN_RAD)) : 0
    return { gainDbi: peakGainDbi - scanLossDb - offBeamDb, pointingLossDb: scanLossDb + offBeamDb }
  }
  const g = model.gain(theta, phi, params, freqHz)
  return { gainDbi: g > 0 ? Math.max(toDb(g), -40) : -40, pointingLossDb: 0 }
}

export const MIN_DISH_DIAMETER_LAMBDA = 4

/** Whether an antenna is a sensible build for this band, with the reason if not. */
export function practicality(model: AntennaModel, params: Params, freqHz: number): { ok: boolean; reason: string } {
  const lambda = wavelength(freqHz)
  const mhz = freqHz / 1e6
  switch (model.id) {
    case 'monopole':
    case 'dipole':
    case 'qfh':
      return freqHz <= 3e9 ? { ok: true, reason: '' } : { ok: false, reason: `low gain and tiny above 3 GHz (${mhz.toFixed(0)} MHz)` }
    case 'yagi': {
      const boomM = params.boomLambda * lambda
      return boomM <= 6 ? { ok: true, reason: '' } : { ok: false, reason: `boom would be ${boomM.toFixed(1)} m long` }
    }
    case 'helix': {
      const lenM = Math.round(params.turns) * params.spacingLambda * lambda
      return lenM <= 3 ? { ok: true, reason: '' } : { ok: false, reason: `helix would be ${lenM.toFixed(1)} m long` }
    }
    case 'patch': {
      const lenM = lambda / (2 * Math.sqrt(params.epsR))
      return lenM <= 0.5 ? { ok: true, reason: '' } : { ok: false, reason: `patch would be ${(lenM * 100).toFixed(0)} cm across` }
    }
    case 'dish': {
      // Below ~4 λ the feed blocks much of the aperture and η(πD/λ)² stops being meaningful.
      // (A 1 m dish at 1.7 GHz, 5.7 λ, is the standard GOES HRIT setup.)
      const dl = params.diameterM / lambda
      return dl >= MIN_DISH_DIAMETER_LAMBDA
        ? { ok: true, reason: '' }
        : { ok: false, reason: `a ${params.diameterM} m dish is only ${dl.toFixed(1)} λ across here (needs ≥ ${MIN_DISH_DIAMETER_LAMBDA} λ)` }
    }
    case 'phased-array': {
      const sizeM = Math.max(Math.round(params.nx) * params.dxLambda, Math.round(params.ny) * params.dyLambda) * lambda
      return sizeM <= 1.5 ? { ok: true, reason: '' } : { ok: false, reason: `panel would be ${sizeM.toFixed(1)} m wide` }
    }
  }
}
