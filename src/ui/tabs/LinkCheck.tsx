// Link Check tab: link margin vs. time over a pass for every antenna, and the recommended antenna.
import { useEffect, useMemo, useState } from 'react'
import { loadSatellites, type SatDownlink, type SatelliteSpec } from '../../data/satellites'
import { ANTENNAS, getAntenna, type AntennaId } from '../../engine/antennas'
import {
  atmLossDb,
  eirpAt,
  GROUND_SETUPS,
  linkBudget,
  marginTimeline,
  recommend,
  REQUIRED_MARGIN_DB,
  type AntennaVerdict,
} from '../../engine/link'
import { findPasses, observerFromDeg, type Pass } from '../../engine/orbit'
import { rad2deg, toDb } from '../../engine/units'
import { MarginPlot } from '../components/MarginPlot'
import { ANTENNA_COLORS, fmtDayTime, fmtTime } from '../format'
import { useCatalog } from '../hooks'
import type { AntennaSettingsById, ObserverState } from '../state'

interface Props {
  observer: ObserverState
  now: Date
  selectedNoradId: number
  onSelectSatellite: (noradId: number) => void
  yourAntennaId: AntennaId
  antennaSettings: AntennaSettingsById
  noiseFigureDb: number
}

const MIN_PASS_EL_RAD = (10 * Math.PI) / 180
const GEO_WINDOW_MS = 3600e3

const fmtFreq = (hz: number) => (hz >= 1e9 ? `${(hz / 1e9).toFixed(4)} GHz` : `${(hz / 1e6).toFixed(3)} MHz`)
const fmtRate = (bps: number) =>
  bps >= 1e6 ? `${(bps / 1e6).toFixed(bps >= 1e7 ? 0 : 1)} Mbit/s` : bps >= 1e3 ? `${(bps / 1e3).toFixed(1)} kbit/s` : `${bps} bit/s`

function Assumed({ d, field }: { d: SatDownlink; field: SatDownlink['assumed'][number] }) {
  return d.assumed.includes(field) ? (
    <span className="badge assumed" title="Assumed value, not from a cited source">
      assumed
    </span>
  ) : null
}

export function LinkCheck({ observer, now, selectedNoradId, onSelectSatellite, yourAntennaId, antennaSettings, noiseFigureDb }: Props) {
  const [specs, setSpecs] = useState<SatelliteSpec[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [downlinkId, setDownlinkId] = useState<string | null>(null)
  const [passKey, setPassKey] = useState<number | null>(null)

  useEffect(() => {
    loadSatellites()
      .then(setSpecs)
      .catch((e: unknown) => setLoadError(String(e)))
  }, [])

  const spec = specs?.find((s) => s.noradId === selectedNoradId) ?? null
  const downlink = spec ? (spec.downlinks.find((d) => d.id === downlinkId) ?? spec.downlinks[0]) : null
  const catalog = useCatalog(spec ? [spec.tleGroup] : [])
  const entry = catalog.entries.find((e) => e.noradId === selectedNoradId) ?? null
  const obs = useMemo(() => observerFromDeg(observer), [observer])

  // Passes above 10° in the next 24 h (recomputed every 10 min).
  const windowStart = Math.floor(now.getTime() / 600_000) * 600_000 - 1_200_000
  const isGeo = spec?.orbit === 'GEO'
  const passes = useMemo<Pass[]>(
    () => (entry && !isGeo ? findPasses(entry.satrec, obs, new Date(windowStart), 86_400, MIN_PASS_EL_RAD) : []),
    [entry, obs, windowStart, isGeo],
  )
  const upcoming = passes.filter((p) => p.set.getTime() > now.getTime())
  const pass = upcoming.find((p) => p.rise.getTime() === passKey) ?? upcoming[0] ?? null

  // For GEO, a one-hour window starting now (the geometry barely changes).
  const geoStart = Math.floor(now.getTime() / 600_000) * 600_000
  const from = isGeo ? geoStart : pass?.rise.getTime()
  const to = isGeo ? geoStart + GEO_WINDOW_MS : pass?.set.getTime()

  const choices = useMemo(
    () => ANTENNAS.map((m) => ({ model: m, params: antennaSettings[m.id].params })),
    [antennaSettings],
  )

  const timeline = useMemo(
    () =>
      entry && downlink && from !== undefined && to !== undefined
        ? marginTimeline(entry.satrec, obs, new Date(from), new Date(to), downlink, choices, noiseFigureDb)
        : null,
    [entry, downlink, from, to, obs, choices, noiseFigureDb],
  )
  const geoVisible = !isGeo || (timeline !== null && timeline.elRad.some((e) => e > 0))
  const rec = useMemo(() => (timeline && geoVisible ? recommend(timeline) : null), [timeline, geoVisible])

  // Budget breakdown for YOUR antenna at the highest point of the window.
  const breakdown = useMemo(() => {
    if (!timeline || !downlink || timeline.times.length === 0) return null
    const i = timeline.elRad.indexOf(Math.max(...timeline.elRad))
    const s = timeline.series.find((x) => x.antennaId === yourAntennaId)
    if (!s) return null
    const atm = atmLossDb(downlink.freqHz, timeline.elRad[i])
    const eirp = eirpAt(downlink, timeline.elRad[i])
    const r = linkBudget({
      eirpDbw: eirp,
      freqHz: downlink.freqHz,
      rangeM: timeline.rangeM[i],
      rxGainDbi: s.gainDbi[i],
      tSysK: s.tSysK,
      atmLossDb: atm,
      polLossDb: s.polLossDb,
      pointingLossDb: 0,
      dataRateBps: downlink.dataRateBps,
      requiredEbN0Db: downlink.requiredEbN0Db,
    })
    return { i, s, atm, eirp, r, elDeg: rad2deg(timeline.elRad[i]), rangeKm: timeline.rangeM[i] / 1000, time: timeline.times[i] }
  }, [timeline, downlink, yourAntennaId])

  const verdictById = new Map<AntennaId, AntennaVerdict>((rec?.verdicts ?? []).map((v) => [v.antennaId, v]))

  if (loadError) return <p className="warning">Could not load satellite RF data: {loadError}</p>
  if (!specs) return <p className="muted">Loading satellite RF data…</p>

  const yours = getAntenna(yourAntennaId)
  const yourSeries = timeline?.series.find((s) => s.antennaId === yourAntennaId)

  return (
    <section className="link">
      <div className="lab-head">
        <h2>Link Check</h2>
        <p className="muted">
          Can you receive this satellite from where you are? Link margin over a pass for each antenna, using your Antenna
          Lab settings, plus the simplest antenna that works.
        </p>
      </div>

      <div className="card controls-bar">
        <label className="field">
          Satellite
          <select
            value={spec ? spec.noradId : ''}
            onChange={(e) => {
              onSelectSatellite(Number(e.target.value))
              setDownlinkId(null)
              setPassKey(null)
            }}
          >
            {!spec && <option value="">Pick a satellite with RF data…</option>}
            {specs.map((s) => (
              <option key={s.noradId} value={s.noradId}>
                {s.name} ({s.orbit})
              </option>
            ))}
          </select>
        </label>
        {spec && (
          <label className="field">
            Downlink
            <select value={downlink?.id} onChange={(e) => setDownlinkId(e.target.value)}>
              {spec.downlinks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} · {fmtFreq(d.freqHz)}
                </option>
              ))}
            </select>
          </label>
        )}
        {spec && !isGeo && (
          <label className="field">
            Pass
            <select value={pass ? pass.rise.getTime() : ''} onChange={(e) => setPassKey(Number(e.target.value))}>
              {upcoming.length === 0 && <option value="">No passes above 10° in 24 h</option>}
              {upcoming.map((p) => (
                <option key={p.rise.getTime()} value={p.rise.getTime()}>
                  {p.riseClipped ? 'Now' : fmtDayTime(p.rise)} · max {rad2deg(p.maxElRad).toFixed(0)}°
                </option>
              ))}
            </select>
          </label>
        )}
        {spec && isGeo && <span className="muted small">Geostationary: showing the next hour (the geometry is fixed).</span>}
      </div>

      {!spec && (
        <p className="warning">
          The satellite selected in Sky View (NORAD {selectedNoradId}) has no RF data yet. Pick one of the {specs.length}{' '}
          satellites above.
        </p>
      )}
      {spec && catalog.loading && <p className="muted">Loading orbit data…</p>}
      {spec && !catalog.loading && !entry && (
        <p className="warning">No orbit data for {spec.name} in the snapshot. Run npm run fetch-tle.</p>
      )}
      {spec && entry && !isGeo && upcoming.length === 0 && (
        <p className="warning">{spec.name} has no passes above 10° from your location in the next 24 hours.</p>
      )}
      {spec && entry && isGeo && !geoVisible && (
        <p className="warning">{spec.name} is below your horizon: a geostationary satellite can’t be seen from here.</p>
      )}

      {timeline && rec && downlink && (
        <>
          <div className="link-grid">
            <div className="card">
              <div className="card-head">
                <h3>Link margin vs. time</h3>
                <span className="muted small">
                  {isGeo ? 'Next hour' : pass && `${fmtTime(pass.rise)} – ${fmtTime(pass.set)}`} ·{' '}
                  {yourSeries?.practical
                    ? `thick line = your ${yours.label.toLowerCase()}`
                    : `your ${yours.label.toLowerCase()} isn't drawn (${yourSeries?.impracticalReason ?? 'not practical'})`}{' '}
                  · red = link fails
                </span>
              </div>
              <MarginPlot timeline={timeline} selectedAntennaId={yourAntennaId} recommendedId={rec.best?.antennaId ?? null} />
            </div>

            <div className="card rec-card">
              <h3>Recommended antenna</h3>
              {rec.best ? (
                <>
                  <p className="rec-name">
                    <span className="orbit-dot" style={{ background: ANTENNA_COLORS[rec.best.antennaId] }} />
                    {rec.best.label}
                  </p>
                  <p className="muted small">{GROUND_SETUPS[rec.best.antennaId].mountLabel}</p>
                  <p>{rec.reason}</p>
                  {rec.runnerUp && (
                    <p className="small">
                      Runner-up: <strong>{rec.runnerUp.label}</strong> (worst {rec.runnerUp.minMarginDb!.toFixed(1)} dB).
                    </p>
                  )}
                </>
              ) : (
                <p className="warning">{rec.reason}</p>
              )}
              {rec.simplerFailures.length > 0 && (
                <>
                  <p className="small panel-label">Why not something simpler?</p>
                  <ul className="small why-list">
                    {rec.simplerFailures.map((v) => (
                      <li key={v.antennaId}>
                        {v.label}: worst {v.minMarginDb!.toFixed(1)} dB at {rad2deg(v.worstElRad!).toFixed(0)}° elevation
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="muted small">
                Rule: simplest practical antenna with ≥ {REQUIRED_MARGIN_DB} dB margin for the whole pass above 10°.
                Antennas use your Antenna Lab settings at the downlink frequency.
              </p>
            </div>
          </div>

          <div className="card">
            <h3>All antennas</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Antenna</th>
                    <th>Mount</th>
                    <th>Gain toward sat. (max)</th>
                    <th>T_sys</th>
                    <th>Pol. loss</th>
                    <th>Worst margin ≥ 10°</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {[...timeline.series]
                    .sort((a, b) => a.complexityRank - b.complexityRank)
                    .map((s) => {
                      const v = verdictById.get(s.antennaId)
                      return (
                        <tr key={s.antennaId} className={s.antennaId === yourAntennaId ? 'selected' : ''}>
                          <td>
                            <span className="orbit-dot" style={{ background: ANTENNA_COLORS[s.antennaId] }} />
                            {s.label}
                            {s.antennaId === yourAntennaId && <span className="badge">yours</span>}
                          </td>
                          <td>{s.mountLabel}</td>
                          <td>{s.practical ? `${Math.max(...s.gainDbi).toFixed(1)} dBi` : '—'}</td>
                          <td>{Math.round(s.tSysK)} K</td>
                          <td>{s.polLossDb.toFixed(1)} dB</td>
                          <td className={v?.minMarginDb != null && v.minMarginDb < 0 ? 'bad' : ''}>
                            {s.practical && v?.minMarginDb != null ? `${v.minMarginDb.toFixed(1)} dB` : '—'}
                          </td>
                          <td>
                            {!s.practical ? (
                              <span className="muted">Not practical: {s.impracticalReason}</span>
                            ) : v?.passes ? (
                              <span className="good">{rec.best?.antennaId === s.antennaId ? '★ Recommended' : 'Works'}</span>
                            ) : v?.minMarginDb != null && v.minMarginDb >= 0 ? (
                              <span>Marginal (&lt; {REQUIRED_MARGIN_DB} dB)</span>
                            ) : (
                              <span className="bad">Fails</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="link-grid even">
            {breakdown && (
              <div className="card">
                <h3>Link budget: your {yours.label.toLowerCase()} at the highest point</h3>
                <p className="muted small">
                  {fmtTime(breakdown.time)} · elevation {breakdown.elDeg.toFixed(1)}° · range {breakdown.rangeKm.toFixed(0)} km
                </p>
                <dl className="readouts budget">
                  <dt>Satellite EIRP</dt>
                  <dd>
                    {breakdown.eirp >= 0 ? '+' : ''}
                    {breakdown.eirp.toFixed(1)} dBW
                  </dd>
                  <dt>Free-space path loss</dt>
                  <dd>−{breakdown.r.fsplDb.toFixed(1)} dB</dd>
                  <dt>Atmospheric loss</dt>
                  <dd>−{breakdown.atm.toFixed(2)} dB</dd>
                  <dt>Polarization loss</dt>
                  <dd>−{breakdown.s.polLossDb.toFixed(1)} dB</dd>
                  <dt>Receive gain toward satellite</dt>
                  <dd>{breakdown.s.gainDbi[breakdown.i].toFixed(1)} dBi</dd>
                  <dt>System noise temperature</dt>
                  <dd>
                    {Math.round(breakdown.s.tSysK)} K ({toDb(breakdown.s.tSysK).toFixed(1)} dBK)
                  </dd>
                  <dt>G/T</dt>
                  <dd>{breakdown.r.gOverTDbK.toFixed(1)} dB/K</dd>
                  <dt>Boltzmann constant</dt>
                  <dd>+228.6 dB</dd>
                  <dt>C/N0</dt>
                  <dd>{breakdown.r.cn0DbHz.toFixed(1)} dBHz</dd>
                  <dt>Data rate</dt>
                  <dd>−{toDb(downlink.dataRateBps).toFixed(1)} dBHz</dd>
                  <dt>Eb/N0</dt>
                  <dd>{breakdown.r.ebn0Db.toFixed(1)} dB</dd>
                  <dt>Required Eb/N0</dt>
                  <dd>−{downlink.requiredEbN0Db.toFixed(1)} dB</dd>
                  <dt>
                    <strong>Margin</strong>
                  </dt>
                  <dd className={breakdown.r.marginDb >= REQUIRED_MARGIN_DB ? 'good' : breakdown.r.marginDb >= 0 ? '' : 'bad'}>
                    <strong>{breakdown.r.marginDb.toFixed(1)} dB</strong>
                  </dd>
                </dl>
              </div>
            )}

            <div className="card">
              <h3>Downlink data: {downlink.label}</h3>
              <dl className="readouts budget">
                <dt>Frequency</dt>
                <dd>
                  {fmtFreq(downlink.freqHz)} <Assumed d={downlink} field="freqHz" />
                </dd>
                <dt>Modulation</dt>
                <dd>{downlink.modulation}</dd>
                <dt>Polarization</dt>
                <dd>
                  {downlink.polarization === 'linear' ? 'Linear' : downlink.polarization.toUpperCase()}{' '}
                  <Assumed d={downlink} field="polarization" />
                </dd>
                <dt>EIRP</dt>
                <dd>
                  {downlink.eirpByElevationDeg
                    ? `${downlink.eirpByElevationDeg.map(([e, p]) => `${p} dBW @ ${e}°`).join(', ')}`
                    : `${downlink.eirpDbw.toFixed(1)} dBW`}{' '}
                  <Assumed d={downlink} field="eirpDbw" />
                </dd>
                <dt>Data rate</dt>
                <dd>
                  {fmtRate(downlink.dataRateBps)} <Assumed d={downlink} field="dataRateBps" />
                </dd>
                <dt>Required Eb/N0</dt>
                <dd>
                  {downlink.requiredEbN0Db.toFixed(1)} dB <Assumed d={downlink} field="requiredEbN0Db" />
                </dd>
              </dl>
              {downlink.notes && <p className="small">{downlink.notes}</p>}
              <p className="small panel-label">Sources</p>
              <ul className="small source-list">
                {downlink.sources.map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noreferrer">
                      {u.replace(/^https?:\/\//, '').slice(0, 70)}
                      {u.replace(/^https?:\/\//, '').length > 70 ? '…' : ''}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <details className="card simplifications">
        <summary>Simplifications and assumptions</summary>
        <ul>
          <li>Receive-only. Satellite EIRP is constant over the pass (no satellite antenna pattern) unless a source says otherwise; values marked “assumed” are estimates.</li>
          <li>Atmosphere: clear-sky gaseous loss L_zenith/sin(el), clamped below 5°. No rain fade, scintillation or ionospheric effects.</li>
          <li>
            T_sys = galactic sky (≈ 60·λ^2.55 K) + atmosphere + ground pickup (assumed per antenna) + receiver from your LNA noise
            figure. No cable losses.
          </li>
          <li>Polarization: same circular sense 0 dB, opposite 20 dB, linear ↔ circular 3 dB, linear ↔ linear 3 dB average (orientation and Faraday rotation unknown).</li>
          <li>
            Mounts: monopole, dipole, QFH and patch are fixed and face up. Yagi and helix are on a rotator (5° pointing error assumed), the
            dish tracks with a 0.2° error, and the phased array steers up to 60° from zenith with cos^1.2 scan loss.
          </li>
          <li>Required Eb/N0 values depend on modulation and coding and are taken as typical values where not sourced.</li>
        </ul>
      </details>
    </section>
  )
}
