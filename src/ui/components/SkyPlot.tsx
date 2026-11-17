// Polar sky plot: zenith at the centre, horizon at the edge, north up, east right.
import type { Data, Layout } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import type { OrbitClass } from '../../engine/orbit'
import { cssVar, ORBIT_CLASSES, orbitColorVar } from '../format'
import { plotTheme } from './loadPlotly'
import { PlotlyChart } from './PlotlyChart'

export interface SkyPoint {
  noradId: number
  name: string
  azDeg: number
  elDeg: number
  orbitClass: OrbitClass
}

interface Props {
  points: SkyPoint[]
  selectedId: number | null
  /** Az/el track of the selected pass, in degrees. */
  track: { azDeg: number; elDeg: number }[]
  onSelect: (noradId: number) => void
  /** Optional dashed ring at this elevation (e.g. the 25° beam-hop limit). */
  ringElDeg?: number
  height?: number
  /** Label for the track trace in the legend. */
  trackLabel?: string
}

export function SkyPlot({ points, selectedId, track, onSelect, ringElDeg, height = 440, trackLabel = 'Selected pass' }: Props) {
  const data = useMemo<Data[]>(() => {
    const traces: Data[] = ORBIT_CLASSES.map((cls) => {
      const pts = points.filter((p) => p.orbitClass === cls)
      return {
        type: 'scatterpolar',
        mode: 'markers',
        name: cls,
        r: pts.map((p) => 90 - p.elDeg),
        theta: pts.map((p) => p.azDeg),
        customdata: pts.map((p) => p.noradId),
        text: pts.map((p) => p.name),
        marker: { size: 7, color: cssVar(orbitColorVar(cls)) },
        hovertemplate: '%{text}<br>az %{theta:.1f}°<extra></extra>',
      }
    })
    if (ringElDeg !== undefined) {
      const ring = Array.from({ length: 73 }, (_, i) => i * 5)
      traces.push({
        type: 'scatterpolar',
        mode: 'lines',
        name: `${ringElDeg}° limit`,
        r: ring.map(() => 90 - ringElDeg),
        theta: ring,
        line: { color: plotTheme().muted, width: 1.5, dash: 'dash' },
        hoverinfo: 'skip',
      })
    }
    if (track.length > 1) {
      traces.push({
        type: 'scatterpolar',
        mode: 'lines',
        name: trackLabel,
        r: track.map((p) => 90 - Math.max(p.elDeg, 0)),
        theta: track.map((p) => p.azDeg),
        line: { color: plotTheme().bad, width: 2, dash: 'dot' },
        hoverinfo: 'skip',
      })
    }
    const sel = points.find((p) => p.noradId === selectedId)
    if (sel) {
      traces.push({
        type: 'scatterpolar',
        mode: 'text+markers',
        name: sel.name,
        r: [90 - sel.elDeg],
        theta: [sel.azDeg],
        text: [sel.name],
        textposition: 'top center',
        customdata: [sel.noradId],
        marker: { size: 16, color: 'rgba(0,0,0,0)', line: { color: plotTheme().bad, width: 2.5 } },
        hovertemplate: '%{text}<extra></extra>',
        showlegend: false,
      })
    }
    return traces
  }, [points, selectedId, track, ringElDeg, trackLabel])

  const layout = useMemo<Partial<Layout>>(() => {
    const t = plotTheme()
    return {
      margin: { l: 40, r: 40, t: 30, b: 30 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text },
      legend: { orientation: 'h', y: -0.06 },
      uirevision: 'sky',
      polar: {
        bgcolor: 'rgba(0,0,0,0)',
        radialaxis: {
          range: [0, 90],
          tickvals: [0, 30, 60, 90],
          ticktext: ['90°', '60°', '30°', '0°'],
          gridcolor: t.grid,
          angle: 90,
          tickangle: 90,
        },
        angularaxis: {
          rotation: 90,
          direction: 'clockwise',
          tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
          ticktext: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
          gridcolor: t.grid,
        },
      },
    }
  }, [])

  return (
    <PlotlyChart
      data={data}
      layout={layout}
      height={height}
      label="Sky plot of satellites above the horizon"
      onPointClick={(id) => typeof id === 'number' && onSelect(id)}
    />
  )
}
