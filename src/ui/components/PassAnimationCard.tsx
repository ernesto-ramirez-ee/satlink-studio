// "3D pass animation" card: pick a pass (or the Starlink beam-hop), scrub time with a slider (or
// play / follow the clock), and watch the dish turn or the phased-array beam swing toward the
// satellite.
import { useEffect, useMemo, useState } from 'react'
import type { Params } from '../../engine/antennas'
import { getAntenna } from '../../engine/antennas'
import { sampleSurface, surfaceToXyz } from '../../engine/antennas/metrics'
import { ARRAY_MAX_SCAN_RAD, practicality } from '../../engine/link'
import type { Observer, Pass, SatRec } from '../../engine/orbit'
import {
  arrayLobeSurface,
  beamHopFrames,
  elementPhases,
  nearestFrame,
  passFrames,
  scanLossDb,
  steeringFromAzEl,
  trackStarts,
  type BeamHopSchedule,
  type HopCandidate,
  type PassFrame,
} from '../../engine/steering'
import { C, rad2deg } from '../../engine/units'
import { compass, fmtDayTime, fmtDuration, fmtTime } from '../format'
import { PassScene3D } from './PassScene3D'

export interface BeamHopSource {
  schedule: BeamHopSchedule
  candidates: readonly HopCandidate[]
  /** Starlink downlink frequency, for the dish lobe. */
  freqHz: number
}

interface Props {
  satName: string
  satrec: SatRec
  observerDeg: { latDeg: number; lonDeg: number }
  obs: Observer
  now: Date
  /** Passes from the tab's 24 h search (minimum elevation 0°). */
  passes: Pass[]
  dishParams: Params
  /** Satellite downlink frequency (or the Antenna Lab dish frequency if unknown). */
  freqHz: number
  /** The Antenna Lab dish frequency, used for the drawn lobe when the dish is impractical at freqHz. */
  dishLabFreqHz: number
  arrayParams: Params
  bits: number
  /** Called whenever the shown frame changes (slider, play or clock), so other panels can follow. */
  onFrame?: (frame: PassFrame | null) => void
  /** The beam-hop schedule, once the demo has been started. */
  beamHop: BeamHopSource | null
  /** True while Starlink is loading or the schedule is being computed. */
  beamHopBusy: boolean
  onStartBeamHop: () => void
}

const LOBE_RANGE_DB = 30
const fmtFreq = (hz: number) => (hz >= 1e9 ? `${(hz / 1e9).toFixed(2)} GHz` : `${(hz / 1e6).toFixed(1)} MHz`)
const PAD_MS = 2 * 60_000
const GEO_WINDOW_MS = 3600e3

export function PassAnimationCard({
  satName,
  satrec,
  observerDeg,
  obs,
  now,
  passes,
  dishParams,
  freqHz,
  dishLabFreqHz,
  arrayParams,
  bits,
  onFrame,
  beamHop,
  beamHopBusy,
  onStartBeamHop,
}: Props) {
  const [source, setSource] = useState<'pass' | 'beamhop'>('pass')
  const [mode, setMode] = useState<'dish' | 'array'>('dish')
  const [passKey, setPassKey] = useState<number | null>(null)
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [follow, setFollow] = useState(false)
  const isHop = source === 'beamhop'

  // ---- Selected-satellite pass ----
  const upcoming = passes.filter((p) => p.set.getTime() > now.getTime())
  const pass = upcoming.find((p) => p.rise.getTime() === passKey) ?? upcoming[0] ?? null
  const stationary = pass ? pass.riseClipped && pass.setClipped : false
  // Window: the pass ± 2 min (a stationary GEO satellite gets one hour, refreshed every 10 min).
  const geoStart = Math.floor(now.getTime() / 600_000) * 600_000
  const from = pass ? (stationary ? geoStart : pass.rise.getTime() - PAD_MS) : null
  const to = pass ? (stationary ? geoStart + GEO_WINDOW_MS : pass.set.getTime() + PAD_MS) : null
  const passFramesList = useMemo(() => {
    if (from === null || to === null) return []
    const stepS = Math.max(2, Math.round((to - from) / 1000 / 360))
    return passFrames(satrec, obs, new Date(from), new Date(to), stepS)
  }, [satrec, obs, from, to])

  // ---- Starlink beam-hop (30 min window, a frame per schedule step) ----
  const hopSchedule = beamHop?.schedule
  const hopCands = beamHop?.candidates
  const hopFrames = useMemo(
    () => (hopSchedule && hopCands ? beamHopFrames(hopSchedule, hopCands, obs) : []),
    [hopSchedule, hopCands, obs],
  )
  const handoverIdx = useMemo(() => trackStarts(hopFrames), [hopFrames])

  const frames = isHop ? hopFrames : passFramesList

  // Follow the header clock, or play through the window.
  const followIdx = follow ? nearestFrame(frames, now) : -1
  const idx = Math.min(follow ? followIdx : frameIdx, frames.length - 1)
  useEffect(() => {
    if (!playing || follow) return
    const id = setInterval(() => {
      setFrameIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, isHop ? 120 : 40)
    return () => clearInterval(id)
  }, [playing, follow, frames.length, isHop])

  const fr = frames[idx]
  useEffect(() => {
    onFrame?.(fr ?? null)
  }, [fr, onFrame])
  useEffect(() => () => onFrame?.(null), [onFrame])

  const chooseSource = (s: 'pass' | 'beamhop') => {
    setSource(s)
    setFrameIdx(0)
    setPlaying(false)
    if (s === 'beamhop') {
      setMode('array') // Starlink terminals are flat phased arrays
      if (!beamHop && !beamHopBusy) onStartBeamHop()
    }
  }

  // Dish: track while visible, park (pointing up) otherwise.
  const dishAim = useMemo(() => (fr && fr.visible && !fr.hidden ? { azRad: fr.azRad, elRad: fr.elRad } : null), [fr])

  // Array: steer electronically, clamped at the scan limit.
  const live = !!fr && fr.visible && !fr.hidden
  const steer = fr ? steeringFromAzEl(fr.azRad, fr.elRad) : null
  const status: 'tracking' | 'beyond-scan' | 'below-horizon' = !live
    ? 'below-horizon'
    : mode === 'array' && steer!.thetaRad > ARRAY_MAX_SCAN_RAD
      ? 'beyond-scan'
      : 'tracking'
  const thetaCmd = live ? Math.min(steer!.thetaRad, ARRAY_MAX_SCAN_RAD) : 0
  const phiCmd = steer?.phiRad ?? 0

  // A dish too small for the band (e.g. 1 m at VHF) has a near-hemispherical "beam"; draw the lobe
  // at the Antenna Lab frequency instead (or where the dish is 10 λ across) and say so.
  const linkFreqHz = isHop && beamHop ? beamHop.freqHz : freqHz
  const dishModel = getAntenna('dish')
  const dishLobeFreqHz = practicality(dishModel, dishParams, linkFreqHz).ok
    ? linkFreqHz
    : practicality(dishModel, dishParams, dishLabFreqHz).ok
      ? dishLabFreqHz
      : (10 * C) / dishParams.diameterM
  const dishLobe = useMemo(() => {
    const s = sampleSurface(dishModel, dishParams, dishLobeFreqHz, 121, 49)
    return surfaceToXyz(s, dishModel.peakGainDbi(dishParams, dishLobeFreqHz), LOBE_RANGE_DB)
  }, [dishModel, dishParams, dishLobeFreqHz])

  const ap = arrayParams
  const arrayLobe = useMemo(
    () =>
      surfaceToXyz(
        arrayLobeSurface({ nx: ap.nx, ny: ap.ny, dxLambda: ap.dxLambda, dyLambda: ap.dyLambda, taper: ap.taper }, thetaCmd, phiCmd),
        0,
        LOBE_RANGE_DB,
      ),
    [ap.nx, ap.ny, ap.dxLambda, ap.dyLambda, ap.taper, thetaCmd, phiCmd],
  )
  const arrayPhases = useMemo(
    () => elementPhases({ nx: ap.nx, ny: ap.ny, dxLambda: ap.dxLambda, dyLambda: ap.dyLambda, thetaRad: thetaCmd, phiRad: phiCmd, bits }),
    [ap.nx, ap.ny, ap.dxLambda, ap.dyLambda, thetaCmd, phiCmd, bits],
  )

  // Beam-hop context for the current frame.
  const nextHandover = isHop && fr ? hopSchedule?.handovers.find((h) => h.time > fr.time && h.toId !== null) : undefined
  const handoversSoFar = isHop ? handoverIdx.filter((i) => i <= idx).length : 0

  const statusText =
    fr?.hidden
      ? 'Outage: no Starlink satellite above 25° at this moment.'
      : status === 'below-horizon'
        ? 'Out of range: the satellite is below the horizon. The antenna waits, parked.'
        : status === 'beyond-scan'
          ? `Beyond the ${Math.round(rad2deg(ARRAY_MAX_SCAN_RAD))}° scan limit: the beam stays at ${Math.round(rad2deg(ARRAY_MAX_SCAN_RAD))}° and the satellite sits on its edge.`
          : isHop
            ? `Serving ${fr?.label ?? ''}: the beam follows it until it drops below 25°, then hops to the highest Starlink satellite.`
            : mode === 'dish'
              ? 'Tracking: the dish turns (azimuth) and tilts (elevation) to keep the satellite in its beam.'
              : 'Tracking: the panel does not move; the element phases swing the beam electronically.'

  const hasData = frames.length > 0

  return (
    <div className="card">
      <div className="card-head">
        <h3>3D pass animation</h3>
        <span className="muted small">Stylized: the antenna is drawn ~200 km wide so it is visible next to the planet.</span>
      </div>

      <div className="controls-bar anim-controls">
        <div className="segmented" role="group" aria-label="What to track">
          <button type="button" className={`button${!isHop ? ' primary' : ''}`} onClick={() => chooseSource('pass')} aria-pressed={!isHop}>
            {satName} pass
          </button>
          <button type="button" className={`button${isHop ? ' primary' : ''}`} onClick={() => chooseSource('beamhop')} aria-pressed={isHop}>
            Starlink beam-hop
          </button>
        </div>
        {!isHop && pass && (
          <label className="field">
            Pass
            <select
              value={pass.rise.getTime()}
              onChange={(e) => {
                setPassKey(Number(e.target.value))
                setFrameIdx(0)
                setPlaying(false)
              }}
            >
              {upcoming.map((p) => (
                <option key={p.rise.getTime()} value={p.rise.getTime()}>
                  {p.riseClipped && p.setClipped
                    ? 'Stationary (next hour)'
                    : `${p.riseClipped ? 'Now' : fmtDayTime(p.rise)} · max ${rad2deg(p.maxElRad).toFixed(0)}°`}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="segmented" role="group" aria-label="Antenna">
          <button type="button" className={`button${mode === 'dish' ? ' primary' : ''}`} onClick={() => setMode('dish')} aria-pressed={mode === 'dish'}>
            Dish
          </button>
          <button type="button" className={`button${mode === 'array' ? ' primary' : ''}`} onClick={() => setMode('array')} aria-pressed={mode === 'array'}>
            Phased array
          </button>
        </div>
        <label className="inline-check">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow the clock
        </label>
      </div>

      {isHop && !beamHop && (
        <p className="muted">
          {beamHopBusy ? 'Loading ~11 000 Starlink orbits and computing the beam-hop schedule…' : 'The beam-hop schedule is not available.'}{' '}
          {!beamHopBusy && (
            <button type="button" className="button primary" onClick={onStartBeamHop}>
              Load Starlink
            </button>
          )}
        </p>
      )}
      {!isHop && !pass && <p className="muted">No passes of {satName} from your location in the next 24 hours.</p>}

      {hasData && (
        <>
          <PassScene3D
            observer={observerDeg}
            frames={frames}
            frameIndex={Math.max(idx, 0)}
            mode={mode}
            dishLobe={dishLobe}
            arrayLobe={arrayLobe}
            arrayPhases={arrayPhases}
            dishAim={dishAim}
            status={status}
          />

          <div className="anim-slider">
            <button
              type="button"
              className="button icon"
              disabled={follow}
              onClick={() => {
                if (!playing && idx >= frames.length - 1) setFrameIdx(0)
                setPlaying(!playing)
              }}
              aria-label={playing ? 'Pause animation' : 'Play animation'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              step={1}
              value={Math.max(idx, 0)}
              disabled={follow}
              list={isHop ? 'hop-handovers' : undefined}
              onChange={(e) => {
                setPlaying(false)
                setFrameIdx(Number(e.target.value))
              }}
              aria-label={isHop ? 'Time within the beam-hop window' : 'Time within the pass'}
            />
            {isHop && (
              <datalist id="hop-handovers">
                {handoverIdx.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            )}
            <span className="mono small">{fr ? fmtTime(fr.time) : '—'}</span>
          </div>
          {isHop && <p className="muted small">Tick marks on the slider are hand-overs ({handoverIdx.length} in this 30-minute window).</p>}
          {follow && (followIdx <= 0 || followIdx >= frames.length - 1) && (
            <p className="muted small">
              The clock is outside this window; use ×60{isHop ? '' : ' or pick the current pass'}.
            </p>
          )}

          {fr && (
            <>
              <p className={`small anim-status ${fr.hidden ? 'below-horizon' : status}`}>{statusText}</p>
              <dl className="readouts budget anim-readouts">
                {isHop && (
                  <>
                    <dt>Serving satellite</dt>
                    <dd>{fr.label ?? 'none (outage)'}</dd>
                    <dt>Hand-overs so far / next</dt>
                    <dd>
                      {handoversSoFar} /{' '}
                      {nextHandover ? `${fmtTime(nextHandover.time)} (in ${fmtDuration(nextHandover.time.getTime() - fr.time.getTime())})` : 'none in window'}
                    </dd>
                  </>
                )}
                {!fr.hidden && (
                  <>
                    <dt>Satellite azimuth / elevation</dt>
                    <dd>
                      {rad2deg(fr.azRad).toFixed(1)}° ({compass(rad2deg(fr.azRad))}) / {rad2deg(fr.elRad).toFixed(1)}°
                    </dd>
                    <dt>Range</dt>
                    <dd>{(fr.rangeM / 1000).toFixed(0)} km</dd>
                  </>
                )}
                {mode === 'dish' ? (
                  <>
                    <dt>Dish command</dt>
                    <dd>{dishAim ? `az ${rad2deg(dishAim.azRad).toFixed(1)}°, el ${rad2deg(dishAim.elRad).toFixed(1)}°` : 'parked (pointing up)'}</dd>
                  </>
                ) : (
                  <>
                    <dt>Beam steering θ / φ</dt>
                    <dd>{live ? `${rad2deg(thetaCmd).toFixed(1)}° / ${rad2deg(phiCmd).toFixed(1)}°` : 'broadside (idle)'}</dd>
                    <dt>Scan loss</dt>
                    <dd>{live ? `${scanLossDb(thetaCmd).toFixed(2)} dB` : '—'}</dd>
                  </>
                )}
              </dl>
              {mode === 'dish' && dishLobeFreqHz !== linkFreqHz && (
                <p className="warning small">
                  A {dishParams.diameterM} m dish isn’t practical at {fmtFreq(linkFreqHz)} (its beam would cover half the sky), so
                  the lobe is drawn at {fmtFreq(dishLobeFreqHz)}. The pointing is the same at any frequency.
                </p>
              )}
              {isHop && mode === 'dish' && (
                <p className="muted small">
                  A dish would have to slew to each new satellite at every hand-over; the flat array just changes its phases.
                </p>
              )}
              <p className="muted small">
                Lobes are the real patterns from the Antenna Lab settings ({mode === 'dish' ? `your dish at ${fmtFreq(dishLobeFreqHz)}` : 'your array'}), on a{' '}
                {LOBE_RANGE_DB} dB scale. The array panel shows its element phases in the same colours as the phase map. Drag to
                rotate, scroll to zoom.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
