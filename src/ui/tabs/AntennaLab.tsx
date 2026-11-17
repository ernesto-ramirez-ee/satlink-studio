// Antenna Lab tab: pick an antenna, move its sliders, see 2D cuts, a 3D pattern and readouts.
import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { ANTENNAS, getAntenna, type AntennaId } from '../../engine/antennas'
import { patternMetrics, peakAngleRad, sampleSurface } from '../../engine/antennas/metrics'
import { rad2deg } from '../../engine/units'
import { FrequencySlider, ParamSlider } from '../components/ParamSlider'
import { Pattern3DPlot } from '../components/Pattern3DPlot'
import { PolarCutPlot } from '../components/PolarCutPlot'
import type { AntennaSettings } from '../state'

interface Props {
  antennaId: AntennaId
  settings: AntennaSettings
  onSelect: (id: AntennaId) => void
  onChange: (settings: AntennaSettings) => void
}

const fmtDeg = (rad: number | null): string => (rad === null ? '—' : `${rad2deg(rad).toFixed(rad2deg(rad) < 10 ? 2 : 1)}°`)

export function AntennaLab({ antennaId, settings, onSelect, onChange }: Props) {
  const model = getAntenna(antennaId)
  // Heavy sampling uses deferred copies so the sliders stay responsive while dragging.
  // Both are deferred together, so the plotted model and its params always match.
  const plotModel = getAntenna(useDeferredValue(antennaId))
  const { params, freqHz } = useDeferredValue(settings)
  const metrics = useMemo(() => patternMetrics(plotModel, params, freqHz), [plotModel, params, freqHz])
  const surface = useMemo(() => sampleSurface(plotModel, params, freqHz), [plotModel, params, freqHz])
  const [zoomed, setZoomed] = useState(true)

  const gainUnit = plotModel.polarization === 'linear' ? 'dBi' : 'dBic'
  const hpbw0 = metrics.hpbwRad[0]
  const canZoom = hpbw0 !== null && rad2deg(hpbw0) < 20
  const zoom =
    canZoom && zoomed
      ? { centerDeg: rad2deg(peakAngleRad(metrics.cuts[0])), halfWidthDeg: Math.max(4 * rad2deg(hpbw0), 2) }
      : null
  const warnings = model.warnings(settings.params, settings.freqHz)
  const info = plotModel.info(params, freqHz)

  const setParam = (key: string, value: number) =>
    onChange({ ...settings, params: { ...settings.params, [key]: value } })

  return (
    <section className="lab">
      <div className="lab-head">
        <h2>Antenna Lab</h2>
        <p className="muted">{model.description}</p>
      </div>

      <div className="lab-grid">
        <div className="card lab-controls">
          <div className="param">
            <label htmlFor="antenna-select">Antenna</label>
            <select id="antenna-select" value={antennaId} onChange={(e) => onSelect(e.target.value as AntennaId)}>
              {ANTENNAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <FrequencySlider freqHz={settings.freqHz} onChange={(f) => onChange({ ...settings, freqHz: f })} />
          {model.paramSpecs.map((spec) => (
            <ParamSlider
              key={spec.key}
              spec={spec}
              value={settings.params[spec.key]}
              onChange={(v) => setParam(spec.key, v)}
            />
          ))}
          <button type="button" className="link-button" onClick={() => onChange({ params: { ...model.defaults }, freqHz: model.defaultFreqHz })}>
            Reset to defaults
          </button>

          <dl className="readouts">
            <dt>Peak gain</dt>
            <dd>
              {metrics.peakGainDbi.toFixed(2)} {gainUnit}
            </dd>
            <dt>HPBW, φ = {Math.round(rad2deg(metrics.cuts[0].phiRad)) % 360}° cut</dt>
            <dd>{fmtDeg(metrics.hpbwRad[0])}</dd>
            <dt>HPBW, φ = {Math.round(rad2deg(metrics.cuts[1].phiRad)) % 360}° cut</dt>
            <dd>{fmtDeg(metrics.hpbwRad[1])}</dd>
            <dt>First sidelobe / back lobe</dt>
            <dd>{metrics.firstSidelobeDb === null ? '—' : `${metrics.firstSidelobeDb.toFixed(1)} dB`}</dd>
            <dt>Polarization</dt>
            <dd>{plotModel.polarization === 'linear' ? 'Linear' : plotModel.polarization.toUpperCase()}</dd>
            {info.map((item) => (
              <Fragment key={item.label + item.unit}>
                <dt>{item.label}</dt>
                <dd>
                  {item.value.toFixed(item.digits ?? 2)} {item.unit}
                </dd>
              </Fragment>
            ))}
          </dl>

          {warnings.map((w) => (
            <p key={w} className="warning" role="alert">
              ⚠ {w}
            </p>
          ))}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Pattern cuts</h3>
            {canZoom && (
              <label className="inline-check">
                <input type="checkbox" checked={zoomed} onChange={(e) => setZoomed(e.target.checked)} /> Zoom to main lobe
              </label>
            )}
          </div>
          <PolarCutPlot cuts={metrics.cuts} peakDbi={metrics.peakGainDbi} zoom={zoom} />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>3D pattern</h3>
            <span className="muted small">Drag to rotate · 40 dB range</span>
          </div>
          <Pattern3DPlot surface={surface} peakDbi={metrics.peakGainDbi} />
        </div>
      </div>

      <details className="card simplifications">
        <summary>Simplifications and assumptions</summary>
        <ul>
          <li>Patterns are analytic models (docs/PHYSICS.md), not full-wave EM simulation: no mutual coupling, feed blockage, spillover or ohmic loss.</li>
          <li>θ is measured from the antenna boresight (+z). Ground planes are ideal and infinite.</li>
          <li>Yagi gain comes from the NBS TN 688 optimized-design table (it depends on boom length only). Helix gain is Kraus’s formula, which is known to be 1–2 dB optimistic.</li>
          <li>The patch pattern is cosⁿθ with an assumed εr trend. The QFH back lobe is set by an assumed front-to-back ratio.</li>
          <li>Phased-array gain is the numerical directivity of array factor × cos^1.2 θ element pattern.</li>
        </ul>
      </details>
    </section>
  )
}
