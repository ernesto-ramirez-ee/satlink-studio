import { describe, expect, it } from 'vitest'
import file from '../../public/data/satellites.json'
import { TLE_GROUPS } from './tle'
import { DOWNLINK_VALUE_FIELDS, type SatelliteFile } from './satellites'

const data = file as SatelliteFile

describe('public/data/satellites.json', () => {
  it('uses schema version 2 and lists at least 10 satellites (PLAN.md Phase 3)', () => {
    expect(data.schemaVersion).toBe(2)
    expect(data.satellites.length).toBeGreaterThanOrEqual(10)
  })

  it('covers LEO, MEO and GEO', () => {
    const orbits = new Set(data.satellites.map((s) => s.orbit))
    for (const o of ['LEO', 'MEO', 'GEO']) expect(orbits.has(o as never)).toBe(true)
  })

  it('has unique NORAD IDs and downlink IDs, and known TLE groups', () => {
    const ids = data.satellites.map((s) => s.noradId)
    expect(new Set(ids).size).toBe(ids.length)
    const dl = data.satellites.flatMap((s) => s.downlinks.map((d) => d.id))
    expect(new Set(dl).size).toBe(dl.length)
    const groups = TLE_GROUPS.map((g) => g.id as string)
    for (const s of data.satellites) expect(groups).toContain(s.tleGroup)
  })

  it.each(data.satellites.flatMap((s) => s.downlinks.map((d) => [`${s.name} / ${d.id}`, d] as const)))(
    '%s: every value is sourced or flagged as assumed',
    (_name, d) => {
      for (const field of d.assumed) expect(DOWNLINK_VALUE_FIELDS).toContain(field)
      const sourced = DOWNLINK_VALUE_FIELDS.filter((f) => !d.assumed.includes(f))
      if (sourced.length > 0) {
        expect(d.sources.length).toBeGreaterThan(0)
        for (const u of d.sources) expect(u).toMatch(/^https:\/\//)
      }
      expect(d.freqHz).toBeGreaterThan(1e6)
      expect(d.dataRateBps).toBeGreaterThan(0)
      expect(['linear', 'rhcp', 'lhcp']).toContain(d.polarization)
      if (d.eirpByElevationDeg) {
        const els = d.eirpByElevationDeg.map(([e]) => e)
        expect([...els].sort((a, b) => a - b)).toEqual(els)
      }
    },
  )
})
