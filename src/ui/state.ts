// Cross-tab UI state shapes (docs/ARCHITECTURE.md, "Shared state").
import { ANTENNAS, type AntennaId, type Params } from '../engine/antennas'
import type { ObserverDeg } from '../engine/orbit'

export interface AntennaSettings {
  params: Params
  freqHz: number
}

export type AntennaSettingsById = Record<AntennaId, AntennaSettings>

/** Each antenna keeps its own slider values, so switching type and back doesn't reset them. */
export function initialAntennaSettings(): AntennaSettingsById {
  const out = {} as AntennaSettingsById
  for (const a of ANTENNAS) out[a.id] = { params: { ...a.defaults }, freqHz: a.defaultFreqHz }
  return out
}

export interface ObserverState extends ObserverDeg {
  source: 'gps' | 'manual' | 'default'
  label?: string
}

export const DEFAULT_OBSERVER: ObserverState = {
  latDeg: 41.7002,
  lonDeg: -86.2379,
  altM: 220,
  source: 'default',
  label: 'Notre Dame, IN (default)',
}

const OBSERVER_KEY = 'satlink.observer.v1'

/** The last location is remembered in this browser only (a convenience; never sent anywhere). */
export function loadObserver(): ObserverState {
  try {
    const raw = localStorage.getItem(OBSERVER_KEY)
    if (raw) {
      const o = JSON.parse(raw) as ObserverState
      if (isValidLatLon(o.latDeg, o.lonDeg) && Number.isFinite(o.altM)) return o
    }
  } catch {
    // Storage unavailable (private mode) — fall through to the default.
  }
  return DEFAULT_OBSERVER
}

export function saveObserver(o: ObserverState): void {
  try {
    localStorage.setItem(OBSERVER_KEY, JSON.stringify(o))
  } catch {
    // Ignore: the app works without storage.
  }
}

export const isValidLatLon = (lat: number, lon: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

/** Default satellite selection: the ISS. */
export const DEFAULT_NORAD_ID = 25544

/** Default receiver (LNA) noise figure, dB — a typical low-cost LNA. */
export const DEFAULT_NOISE_FIGURE_DB = 1
