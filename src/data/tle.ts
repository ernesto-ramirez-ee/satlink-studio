// Loads the same-origin CelesTrak snapshot in public/data/tle/ (D-004) and builds a satellite catalog.
import { classifyOrbit, epochOf, meanMotionRevPerDay, satrecFromOmm } from '../engine/orbit'
import type { OMMJsonObject, OrbitClass, SatRec } from '../engine/orbit'

/** Keep in sync with scripts/fetch-tle.mjs. */
export const TLE_GROUPS = [
  { id: 'stations', label: 'Space stations', defaultOn: true },
  { id: 'weather', label: 'Weather', defaultOn: true },
  { id: 'amateur', label: 'Amateur', defaultOn: true },
  { id: 'gps-ops', label: 'GPS', defaultOn: true },
  { id: 'iridium-NEXT', label: 'Iridium NEXT', defaultOn: false },
  { id: 'geo', label: 'Geostationary', defaultOn: false },
  { id: 'starlink', label: 'Starlink (large)', defaultOn: false },
] as const

export type TleGroupId = (typeof TLE_GROUPS)[number]['id']

export interface TleIndex {
  fetchedAt: string | null
  groups: Partial<Record<TleGroupId, { count: number; file: string }>>
}

export interface CatalogEntry {
  noradId: number
  name: string
  groups: TleGroupId[]
  satrec: SatRec
  orbitClass: OrbitClass
  epoch: Date
}

const dataUrl = (path: string): string => `${import.meta.env.BASE_URL}data/${path}`

let indexPromise: Promise<TleIndex> | undefined
const groupPromises = new Map<TleGroupId, Promise<OMMJsonObject[]>>()

export function loadTleIndex(): Promise<TleIndex> {
  if (!indexPromise) {
    indexPromise = fetch(dataUrl('tle/index.json')).then((r) => {
      if (!r.ok) throw new Error(`TLE index: HTTP ${r.status}`)
      return r.json() as Promise<TleIndex>
    })
  }
  return indexPromise
}

export function loadTleGroup(id: TleGroupId): Promise<OMMJsonObject[]> {
  let p = groupPromises.get(id)
  if (!p) {
    p = fetch(dataUrl(`tle/${id}.json`)).then((r) => {
      if (!r.ok) throw new Error(`TLE group ${id}: HTTP ${r.status}`)
      return r.json() as Promise<OMMJsonObject[]>
    })
    // Forget failures so a later attempt can retry.
    p.catch(() => groupPromises.delete(id))
    groupPromises.set(id, p)
  }
  return p
}

const entryCache = new Map<number, CatalogEntry>()

/** Builds catalog entries for the given groups, merging satellites that appear in several groups. */
export async function loadCatalog(ids: readonly TleGroupId[]): Promise<CatalogEntry[]> {
  const lists = await Promise.all(ids.map(async (id) => ({ id, records: await loadTleGroup(id) })))
  const byId = new Map<number, CatalogEntry>()
  for (const { id, records } of lists) {
    for (const omm of records) {
      const noradId = Number(omm.NORAD_CAT_ID)
      const existing = byId.get(noradId)
      if (existing) {
        if (!existing.groups.includes(id)) existing.groups.push(id)
        continue
      }
      let entry = entryCache.get(noradId)
      if (!entry) {
        try {
          const satrec = satrecFromOmm(omm)
          entry = {
            noradId,
            name: omm.OBJECT_NAME,
            groups: [],
            satrec,
            orbitClass: classifyOrbit(meanMotionRevPerDay(satrec), Number(omm.ECCENTRICITY)),
            epoch: epochOf(satrec),
          }
          entryCache.set(noradId, entry)
        } catch {
          continue // malformed record
        }
      }
      byId.set(noradId, { ...entry, groups: [id] })
    }
  }
  return [...byId.values()]
}
