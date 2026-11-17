// Beam-hop timeline: elevation of the serving satellite, one colour per segment, hand-overs as
// vertical lines, the 25° limit, and the current (simulated) time.
import type { Annotation, Data, Layout, Shape } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import type { BeamHopSchedule } from '../../engine/steering'
import { rad2deg } from '../../engine/units'
import { localStamp } from '../format'
import { plotTheme } from './loadPlotly'
import { PlotlyChart } from './PlotlyChart'

const SEGMENT_COLORS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00']

interface Props {
  schedule: BeamHopSchedule
  now: Date
  minElDeg: number
}

export function HopTimeline({ schedule, now, minElDeg }: Props) {
  const data = useMemo<Data[]>(
    () =>
      schedule.segments.map((seg, i) => {
        const pts = schedule.samples.filter((s) => s.noradId === seg.noradId && s.time >= seg.start && s.time <= seg.end)
        return {
          type: 'scatter',
          mode: 'lines',
          name: seg.name,
          x: pts.map((p) => localStamp(p.time)),
          y: pts.map((p) => rad2deg(p.elRad)),
          line: { color: SEGMENT_COLORS[i % SEGMENT_COLORS.length], width: 3 },
          hovertemplate: `${seg.name}<br>el %{y:.1f}°<extra></extra>`,
        }
      }),
    [schedule],
  )

  const nowStamp = localStamp(now)
  const layout = useMemo<Partial<Layout>>(() => {
    const t = plotTheme()
    const shapes: Partial<Shape>[] = [
      { type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: minElDeg, y1: minElDeg, line: { color: t.muted, width: 1.5, dash: 'dash' } },
      ...schedule.handovers
        .filter((h) => h.toId !== null)
        .map(
          (h): Partial<Shape> => ({
            type: 'line',
            xref: 'x',
            x0: localStamp(h.time),
            x1: localStamp(h.time),
            yref: 'paper',
            y0: 0,
            y1: 1,
            line: { color: t.text, width: 1, dash: 'dot' },
          }),
        ),
      { type: 'line', xref: 'x', x0: nowStamp, x1: nowStamp, yref: 'paper', y0: 0, y1: 1, line: { color: t.bad, width: 2.5 } },
    ]
    const annotations: Partial<Annotation>[] = [
      { xref: 'x', x: nowStamp, yref: 'paper', y: 1, text: 'now', showarrow: false, yanchor: 'bottom', font: { color: t.bad, size: 11 } },
      { xref: 'paper', x: 1, yref: 'y', y: minElDeg, text: `${minElDeg}° hand-over limit`, showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: t.muted, size: 11 } },
    ]
    return {
      margin: { l: 50, r: 15, t: 20, b: 50 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text },
      // A 30-minute window has ~15 serving satellites: names are shown on hover instead of a legend.
      showlegend: false,
      xaxis: { type: 'date', gridcolor: t.grid, title: { text: 'Local time' } },
      yaxis: { title: { text: 'Serving satellite elevation (°)' }, range: [0, 90], gridcolor: t.grid },
      shapes,
      annotations,
    }
  }, [schedule, nowStamp, minElDeg])

  return <PlotlyChart data={data} layout={layout} height={380} label="Beam-hop timeline" />
}
