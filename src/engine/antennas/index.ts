// Registry of the 8 antenna models (docs/PHYSICS.md, Phase 1).

import { dipole } from './dipole'
import { dish } from './dish'
import { helix } from './helix'
import { monopole } from './monopole'
import { patch } from './patch'
import { phasedArray } from './phasedArray'
import { qfh } from './qfh'
import type { AntennaId, AntennaModel } from './types'
import { yagi } from './yagi'

export const ANTENNAS: readonly AntennaModel[] = [dipole, monopole, qfh, yagi, helix, patch, dish, phasedArray]

export function getAntenna(id: AntennaId): AntennaModel {
  const model = ANTENNAS.find((a) => a.id === id)
  if (!model) throw new Error(`Unknown antenna: ${id}`)
  return model
}

export type { AntennaId, AntennaModel, InfoItem, ParamSpec, Params, Polarization } from './types'
export { gratingLobeRisk } from './phasedArray'
