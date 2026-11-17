// Live Steering tab: dish pointing for the selected satellite, phased-array element phases, and
// the Starlink beam-hop demo. Everything follows the shared (simulated) clock.
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSatellites, type SatelliteSpec } from '../../data/satellites'
import type { TleGroupId } from '../../data/tle'
import { getAntenna, gratingLobeRisk } from '../../engine/antennas'
import { ARRAY_MAX_SCAN_RAD, beamwidthRad, practicality } from '../../engine/link'
import { findPasses, geodeticToEcefM, lookAngles, observerFromDeg, skyTrack, type Pass } from '../../engine/orbit'
import {
  BEAM_HOP_MIN_EL_RAD,
  beamHopSchedule,
  dishCommand,
  dopplerShiftHz,
  elementPhases,
  elementWeights,
  isKeyholePass,
  passPeakRates,
  quantizationLoss,
  ROTATOR_MAX_RATE_RAD_S,
  sampleAt,
  scanLossDb,
  steeringFromAzEl,
  tleAngularErrorRad,
  type BeamHopSchedule,
  type PassFrame,
} from '../../engine/steering'
import { downloadText, weightsCsv } from '../weightsCsv'
import { rad2deg, toDb } from '../../engine/units'
import { HopTimeline } from '../components/HopTimeline'
import { PassAnimationCard, type BeamHopSource } from '../components/PassAnimationCard'
import { PhaseMap } from '../components/PhaseMap'
import { SkyPlot, type SkyPoint } from '../components/SkyPlot'
import { compass, fmtDayTime, fmtDuration, fmtTime } from '../format'
import { useCatalog } from '../hooks'
import type { AntennaSettingsById, ObserverState } from '../state'

interface Props {
  observer: ObserverState
  now: Date
  selectedNoradId: number
  onSelectSatellite: (noradId: number) => void
  antennaSettings: AntennaSettingsById
}

/** Everything except Starlink (that one is loaded on demand by the beam-hop demo). */
const POINTING_GROUPS: TleGroupId[] = ['stations', 'weather', 'amateur', 'gps-ops', 'iridium-NEXT', 'geo']
const HOP_WINDOW_S = 30 * 60
const HOP_STEP_S = 10

const fmtFreq = (hz: number) => (hz >= 1e9 ? `${(hz / 1e9).toFixed(6)} GHz` : `${(hz / 1e6).toFixed(4)} MHz`)
const fmtRate = (radS: number) => `${rad2deg(radS) >= 0 ? '+' : ''}${rad2deg(radS).toFixed(2)}°/s`

export function LiveSteering({ observer, now, selectedNoradId, onSelectSatellite, antennaSettings }: Props) {
  const obs = useMemo(() => observerFromDeg(observer), [observer])
  const obsEcef = useMemo(() => geodeticToEcefM(obs), [obs])
  const catalog = useCatalog(POINTING_GROUPS)
  const entry = catalog.entries.find((e) => e.noradId === selectedNoradId) ?? null
  const sortedEntries = useMemo(() => [...catalog.entries].sort((a, b) => a.name.localeCompare(b.name)), [catalog.entries])

  const [specs, setSpecs] = useState<SatelliteSpec[]>([])
  useEffect(() => {
    loadSatellites()
      .then(setSpecs)
      .catch(() => setSpecs([]))
  }, [])
  const spec = specs.find((s) => s.noradId === selectedNoradId)

  // ---- Dish -------------------------------------------------------------------------------
  const dishModel = getAntenna('dish')
  const dishSettings = antennaSettings.dish
  const freqHz = spec?.downlinks[0]?.freqHz ?? dishSettings.freqHz
  const freqLabel = spec ? spec.downlinks[0].label : 'Antenna Lab dish frequency'
  const cmd = entry ? dishCommand(entry.satrec, obs, now, 0.5, obsEcef) : null
  const hpbw = useMemo(() => beamwidthRad(dishModel, dishSettings.params, freqHz), [dishModel, dishSettings.params, freqHz])
  const dishOk = practicality(dishModel, dishSettings.params, freqHz)

  const windowStart = Math.floor(now.getTime() / 600_000) * 600_000 - 1_200_000
  const passes = useMemo<Pass[]>(
    () => (entry ? findPasses(entry.satrec, obs, new Date(windowStart), 86_400, 0) : []),
    [entry, obs, windowStart],
  )
  const pass = passes.find((p) => p.set.getTime() > now.getTime()) ?? null
  const passStart = pass?.rise.getTime()
  const passEnd = pass?.set.getTime()
  // Recomputed when the pass list refreshes (every 10 min) or the next pass changes.
  const rates = useMemo(
    () => (entry && pass && !(pass.riseClipped && pass.setClipped) ? passPeakRates(entry.satrec, obs, pass) : null),
    [entry, obs, pass],
  )
  const passTrack = useMemo(
    () =>
      entry && passStart !== undefined && passEnd !== undefined
        ? skyTrack(entry.satrec, obs, new Date(passStart), new Date(Math.min(passEnd, passStart + 86_400e3)), 15).map((p) => ({
            azDeg: rad2deg(p.azRad),
            elDeg: rad2deg(p.elRad),
          }))
        : [],
    [entry, obs, passStart, passEnd],
  )

  // ---- Beam-hop ----------------------------------------------------------------------------
  const [hopOn, setHopOn] = useState(false)
  const starlink = useCatalog(hopOn ? ['starlink'] : [])
  const [hopState, setHopState] = useState<{ start: number; obs: typeof obs; schedule: BeamHopSchedule } | null>(null)
  // A schedule is only valid for the location it was computed for.
  const hop = hopState && hopState.obs === obs ? hopState : null
  const hopJob = useRef<number | null>(null)
  const nowMs = now.getTime()
  const needHop =
    hopOn && !starlink.loading && starlink.entries.length > 0 && (!hop || nowMs < hop.start || nowMs > hop.start + (HOP_WINDOW_S - 60) * 1000)

  useEffect(() => {
    if (!needHop || hopJob.current !== null) return
    const start = Math.floor(nowMs / (HOP_STEP_S * 1000)) * HOP_STEP_S * 1000
    const entries = starlink.entries
    // Deferred so "Computing…" paints before the (synchronous) schedule search.
    hopJob.current = window.setTimeout(() => {
      const schedule = beamHopSchedule(entries, obs, new Date(start), HOP_WINDOW_S, HOP_STEP_S)
      hopJob.current = null
      setHopState({ start, obs, schedule })
    }, 30)
  }, [needHop, nowMs, starlink.entries, obs])

  useEffect(
    () => () => {
      if (hopJob.current !== null) clearTimeout(hopJob.current)
    },
    [],
  )

  // The beam-hop as a source for the 3D animation.
  const starlinkFreqHz = specs.find((s) => s.tleGroup === 'starlink')?.downlinks[0]?.freqHz ?? 11.7e9
  const beamHopSource = useMemo<BeamHopSource | null>(
    () => (hop ? { schedule: hop.schedule, candidates: starlink.entries, freqHz: starlinkFreqHz } : null),
    [hop, starlink.entries, starlinkFreqHz],
  )
  const beamHopBusy = hopOn && (starlink.loading || needHop || !hop)

  const hopNow = hop ? sampleAt(hop.schedule, now) : null
  const servingName = hopNow?.noradId != null ? (starlink.entries.find((e) => e.noradId === hopNow.noradId)?.name ?? '') : null
  const nextHandover = hop?.schedule.handovers.find((h) => h.time > now) ?? null

  // Visible Starlink satellites for the beam-hop sky plot (recomputed at most every 2 s of sim time).
  const hopTick = Math.floor(nowMs / 2000)
  const starlinkPoints = useMemo<SkyPoint[]>(() => {
    if (!hopOn || starlink.entries.length === 0) return []
    const t = new Date(hopTick * 2000)
    const pts: SkyPoint[] = []
    for (const e of starlink.entries) {
      const l = lookAngles(e.satrec, obs, t, obsEcef)
      if (l && l.elRad > 0) pts.push({ noradId: e.noradId, name: e.name, azDeg: rad2deg(l.azRad), elDeg: rad2deg(l.elRad), orbitClass: 'LEO' })
    }
    return pts
  }, [hopOn, starlink.entries, hopTick, obs, obsEcef])

  const servingSeg = hop?.schedule.segments.find((s) => hopNow?.noradId === s.noradId && now >= s.start && now <= s.end)
  const servingTrack = useMemo(() => {
    const sat = servingSeg ? starlink.entries.find((e) => e.noradId === servingSeg.noradId) : undefined
    return sat && servingSeg
      ? skyTrack(sat.satrec, obs, servingSeg.start, servingSeg.end, 10).map((p) => ({ azDeg: rad2deg(p.azRad), elDeg: rad2deg(p.elRad) }))
      : []
  }, [servingSeg, starlink.entries, obs])

  // ---- Phased array ------------------------------------------------------------------------
  const [bits, setBits] = useState(0)
  const [arrayTarget, setArrayTarget] = useState<'animation' | 'selected' | 'beamhop'>('animation')
  // The frame shown by the 3D pass animation (slider / play / follow-clock).
  const [animFrame, setAnimFrame] = useState<PassFrame | null>(null)
  const arr = antennaSettings['phased-array'].params
  const target: { name: string; azRad: number; elRad: number; time: Date } | null =
    arrayTarget === 'beamhop'
      ? hopNow?.noradId != null
        ? { name: servingName ?? 'serving satellite', azRad: hopNow.azRad, elRad: hopNow.elRad, time: hopNow.time }
        : null
      : arrayTarget === 'animation'
        ? animFrame && entry
          ? animFrame.hidden
            ? { name: 'none (beam-hop outage)', azRad: 0, elRad: -Math.PI / 2, time: animFrame.time }
            : { name: animFrame.label ?? entry.name, azRad: animFrame.azRad, elRad: animFrame.elRad, time: animFrame.time }
          : null
        : cmd && entry
          ? { name: entry.name, azRad: cmd.azRad, elRad: cmd.elRad, time: now }
          : null
  const steer = target ? steeringFromAzEl(target.azRad, target.elRad) : null
  const belowHorizon = target ? target.elRad <= 0 : false
  const clamped = steer ? Math.min(steer.thetaRad, ARRAY_MAX_SCAN_RAD) : 0
  const thetaArg = steer && !belowHorizon ? clamped : 0
  const phiArg = steer?.phiRad ?? 0
  const phases = useMemo(
    () =>
      elementPhases({ nx: arr.nx, ny: arr.ny, dxLambda: arr.dxLambda, dyLambda: arr.dyLambda, thetaRad: thetaArg, phiRad: phiArg, bits }),
    [arr.nx, arr.ny, arr.dxLambda, arr.dyLambda, thetaArg, phiArg, bits],
  )
  const grating = steer ? gratingLobeRisk(Math.max(arr.dxLambda, arr.dyLambda), clamped) : false
  const weights = useMemo(
    () =>
      elementWeights({
        nx: arr.nx,
        ny: arr.ny,
        dxLambda: arr.dxLambda,
        dyLambda: arr.dyLambda,
        thetaRad: thetaArg,
        phiRad: phiArg,
        bits,
        taper: arr.taper,
      }),
    [arr.nx, arr.ny, arr.dxLambda, arr.dyLambda, thetaArg, phiArg, bits, arr.taper],
  )
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const csv = () =>
    weightsCsv(weights, {
      target: target?.name ?? 'none',
      time: target?.time ?? null,
      thetaDeg: rad2deg(thetaArg),
      phiDeg: rad2deg(phiArg),
      bits,
      taper: arr.taper === 1 ? 'cosine' : 'uniform',
      nx: Math.round(arr.nx),
      ny: Math.round(arr.ny),
      dxLambda: arr.dxLambda,
      dyLambda: arr.dyLambda,
      note: belowHorizon
        ? 'target below the horizon; broadside weights'
        : steer && steer.thetaRad > ARRAY_MAX_SCAN_RAD
          ? `target beyond the ${Math.round(rad2deg(ARRAY_MAX_SCAN_RAD))} deg scan limit; beam clamped`
          : undefined,
    })
  const csvName = () =>
    `phases_${(target?.name ?? 'array').replace(/[^A-Za-z0-9]+/g, '-')}_${(target?.time ?? now).toISOString().slice(0, 19).replace(/[:T]/g, '')}Z.csv`

  return (
    <section className="steer">
      <div className="lab-head">
        <h2>Live Steering</h2>
        <p className="muted">
          How to point a dish at the selected satellite, the phase of each phased-array element, and a Starlink-style
          beam-hop. Use ▶ / ❚❚ and ×60 in the header to run time faster for a demo.
        </p>
      </div>

      <div className="card controls-bar">
        <label className="field">
          Satellite
          <select value={entry ? selectedNoradId : ''} onChange={(e) => onSelectSatellite(Number(e.target.value))}>
            {!entry && <option value="">{catalog.loading ? 'Loading…' : 'Pick a satellite…'}</option>}
            {sortedEntries.map((e) => (
              <option key={e.noradId} value={e.noradId}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">Shared with Sky View and Link Check. Starlink is only used by the beam-hop demo below.</span>
      </div>

      {entry && (
        <PassAnimationCard
          satName={entry.name}
          satrec={entry.satrec}
          observerDeg={observer}
          obs={obs}
          now={now}
          passes={passes}
          dishParams={dishSettings.params}
          freqHz={freqHz}
          dishLabFreqHz={dishSettings.freqHz}
          arrayParams={antennaSettings['phased-array'].params}
          bits={bits}
          onFrame={setAnimFrame}
          beamHop={beamHopSource}
          beamHopBusy={beamHopBusy}
          onStartBeamHop={() => setHopOn(true)}
        />
      )}

      <div className="link-grid even">
        {/* Dish ----------------------------------------------------------------------------- */}
        <div className="card">
          <div className="card-head">
            <h3>Dish pointing</h3>
            <span className="muted small">
              {dishSettings.params.diameterM} m dish at {fmtFreq(freqHz)}
              {dishOk.ok ? ` · beamwidth ${rad2deg(hpbw).toFixed(2)}°` : ''}
            </span>
          </div>
          {!dishOk.ok && (
            <p className="warning small">
              Not a practical dish here: {dishOk.reason}. The pointing, slew and Doppler numbers below still apply to any
              tracking antenna, such as a Yagi on a rotator.
            </p>
          )}
          {!entry || !cmd ? (
            <p className="muted">{catalog.loading ? 'Loading orbit data…' : 'Pick a satellite.'}</p>
          ) : (
            <>
              <dl className="readouts budget">
                <dt>Azimuth command</dt>
                <dd>
                  {rad2deg(cmd.azRad).toFixed(2)}° ({compass(rad2deg(cmd.azRad))})
                </dd>
                <dt>Elevation command</dt>
                <dd className={cmd.elRad > 0 ? '' : 'muted'}>
                  {rad2deg(cmd.elRad).toFixed(2)}° {cmd.elRad > 0 ? '' : '(below horizon: park)'}
                </dd>
                <dt>Az / el slew rate</dt>
                <dd>
                  {fmtRate(cmd.azRateRadS)} / {fmtRate(cmd.elRateRadS)}
                </dd>
                <dt>Range rate</dt>
                <dd>{(cmd.rangeRateMps / 1000).toFixed(3)} km/s</dd>
                <dt>Doppler ({freqLabel})</dt>
                <dd>
                  {dopplerShiftHz(freqHz, cmd.rangeRateMps) >= 0 ? '+' : ''}
                  {(dopplerShiftHz(freqHz, cmd.rangeRateMps) / 1000).toFixed(3)} kHz
                </dd>
                <dt>Tune receiver to</dt>
                <dd>{fmtFreq(freqHz + dopplerShiftHz(freqHz, cmd.rangeRateMps))}</dd>
                <dt>TLE error at this range</dt>
                <dd className={dishOk.ok && rad2deg(tleAngularErrorRad(cmd.rangeM)) > rad2deg(hpbw) / 4 ? 'bad' : ''}>
                  ≈ {rad2deg(tleAngularErrorRad(cmd.rangeM)).toFixed(3)}°
                  {dishOk.ok ? ` (beam half-width ${(rad2deg(hpbw) / 2).toFixed(2)}°)` : ''}
                </dd>
              </dl>

              {pass && (
                <>
                  <p className="small panel-label">
                    {pass.riseClipped && pass.setClipped ? 'Always visible (stationary)' : now >= pass.rise ? 'Current pass' : 'Next pass'}
                  </p>
                  {!(pass.riseClipped && pass.setClipped) && (
                    <p className="small">
                      {pass.riseClipped ? 'up now' : fmtDayTime(pass.rise)} → {fmtTime(pass.set)}, max elevation{' '}
                      {rad2deg(pass.maxElRad).toFixed(1)}°
                      {now < pass.rise && ` · starts in ${fmtDuration(pass.rise.getTime() - now.getTime())}`}
                      {rates && (
                        <>
                          <br />
                          Peak slew: az {rad2deg(rates.azRateRadS).toFixed(2)}°/s, el {rad2deg(rates.elRateRadS).toFixed(2)}°/s
                        </>
                      )}
                    </p>
                  )}
                  {isKeyholePass(pass) && (
                    <p className="warning small" role="alert">
                      ⚠ Keyhole: this pass reaches {rad2deg(pass.maxElRad).toFixed(1)}°. An az/el mount must swing azimuth by
                      ~180° near the zenith (peak {rates ? rad2deg(rates.azRateRadS).toFixed(1) : '—'}°/s
                      {rates && rates.azRateRadS > ROTATOR_MAX_RATE_RAD_S ? ', faster than a typical 5°/s rotator' : ''}). Expect a
                      short dropout, or use an X/Y mount.
                    </p>
                  )}
                </>
              )}
              <SkyPlot
                points={
                  cmd.elRad > 0
                    ? [{ noradId: entry.noradId, name: entry.name, azDeg: rad2deg(cmd.azRad), elDeg: rad2deg(cmd.elRad), orbitClass: entry.orbitClass }]
                    : []
                }
                selectedId={entry.noradId}
                track={passTrack}
                trackLabel="Pass track"
                onSelect={() => undefined}
                height={320}
              />
            </>
          )}
        </div>

        {/* Phased array ---------------------------------------------------------------------- */}
        <div className="card">
          <div className="card-head">
            <h3>Phased-array phases</h3>
            <span className="muted small">
              {Math.round(arr.nx)}×{Math.round(arr.ny)} elements, {arr.dxLambda}λ × {arr.dyLambda}λ (from the Antenna Lab)
            </span>
          </div>
          <div className="button-row">
            <label className="field">
              Steer toward
              <select
                value={arrayTarget}
                onChange={(e) => setArrayTarget(e.target.value as 'animation' | 'selected' | 'beamhop')}
              >
                <option value="animation">3D animation (slider time)</option>
                <option value="selected">Selected satellite, now</option>
                <option value="beamhop" disabled={!hop}>
                  Beam-hop serving satellite{hop ? '' : ' (start the demo first)'}
                </option>
              </select>
            </label>
            <label className="field">
              Phase shifters
              <select value={bits} onChange={(e) => setBits(Number(e.target.value))}>
                <option value={0}>Continuous</option>
                {[1, 2, 3, 4, 5, 6].map((b) => (
                  <option key={b} value={b}>
                    {b}-bit ({2 ** b} levels)
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!target ? (
            <p className="muted">
              {arrayTarget === 'beamhop'
                ? 'No Starlink satellite above 25° right now.'
                : arrayTarget === 'animation'
                  ? 'Waiting for the 3D animation (pick a satellite with a pass).'
                  : 'Pick a satellite.'}
            </p>
          ) : (
            <>
              <dl className="readouts budget">
                <dt>Target</dt>
                <dd>{target.name}</dd>
                <dt>Weights for</dt>
                <dd>
                  {fmtDayTime(target.time)} ({target.time.toISOString().slice(11, 19)} UTC)
                </dd>
                <dt>Steering θ (from zenith) / φ (from east)</dt>
                <dd>
                  {belowHorizon ? '—' : `${rad2deg(steer!.thetaRad).toFixed(1)}° / ${rad2deg(steer!.phiRad).toFixed(1)}°`}
                </dd>
                <dt>Scan loss (cos^1.2 θ)</dt>
                <dd>{belowHorizon ? '—' : `${scanLossDb(clamped).toFixed(2)} dB`}</dd>
                <dt>Quantization loss</dt>
                <dd>{(-toDb(quantizationLoss(bits))).toFixed(2)} dB</dd>
              </dl>
              {belowHorizon && <p className="warning small">Target is below the horizon: phases shown for broadside.</p>}
              {!belowHorizon && steer!.thetaRad > ARRAY_MAX_SCAN_RAD && (
                <p className="warning small">
                  Beyond the {Math.round(rad2deg(ARRAY_MAX_SCAN_RAD))}° scan limit: the beam stops at{' '}
                  {Math.round(rad2deg(ARRAY_MAX_SCAN_RAD))}° (target at{' '}
                  {rad2deg(steer!.thetaRad).toFixed(0)}°).
                </p>
              )}
              {grating && !belowHorizon && (
                <p className="warning small">⚠ Grating lobe at this scan angle (spacing ≥ 1/(1 + |sin θ|) λ).</p>
              )}
              <PhaseMap phases={phases} height={340} />
              <p className="muted small">
                φ_mn = −2π(m·dx·u + n·dy·v) mod 360°. Element (0, 0) is the reference.
                {arrayTarget === 'animation' && ' Move the 3D animation slider and the phases follow.'}
              </p>

              <div className="button-row">
                <button type="button" className="button" onClick={() => downloadText(csvName(), csv())}>
                  Download weights (CSV)
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(csv())
                      .then(() => setCopyState('copied'))
                      .catch(() => setCopyState('failed'))
                    setTimeout(() => setCopyState('idle'), 2000)
                  }}
                >
                  {copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Copy failed' : 'Copy CSV'}
                </button>
              </div>
              <details className="weights">
                <summary>
                  Element weights ({weights.length}): amplitude, phase, Re, Im
                </summary>
                <div className="table-wrap">
                  <table className="data-table mono">
                    <thead>
                      <tr>
                        <th>m</th>
                        <th>n</th>
                        <th>Amplitude</th>
                        <th>Phase (°)</th>
                        <th>Re</th>
                        <th>Im</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weights.map((w) => (
                        <tr key={`${w.m},${w.n}`}>
                          <td>{w.m}</td>
                          <td>{w.n}</td>
                          <td>{w.amplitude.toFixed(4)}</td>
                          <td>{rad2deg(w.phaseRad).toFixed(2)}</td>
                          <td>{w.re.toFixed(4)}</td>
                          <td>{w.im.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      {/* Beam-hop ---------------------------------------------------------------------------- */}
      <div className="card">
        <div className="card-head">
          <h3>Starlink beam-hop demo</h3>
          {!hopOn ? (
            <button type="button" className="button primary" onClick={() => setHopOn(true)}>
              Load Starlink and start
            </button>
          ) : (
            <span className="muted small">
              {starlink.loading
                ? 'Loading ~11 000 Starlink orbits (4.6 MB)…'
                : needHop || !hop
                  ? 'Computing the schedule…'
                  : `${starlink.entries.length} satellites · ${starlinkPoints.length} above your horizon · ${hop.schedule.handovers.filter((h) => h.toId !== null).length} hand-overs in the next 30 min`}
            </span>
          )}
        </div>
        <p className="muted small">
          A flat phased array serves the highest Starlink satellite and hands over when it drops below 25° elevation.
          Press ×60 in the header to watch 30 minutes in 30 seconds.
        </p>
        {starlink.error && <p className="warning">Could not load Starlink data: {starlink.error}</p>}
        {hop && !needHop && (
          <>
            <dl className="readouts budget hop-status">
              <dt>Serving now</dt>
              <dd>{servingName ?? 'none (outage)'}</dd>
              <dt>Its elevation / azimuth</dt>
              <dd>
                {hopNow?.noradId != null ? `${rad2deg(hopNow.elRad).toFixed(1)}° / ${rad2deg(hopNow.azRad).toFixed(0)}°` : '—'}
              </dd>
              <dt>Next hand-over</dt>
              <dd>
                {nextHandover
                  ? `${fmtTime(nextHandover.time)} (in ${fmtDuration(nextHandover.time.getTime() - now.getTime())})`
                  : 'none in this window'}
              </dd>
            </dl>
            <div className="link-grid even">
              <SkyPlot
                points={starlinkPoints}
                selectedId={hopNow?.noradId ?? null}
                track={servingTrack}
                trackLabel="Serving track"
                ringElDeg={rad2deg(BEAM_HOP_MIN_EL_RAD)}
                onSelect={() => undefined}
                height={400}
              />
              <HopTimeline schedule={hop.schedule} now={now} minElDeg={rad2deg(BEAM_HOP_MIN_EL_RAD)} />
            </div>
          </>
        )}
      </div>

      <details className="card simplifications">
        <summary>Simplifications and assumptions</summary>
        <ul>
          <li>Dish slew rates are numerical derivatives of the SGP4 az/el. The keyhole warning triggers above 85° maximum elevation; a typical rotator is assumed to slew at 5°/s.</li>
          <li>Doppler is Δf = −(ṙ/c)·f from the SGP4 range rate (no ionospheric or oscillator effects).</li>
          <li>The phased array lies flat facing up (x = east, y = north), steers up to 60° from zenith, and uses uniform-amplitude phase steering. Quantization loss is the average [sin(π/2^B)/(π/2^B)]².</li>
          <li>The beam-hop rule is the textbook one in docs/PHYSICS.md (highest satellite, hand over below 25°). Real Starlink terminals re-assign every 15 s using SpaceX's scheduler, which is not public.</li>
        </ul>
      </details>
    </section>
  )
}
