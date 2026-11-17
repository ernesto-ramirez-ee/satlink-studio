// Link margin vs. time: one line per practical antenna, 0 dB and 3 dB lines, failure regions in red.
import type { Data, Layout, Shape } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import type { AntennaId } from '../../engine/antennas'
import { failureIntervals, REQUIRED_MARGIN_DB, type MarginTimeline } from '../../engine/link'
import { rad2deg } from '../../engine/units'
import { ANTENNA_COLORS, localStamp } from '../format'
import { plotTheme } from './loadPlotly'
import { PlotlyChart } from './PlotlyChart'

interface Props {
  timeline: MarginTimeline
  selectedAntennaId: AntennaId
  recommendedId: AntennaId | null
}

export function MarginPlot({ timeline, selectedAntennaId, recommendedId }: Props) {
  const { data, layout } = useMemo(() => {
    const t = plotTheme()
    const practical = timeline.series.filter((s) => s.practical)
    const x = timeline.times.map(localStamp)
    const all = practical.flatMap((s) => s.marginDb)
    const yMin = Math.min(-10, Math.floor(Math.min(...all) / 5) * 5)
    const yMax = Math.max(10, Math.ceil(Math.max(...all) / 5) * 5)
    const clampedMin = Math.max(yMin, -40)

    const traces: Data[] = practical.map((s) => {
      const selected = s.antennaId === selectedAntennaId
      const rec = s.antennaId === recommendedId
      return {
        type: 'scatter',
        mode: 'lines',
        x,
        y: s.marginDb,
        name: `${s.label}${rec ? ' ★' : ''}${selected ? ' (yours)' : ''}`,
        line: { color: ANTENNA_COLORS[s.antennaId], width: selected ? 4 : 2 },
        opacity: selected || rec ? 1 : 0.75,
        hovertemplate: `${s.label}: %{y:.1f} dB<extra></extra>`,
      }
    })
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: timeline.elRad.map(rad2deg),
      yaxis: 'y2',
      name: 'Elevation',
      line: { color: t.muted, width: 1.5, dash: 'dot' },
      hovertemplate: 'el %{y:.1f}°<extra></extra>',
    })

    const shapes: Partial<Shape>[] = [
      // Everything below 0 dB is a failed link.
      { type: 'rect', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: clampedMin, y1: 0, fillcolor: t.bad, opacity: 0.08, line: { width: 0 }, layer: 'below' },
      { type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: 0, y1: 0, line: { color: t.bad, width: 2 } },
      { type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: REQUIRED_MARGIN_DB, y1: REQUIRED_MARGIN_DB, line: { color: t.muted, width: 1, dash: 'dash' } },
    ]
    // Time spans where YOUR antenna fails are shaded red top to bottom.
    const yours = timeline.series.find((s) => s.antennaId === selectedAntennaId)
    if (yours?.practical) {
      for (const iv of failureIntervals(timeline.times, yours.marginDb)) {
        shapes.push({
          type: 'rect',
          xref: 'x',
          x0: localStamp(iv.start),
          x1: localStamp(iv.end),
          yref: 'paper',
          y0: 0,
          y1: 1,
          fillcolor: t.bad,
          opacity: 0.15,
          line: { width: 0 },
          layer: 'below',
        })
      }
    }

    const layout: Partial<Layout> = {
      margin: { l: 55, r: 55, t: 10, b: 110 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text },
      hovermode: 'x unified',
      legend: { orientation: 'h', x: 0, xanchor: 'left', y: -0.22, yanchor: 'top' },
      xaxis: { type: 'date', gridcolor: t.grid, title: { text: 'Local time' } },
      yaxis: { title: { text: 'Link margin (dB)' }, range: [clampedMin, yMax], gridcolor: t.grid, zerolinecolor: t.bad },
      yaxis2: {
        title: { text: 'Elevation (°)' },
        overlaying: 'y',
        side: 'right',
        range: [0, 90],
        tickmode: 'array',
        tickvals: [0, 15, 30, 45, 60, 75, 90],
        showgrid: false,
      },
      shapes,
      annotations: [
        { xref: 'paper', x: 0.005, yref: 'y', y: REQUIRED_MARGIN_DB, text: '3 dB target', showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { size: 11, color: t.muted } },
        { xref: 'paper', x: 0.005, yref: 'y', y: 0, text: 'link fails below 0 dB', showarrow: false, xanchor: 'left', yanchor: 'top', font: { size: 11, color: t.bad } },
      ],
    }
    return { data: traces, layout }
  }, [timeline, selectedAntennaId, recommendedId])

  return <PlotlyChart data={data} layout={layout} height={480} label="Link margin versus time for each antenna" />
}
