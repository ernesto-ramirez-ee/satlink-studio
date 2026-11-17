// Display formatting only (no physics).
import type { AntennaId } from '../engine/antennas'
import type { OrbitClass } from '../engine/orbit'

/** Colour-blind-friendly categorical colours (Okabe–Ito based), fixed per antenna. */
export const ANTENNA_COLORS: Record<AntennaId, string> = {
  monopole: '#56B4E9',
  dipole: '#0072B2',
  qfh: '#009E73',
  patch: '#B8860B',
  yagi: '#E69F00',
  helix: '#CC79A7',
  dish: '#7B52AE',
  'phased-array': '#17BECF',
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export const compass = (azDeg: number): string => COMPASS[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16]

export const fmtTime = (d: Date): string =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

export const fmtDayTime = (d: Date): string =>
  `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${fmtTime(d)}`

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return h > 0 ? `${h} h ${m} min` : `${m}:${String(ss).padStart(2, '0')}`
}

export function fmtAge(ms: number): string {
  const h = ms / 3_600_000
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`
}

export const ORBIT_CLASSES: OrbitClass[] = ['LEO', 'MEO', 'GEO', 'HEO']

/** CSS variable holding each orbit class's colour (see index.css). */
export const orbitColorVar = (c: OrbitClass): string => `--orbit-${c.toLowerCase()}`

/** Cyclic colour scale for phase (twilight-like): the same colour at 0 and 1, so 0° and 360° match. */
export const PHASE_COLOR_STOPS: [number, string][] = [
  [0, '#e2d9e2'],
  [0.125, '#9ebbc9'],
  [0.25, '#6276ba'],
  [0.375, '#5a3b9b'],
  [0.5, '#2f1436'],
  [0.625, '#6d1f45'],
  [0.75, '#b5523b'],
  [0.875, '#d9a28d'],
  [1, '#e2d9e2'],
]

const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]

/** RGB (0–255) for a phase in degrees, interpolated on PHASE_COLOR_STOPS. */
export function phaseRgb(deg: number): [number, number, number] {
  const x = (((deg % 360) + 360) % 360) / 360
  for (let i = 1; i < PHASE_COLOR_STOPS.length; i++) {
    const [x1, c1] = PHASE_COLOR_STOPS[i]
    if (x <= x1) {
      const [x0, c0] = PHASE_COLOR_STOPS[i - 1]
      const f = (x - x0) / (x1 - x0)
      const a = hexRgb(c0)
      const b = hexRgb(c1)
      return [0, 1, 2].map((k) => Math.round(a[k] + f * (b[k] - a[k]))) as [number, number, number]
    }
  }
  return hexRgb(PHASE_COLOR_STOPS[0][1])
}

/**
 * Plotly date axes have no time zone: a string is shown as written. Send times as local
 * wall-clock strings ("YYYY-MM-DD HH:MM:SS.sss") so traces and shapes line up.
 */
export const localStamp = (d: Date): string =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 23).replace('T', ' ')

export function cssVar(name: string, fallback = '#888'): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
