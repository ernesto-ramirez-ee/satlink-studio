// Heat map of phased-array element phases (degrees), with a cyclic colour scale (0° = 360°).
import type { Data, Layout } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import { rad2deg } from '../../engine/units'
import { PHASE_COLOR_STOPS as CYCLIC } from '../format'
import { plotTheme } from './loadPlotly'
import { PlotlyChart } from './PlotlyChart'

export function PhaseMap({ phases, height = 380 }: { phases: number[][]; height?: number }) {
  const data = useMemo<Data[]>(
    () => [
      {
        type: 'heatmap',
        z: phases.map((row) => row.map(rad2deg)),
        x: phases[0]?.map((_, m) => m) ?? [],
        y: phases.map((_, n) => n),
        zmin: 0,
        zmax: 360,
        colorscale: CYCLIC,
        xgap: 1,
        ygap: 1,
        colorbar: { title: { text: 'Phase (°)' }, tickvals: [0, 90, 180, 270, 360], len: 0.85 },
        hovertemplate: 'element (%{x}, %{y})<br>%{z:.1f}°<extra></extra>',
      },
    ],
    [phases],
  )
  const layout = useMemo<Partial<Layout>>(() => {
    const t = plotTheme()
    return {
      margin: { l: 50, r: 10, t: 10, b: 45 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text },
      xaxis: { title: { text: 'Element m (→ east)' }, dtick: 1, showgrid: false, zeroline: false },
      yaxis: { title: { text: 'Element n (→ north)' }, dtick: 1, showgrid: false, zeroline: false, scaleanchor: 'x' },
    }
  }, [])
  return <PlotlyChart data={data} layout={layout} height={height} label="Phase of each array element" />
}
