// One antenna parameter: a slider, or a drop-down when the spec has options.
import type { ParamSpec } from '../../engine/antennas'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
}

const decimals = (step: number): number => (step >= 1 ? 0 : Math.ceil(-Math.log10(step)))

export function ParamSlider({ spec, value, onChange }: Props) {
  const scale = spec.displayScale ?? 1
  const id = `param-${spec.key}`

  if (spec.options) {
    return (
      <div className="param">
        <label htmlFor={id}>{spec.label}</label>
        <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const shown = value * scale
  return (
    <div className="param">
      <label htmlFor={id}>
        {spec.label}
        <output htmlFor={id}>
          {shown.toFixed(decimals(spec.step))}
          {spec.unit ? ` ${spec.unit}` : ''}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value) / scale)}
      />
    </div>
  )
}

/** Logarithmic frequency slider (30 MHz – 40 GHz). */
export function FrequencySlider({ freqHz, onChange }: { freqHz: number; onChange: (f: number) => void }) {
  const label =
    freqHz >= 1e9 ? `${(freqHz / 1e9).toPrecision(4)} GHz` : `${(freqHz / 1e6).toPrecision(4)} MHz`
  return (
    <div className="param">
      <label htmlFor="param-freq">
        Frequency<output htmlFor="param-freq">{label}</output>
      </label>
      <input
        id="param-freq"
        type="range"
        min={Math.log10(30e6)}
        max={Math.log10(40e9)}
        step={0.001}
        value={Math.log10(freqHz)}
        onChange={(e) => onChange(10 ** Number(e.target.value))}
      />
    </div>
  )
}
