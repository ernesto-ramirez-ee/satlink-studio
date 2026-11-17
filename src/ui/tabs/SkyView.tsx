// Sky View tab: satellites above the observer now, the selected satellite's details, its passes
// over the next 24 h, and a 3D globe.
import { useMemo, useState } from 'react'
import { TLE_GROUPS, type CatalogEntry, type TleGroupId } from '../../data/tle'
import {
  findPasses,
  geodeticToEcefM,
  groundTrack,
  lookAnglesFromState,
  observerFromDeg,
  orbitalPeriodS,
  skyTrack,
  stateAt,
  type LookAngles,
  type SatState,
} from '../../engine/orbit'
import { rad2deg } from '../../engine/units'
import { GlobeView, type GlobeSat } from '../components/GlobeView'
import { SkyPlot, type SkyPoint } from '../components/SkyPlot'
import { compass, fmtAge, fmtDayTime, fmtDuration, fmtTime, orbitColorVar } from '../format'
import { useCatalog } from '../hooks'
import type { ObserverState } from '../state'

interface Props {
  observer: ObserverState
  now: Date
  selectedId: number
  onSelect: (noradId: number) => void
}

interface Live {
  entry: CatalogEntry
  state: SatState
  look: LookAngles
}

const PASS_WINDOW_S = 24 * 3600
const STALE_ELEMENTS_MS = 3 * 86_400_000

export function SkyView({ observer, now, selectedId, onSelect }: Props) {
  const [groups, setGroups] = useState<TleGroupId[]>(() => TLE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id))
  const [minElDeg, setMinElDeg] = useState(10)
  const [passIndex, setPassIndex] = useState(0)
  const [showGlobe, setShowGlobe] = useState(true)
  const catalog = useCatalog(groups)

  const obs = useMemo(() => observerFromDeg(observer), [observer])
  const obsEcef = useMemo(() => geodeticToEcefM(obs), [obs])

  // Big catalogs (Starlink) refresh every 5 s instead of every second.
  const periodMs = catalog.entries.length > 3000 ? 5000 : 1000
  const tick = Math.floor(now.getTime() / periodMs) * periodMs

  const live = useMemo<Live[]>(() => {
    const t = new Date(tick)
    const out: Live[] = []
    for (const entry of catalog.entries) {
      const state = stateAt(entry.satrec, t)
      if (state) out.push({ entry, state, look: lookAnglesFromState(obs, state, obsEcef) })
    }
    return out
  }, [catalog.entries, tick, obs, obsEcef])

  const visible = useMemo(
    () => live.filter((l) => l.look.elRad > 0).sort((a, b) => b.look.elRad - a.look.elRad),
    [live],
  )
  const selected = live.find((l) => l.entry.noradId === selectedId) ?? null
  const selectedEntry = useMemo(
    () => catalog.entries.find((e) => e.noradId === selectedId) ?? null,
    [catalog.entries, selectedId],
  )

  // Passes: recomputed every 10 minutes, from 20 min back so a pass in progress gets its real rise.
  const passWindowStart = Math.floor(now.getTime() / 600_000) * 600_000 - 1_200_000
  const passes = useMemo(
    () =>
      selectedEntry
        ? findPasses(selectedEntry.satrec, obs, new Date(passWindowStart), PASS_WINDOW_S, (minElDeg * Math.PI) / 180)
        : [],
    [selectedEntry, obs, passWindowStart, minElDeg],
  )
  const upcoming = passes.filter((p) => p.set.getTime() > now.getTime())
  const shownPass = upcoming[Math.min(passIndex, upcoming.length - 1)]
  const shownRise = shownPass?.rise.getTime()
  const shownSet = shownPass?.set.getTime()

  const track = useMemo(
    () =>
      selectedEntry && shownRise !== undefined && shownSet !== undefined
        ? skyTrack(selectedEntry.satrec, obs, new Date(shownRise), new Date(shownSet), 10).map((p) => ({
            azDeg: rad2deg(p.azRad),
            elDeg: rad2deg(p.elRad),
          }))
        : [],
    [selectedEntry, obs, shownRise, shownSet],
  )

  // One orbit of the selected satellite for the globe, refreshed every minute.
  const orbitStart = Math.floor(now.getTime() / 60_000) * 60_000
  const orbit = useMemo(() => {
    if (!selectedEntry) return []
    const periodS = orbitalPeriodS(selectedEntry.satrec)
    const step = Math.max(30, periodS / 240)
    return groundTrack(selectedEntry.satrec, new Date(orbitStart), Math.min(periodS, 86_400), step).map((g) => ({
      latDeg: rad2deg(g.latRad),
      lonDeg: rad2deg(g.lonRad),
      altM: g.altM,
    }))
  }, [selectedEntry, orbitStart])

  const skyPoints = useMemo<SkyPoint[]>(
    () =>
      visible.map((l) => ({
        noradId: l.entry.noradId,
        name: l.entry.name,
        azDeg: rad2deg(l.look.azRad),
        elDeg: rad2deg(l.look.elRad),
        orbitClass: l.entry.orbitClass,
      })),
    [visible],
  )

  const globeSats = useMemo<GlobeSat[]>(
    () =>
      live.map((l) => ({
        latDeg: rad2deg(l.state.latRad),
        lonDeg: rad2deg(l.state.lonRad),
        altM: l.state.altM,
        orbitClass: l.entry.orbitClass,
      })),
    [live],
  )

  const toggleGroup = (id: TleGroupId) =>
    setGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))

  const select = (id: number) => {
    onSelect(id)
    setPassIndex(0)
  }

  const sortedNames = useMemo(
    () => [...catalog.entries].sort((a, b) => a.name.localeCompare(b.name)),
    [catalog.entries],
  )

  return (
    <section className="sky">
      <div className="lab-head">
        <h2>Sky View</h2>
        <p className="muted">
          Satellites above your horizon right now, from SGP4 with the CelesTrak snapshot. Click a satellite to see its passes.
        </p>
      </div>

      <div className="card group-bar">
        <span className="panel-label">Show</span>
        {TLE_GROUPS.map((g) => (
          <label key={g.id} className="inline-check">
            <input type="checkbox" checked={groups.includes(g.id)} onChange={() => toggleGroup(g.id)} /> {g.label}
          </label>
        ))}
        <span className="muted small">
          {catalog.loading ? 'Loading…' : `${catalog.entries.length} satellites, ${visible.length} above the horizon`}
        </span>
        {catalog.error && (
          <p className="warning small" role="alert">
            Could not load orbit data: {catalog.error}
          </p>
        )}
      </div>

      <div className="sky-grid">
        <div className="card">
          <div className="card-head">
            <h3>Sky now</h3>
            <span className="muted small">Centre = overhead · edge = horizon</span>
          </div>
          <SkyPlot points={skyPoints} selectedId={selectedId} track={track} onSelect={select} />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Selected satellite</h3>
            <select
              aria-label="Selected satellite"
              value={selected ? selectedId : ''}
              onChange={(e) => select(Number(e.target.value))}
            >
              {!selected && <option value="">Pick a satellite…</option>}
              {sortedNames.map((e) => (
                <option key={e.noradId} value={e.noradId}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {!selected ? (
            <p className="muted">
              {catalog.loading
                ? 'Loading orbit data…'
                : `NORAD ${selectedId} isn't in the groups shown. Turn on its group or pick another satellite.`}
            </p>
          ) : (
            <>
              <dl className="readouts sat-readouts">
                <dt>Name / NORAD</dt>
                <dd>
                  {selected.entry.name} · {selected.entry.noradId}
                </dd>
                <dt>Orbit</dt>
                <dd>
                  <span className="orbit-dot" style={{ background: `var(${orbitColorVar(selected.entry.orbitClass)})` }} />
                  {selected.entry.orbitClass}, {(selected.state.altM / 1000).toFixed(0)} km altitude
                </dd>
                <dt>Azimuth</dt>
                <dd>
                  {rad2deg(selected.look.azRad).toFixed(1)}° ({compass(rad2deg(selected.look.azRad))})
                </dd>
                <dt>Elevation</dt>
                <dd className={selected.look.elRad > 0 ? 'good' : 'muted'}>
                  {rad2deg(selected.look.elRad).toFixed(1)}° {selected.look.elRad > 0 ? '(above horizon)' : '(below horizon)'}
                </dd>
                <dt>Slant range</dt>
                <dd>{(selected.look.rangeM / 1000).toFixed(0)} km</dd>
                <dt>Range rate</dt>
                <dd>{(selected.look.rangeRateMps / 1000).toFixed(2)} km/s</dd>
                <dt>Sub-satellite point</dt>
                <dd>
                  {rad2deg(selected.state.latRad).toFixed(2)}°, {rad2deg(selected.state.lonRad).toFixed(2)}°
                </dd>
                <dt>Element set age</dt>
                <dd className={now.getTime() - selected.entry.epoch.getTime() > STALE_ELEMENTS_MS ? 'bad' : ''}>
                  {fmtAge(now.getTime() - selected.entry.epoch.getTime())}
                </dd>
              </dl>

              <div className="card-head pass-head">
                <h3>Passes, next 24 h</h3>
                <label className="inline-check">
                  Min. elevation
                  <select value={minElDeg} onChange={(e) => setMinElDeg(Number(e.target.value))}>
                    {[0, 5, 10, 20, 30, 45].map((v) => (
                      <option key={v} value={v}>
                        {v}°
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {upcoming.length === 0 ? (
                <p className="muted">No passes above {minElDeg}° in the next 24 hours.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rise</th>
                        <th>Max el.</th>
                        <th>Set</th>
                        <th>Duration</th>
                        <th>Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((p, i) => {
                        const active = now >= p.rise && now <= p.set
                        return (
                          <tr
                            key={p.rise.getTime()}
                            className={`clickable${p === shownPass ? ' selected' : ''}`}
                            onClick={() => setPassIndex(i)}
                          >
                            <td>
                              {p.riseClipped ? 'Up now' : fmtDayTime(p.rise)}
                              {active && !p.riseClipped && <span className="badge">now</span>}
                            </td>
                            <td>
                              {rad2deg(p.maxElRad).toFixed(0)}°
                              {p.riseClipped && p.setClipped ? ' (stationary)' : ` at ${fmtTime(p.culmination)}`}
                            </td>
                            <td>{p.setClipped ? 'stays up' : fmtTime(p.set)}</td>
                            <td>{p.riseClipped || p.setClipped ? '—' : fmtDuration(p.set.getTime() - p.rise.getTime())}</td>
                            <td>
                              {compass(rad2deg(p.riseAzRad))} → {compass(rad2deg(p.setAzRad))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="muted small">Times in your browser’s time zone. Click a pass to draw its track on the sky plot.</p>
            </>
          )}
        </div>
      </div>

      <div className="sky-grid">
        <div className="card">
          <div className="card-head">
            <h3>Above the horizon</h3>
            <span className="muted small">Highest first</span>
          </div>
          <div className="table-wrap tall">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Satellite</th>
                  <th>Orbit</th>
                  <th>Az</th>
                  <th>El</th>
                  <th>Range</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 200).map((l) => (
                  <tr
                    key={l.entry.noradId}
                    className={`clickable${l.entry.noradId === selectedId ? ' selected' : ''}`}
                    onClick={() => select(l.entry.noradId)}
                  >
                    <td>{l.entry.name}</td>
                    <td>
                      <span className="orbit-dot" style={{ background: `var(${orbitColorVar(l.entry.orbitClass)})` }} />
                      {l.entry.orbitClass}
                    </td>
                    <td>{rad2deg(l.look.azRad).toFixed(0)}°</td>
                    <td>{rad2deg(l.look.elRad).toFixed(1)}°</td>
                    <td>{(l.look.rangeM / 1000).toFixed(0)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Globe</h3>
            <label className="inline-check">
              <input type="checkbox" checked={showGlobe} onChange={(e) => setShowGlobe(e.target.checked)} /> Show 3D globe
            </label>
          </div>
          {showGlobe ? (
            <GlobeView observer={observer} sats={globeSats} selected={selected ? globeSats[live.indexOf(selected)] : null} orbit={orbit} />
          ) : (
            <p className="muted">Hidden. The globe needs WebGL and is loaded only when shown.</p>
          )}
          <p className="muted small">Yellow pin: you. Red: the selected satellite and one orbit. Drag to rotate, scroll to zoom.</p>
        </div>
      </div>

      <details className="card simplifications">
        <summary>Simplifications and assumptions</summary>
        <ul>
          <li>Orbits use SGP4 (satellite.js) with CelesTrak element sets. Accuracy is about 1 km near the element epoch and gets worse over days; ages over 3 days are shown in red.</li>
          <li>TEME → Earth-fixed rotation uses Greenwich mean sidereal time only (no polar motion or nutation); this is far below the TLE error.</li>
          <li>Elevation is geometric: no atmospheric refraction (which lifts objects by ~0.5° at the horizon).</li>
          <li>Pass times are found on a 30 s grid and refined to about 0.01 s at the horizon and 0.5 s at culmination. Checked against Heavens-Above for the ISS.</li>
        </ul>
      </details>
    </section>
  )
}
