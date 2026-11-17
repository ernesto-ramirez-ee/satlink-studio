// 2D polar plot of two principal-plane cuts, in dBi. Boresight (θ = 0) points up.
import type { Data, Layout } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import type { PatternCut } from '../../engine/antennas/metrics'
import { rad2deg } from '../../engine/units'
import { plotTheme } from './loadPlotly'
import { PlotlyChart } from './PlotlyChart'

interface Props {
  cuts: [PatternCut, PatternCut]
  peakDbi: number
  rangeDb?: number
  /** Zoom to ±halfWidthDeg around centerDeg (data angle), or null for the full circle. */
  zoom: { centerDeg: number; halfWidthDeg: number } | null
}

const DECIMATE = 4 // 0.025° samples → 0.1° on screen

export function PolarCutPlot({ cuts, peakDbi, rangeDb = 40, zoom }: Props) {
  const floor = peakDbi - rangeDb
  const data = useMemo<Data[]>(() => {
    const t = plotTheme()
    const colors = [t.accent, t.bad]
    return cuts.map((cut, k) => {
      const theta: number[] = []
      const r: number[] = []
      for (let i = 0; i < cut.thetaRad.length; i += DECIMATE) {
        theta.push(rad2deg(cut.thetaRad[i]))
        r.push(Math.max(cut.gainDbi[i], floor))
      }
      return {
        type: 'scatterpolar',
        mode: 'lines',
        theta,
        r,
        name: `φ = ${Math.round(rad2deg(cut.phiRad)) % 360}° cut`,
        line: { color: colors[k], width: 2 },
        hovertemplate: 'θ %{theta:.1f}°<br>%{r:.2f} dBi<extra></extra>',
      }
    })
  }, [cuts, floor])

  const layout = useMemo<Partial<Layout>>(() => {
    const t = plotTheme()
    const sector: [number, number] = zoom
      ? [90 - zoom.centerDeg - zoom.halfWidthDeg, 90 - zoom.centerDeg + zoom.halfWidthDeg]
      : [0, 360]
    return {
      margin: { l: 30, r: 30, t: 30, b: 30 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text },
      showlegend: true,
      legend: { orientation: 'h', y: -0.08 },
      polar: {
        bgcolor: 'rgba(0,0,0,0)',
        sector,
        radialaxis: { range: [floor, peakDbi + 1], ticksuffix: ' dBi', gridcolor: t.grid, angle: 90, tickangle: 90 },
        angularaxis: { rotation: 90, direction: 'clockwise', gridcolor: t.grid, ticksuffix: '°' },
      },
    }
  }, [floor, peakDbi, zoom])

  return <PlotlyChart data={data} layout={layout} height={420} label="Polar plot of two pattern cuts" />
}
