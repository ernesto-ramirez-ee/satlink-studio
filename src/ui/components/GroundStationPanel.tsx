// Shared side panel: ground-station location (GPS or manual), selected antenna, clock, data age.
import { useState, type FormEvent } from 'react'
import { receiverTempK } from '../../engine/link'
import { fmtAge, fmtTime } from '../format'
import { isValidLatLon, type ObserverState } from '../state'

interface Props {
  observer: ObserverState
  onObserverChange: (o: ObserverState) => void
  antennaLabel: string
  antennaGainDbi: number
  now: Date
  clockLive: boolean
  tleFetchedAt: string | null | undefined
  noiseFigureDb: number
  onNoiseFigureChange: (nf: number) => void
}

const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`

export function GroundStationPanel({
  observer,
  onObserverChange,
  antennaLabel,
  antennaGainDbi,
  now,
  clockLive,
  tleFetchedAt,
  noiseFigureDb,
  onNoiseFigureChange,
}: Props) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ lat: '', lon: '', alt: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const toggleEditing = () => {
    if (!editing) {
      setForm({ lat: observer.latDeg.toFixed(4), lon: observer.lonDeg.toFixed(4), alt: String(Math.round(observer.altM)) })
      setFormError(null)
    }
    setEditing(!editing)
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('This browser has no geolocation. Enter the coordinates manually.')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onObserverChange({
          latDeg: pos.coords.latitude,
          lonDeg: pos.coords.longitude,
          altM: pos.coords.altitude ?? observer.altM,
          source: 'gps',
          label: `My location (±${Math.round(pos.coords.accuracy)} m)`,
        })
      },
      (err) => {
        setLocating(false)
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Allow it in the browser’s site settings, or enter coordinates manually.'
            : err.code === err.TIMEOUT
              ? 'Getting your location timed out. Try again or enter coordinates manually.'
              : 'Your location is unavailable. Enter coordinates manually.',
        )
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const lat = Number(form.lat)
    const lon = Number(form.lon)
    const alt = form.alt.trim() === '' ? 0 : Number(form.alt)
    if (!isValidLatLon(lat, lon) || form.lat.trim() === '' || form.lon.trim() === '') {
      setFormError('Latitude must be −90…90 and longitude −180…180 (decimal degrees, west and south negative).')
      return
    }
    if (!Number.isFinite(alt) || alt < -500 || alt > 9000) {
      setFormError('Altitude must be between −500 and 9000 m.')
      return
    }
    setFormError(null)
    setEditing(false)
    onObserverChange({ latDeg: lat, lonDeg: lon, altM: alt, source: 'manual', label: 'Manual entry' })
  }

  const tleAgeMs = tleFetchedAt ? now.getTime() - Date.parse(tleFetchedAt) : null

  return (
    <aside className="side-panel" aria-label="Ground station">
      <h2>Ground station</h2>

      <section className="panel-section">
        <p className="panel-label">{observer.label ?? (observer.source === 'gps' ? 'My location' : 'Manual entry')}</p>
        <p className="mono">
          {fmtCoord(observer.latDeg, 'N', 'S')}
          <br />
          {fmtCoord(observer.lonDeg, 'E', 'W')}
          <br />
          {Math.round(observer.altM)} m
        </p>
        <div className="button-row">
          <button type="button" className="button primary" onClick={useMyLocation} disabled={locating}>
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          <button type="button" className="button" onClick={toggleEditing} aria-expanded={editing}>
            {editing ? 'Cancel' : 'Enter manually'}
          </button>
        </div>
        {geoError && (
          <p className="warning small" role="alert">
            {geoError}
          </p>
        )}
        {editing && (
          <form className="coord-form" onSubmit={submit}>
            <label>
              Latitude (°)
              <input inputMode="decimal" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            </label>
            <label>
              Longitude (°)
              <input inputMode="decimal" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} />
            </label>
            <label>
              Altitude (m)
              <input inputMode="decimal" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
            </label>
            {formError && (
              <p className="warning small" role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className="button primary">
              Apply
            </button>
          </form>
        )}
        <p className="muted small">Your location stays in this browser; it is never sent anywhere.</p>
      </section>

      <section className="panel-section">
        <p className="panel-label">Antenna</p>
        <p>
          {antennaLabel}
          <br />
          <span className="mono muted">{antennaGainDbi.toFixed(1)} dBi peak</span>
        </p>
        <p className="muted small">Change it in the Antenna Lab.</p>
      </section>

      <section className="panel-section">
        <p className="panel-label">Receiver</p>
        <div className="param">
          <label htmlFor="nf">
            LNA noise figure<output htmlFor="nf">{noiseFigureDb.toFixed(1)} dB</output>
          </label>
          <input
            id="nf"
            type="range"
            min={0.3}
            max={8}
            step={0.1}
            value={noiseFigureDb}
            onChange={(e) => onNoiseFigureChange(Number(e.target.value))}
          />
        </div>
        <p className="muted small">
          Receiver noise {Math.round(receiverTempK(noiseFigureDb))} K. Sky and ground noise are added per antenna in Link
          Check.
        </p>
      </section>

      <section className="panel-section">
        <p className="panel-label">Clock{clockLive ? '' : ' (simulated)'}</p>
        <p className="mono">
          {fmtTime(now)} local
          <br />
          {now.toISOString().slice(11, 19)} UTC
        </p>
        <p className="muted small">
          Orbit data:{' '}
          {tleFetchedAt === undefined
            ? 'loading…'
            : tleAgeMs === null
              ? 'no snapshot yet (run npm run fetch-tle)'
              : `CelesTrak snapshot, ${fmtAge(tleAgeMs)} old`}
        </p>
      </section>
    </aside>
  )
}
