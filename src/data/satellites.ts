// Hand-curated RF specs (public/data/satellites.json, schema in docs/DATA_SOURCES.md).
import type { Polarization } from '../engine/antennas'
import type { OrbitClass } from '../engine/orbit'
import type { TleGroupId } from './tle'

/** Fields of a downlink that must each be either sourced or listed in `assumed`. */
export const DOWNLINK_VALUE_FIELDS = ['freqHz', 'polarization', 'eirpDbw', 'dataRateBps', 'requiredEbN0Db'] as const
export type DownlinkValueField = (typeof DOWNLINK_VALUE_FIELDS)[number]

export interface SatDownlink {
  id: string
  label: string
  modulation: string
  freqHz: number
  polarization: Polarization
  eirpDbw: number
  /** Optional EIRP (dBW) vs. ground elevation (deg) for shaped beams; see engine eirpAt(). */
  eirpByElevationDeg?: [number, number][]
  dataRateBps: number
  requiredEbN0Db: number
  /** URLs backing every field not listed in `assumed`. */
  sources: string[]
  /** Fields whose values are assumed (shown with a badge in the UI). */
  assumed: DownlinkValueField[]
  notes?: string
}

export interface SatelliteSpec {
  noradId: number
  name: string
  orbit: OrbitClass
  tleGroup: TleGroupId
  downlinks: SatDownlink[]
}

export interface SatelliteFile {
  schemaVersion: 2
  notes?: string
  satellites: SatelliteSpec[]
}

let pending: Promise<SatelliteSpec[]> | undefined

export function loadSatellites(): Promise<SatelliteSpec[]> {
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}data/satellites.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`satellites.json: HTTP ${r.status}`)
        return r.json() as Promise<SatelliteFile>
      })
      .then((f) => f.satellites)
    pending.catch(() => (pending = undefined))
  }
  return pending
}
