// Link budget (docs/PHYSICS.md, Phase 3). Everything in dB at this level, since that's how
// budgets are stated; inputs and outputs carry their units in their names.
//
//   C/N0 = EIRP − L_fs − L_atm − L_pol − L_point + G/T − k        [dBHz]   (k = −228.6 dBW/K/Hz)
//   Eb/N0 = C/N0 − 10·log10(Rb)
//   Margin = Eb/N0 − (Eb/N0)_required

import { K_BOLTZMANN_DB, fspl, toDb } from '../units'

export interface LinkInputs {
  eirpDbw: number
  freqHz: number
  rangeM: number
  rxGainDbi: number
  tSysK: number
  atmLossDb: number
  polLossDb: number
  pointingLossDb: number
  dataRateBps: number
  requiredEbN0Db: number
}

export interface LinkResult {
  fsplDb: number
  gOverTDbK: number
  cn0DbHz: number
  ebn0Db: number
  marginDb: number
}

export function linkBudget(i: LinkInputs): LinkResult {
  const fsplDb = fspl(i.rangeM, i.freqHz)
  const gOverTDbK = i.rxGainDbi - toDb(i.tSysK)
  const cn0DbHz = i.eirpDbw - fsplDb - i.atmLossDb - i.polLossDb - i.pointingLossDb + gOverTDbK - K_BOLTZMANN_DB
  const ebn0Db = cn0DbHz - toDb(i.dataRateBps)
  return { fsplDb, gOverTDbK, cn0DbHz, ebn0Db, marginDb: ebn0Db - i.requiredEbN0Db }
}
