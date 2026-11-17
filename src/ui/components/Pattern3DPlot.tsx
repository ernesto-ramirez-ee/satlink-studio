// 3D radiation pattern surface. Radius and colour both show gain (dBi), 40 dB range.
import type { Data, Layout } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import { surfaceToXyz, type PatternSurface } from '../../engine/antennas/metrics'
import { plotTheme } from './loadPlotly'
import { PlotlyChart } from './PlotlyChart'

interface Props {
  surface: PatternSurface
  peakDbi: number
  rangeDb?: number
}

export function Pattern3DPlot({ surface, peakDbi, rangeDb = 40 }: Props) {
  const data = useMemo<Data[]>(() => {
    const { x, y, z } = surfaceToXyz(surface, peakDbi, rangeDb)
    return [
      {
        type: 'surface',
        x,
        y,
        z,
        surfacecolor: surface.gainDbi,
        cmin: peakDbi - rangeDb,
        cmax: peakDbi,
        colorscale: 'Viridis',
        colorbar: { title: { text: 'dBi' }, len: 0.7 },
        hovertemplate: '%{surfacecolor:.1f} dBi<extra></extra>',
      },
    ]
  }, [surface, peakDbi, rangeDb])

  const layout = useMemo<Partial<Layout>>(() => {
    const t = plotTheme()
    const axis = (title: string) => ({
      title: { text: title },
      range: [-1.05, 1.05] as [number, number],
      showticklabels: false,
      gridcolor: t.grid,
      zerolinecolor: t.muted,
      backgroundcolor: 'rgba(0,0,0,0)',
    })
    return {
      margin: { l: 0, r: 0, t: 10, b: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text },
      uirevision: 'keep-camera',
      scene: {
        aspectmode: 'cube',
        xaxis: axis('x'),
        yaxis: axis('y'),
        zaxis: axis('z (boresight)'),
        camera: { eye: { x: 1.5, y: 1.5, z: 0.9 } },
      },
    }
  }, [])

  return <PlotlyChart data={data} layout={layout} height={420} label="3D radiation pattern" />
}
