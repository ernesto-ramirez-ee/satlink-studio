// Thin React wrapper around Plotly.react(), with Plotly lazy-loaded.
import type { Config, Data, Layout, PlotlyHTMLElement } from 'plotly.js-dist-min'
import { useEffect, useRef, useState } from 'react'
import { loadPlotly } from './loadPlotly'

interface Props {
  data: Data[]
  layout: Partial<Layout>
  height: number
  label: string
  /** Called with the clicked point's `customdata`. */
  onPointClick?: (customdata: unknown) => void
}

const CONFIG: Partial<Config> = { responsive: true, displaylogo: false }

export function PlotlyChart({ data, layout, height, label, onPointClick }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const clickRef = useRef(onPointClick)
  const listening = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    clickRef.current = onPointClick
  }, [onPointClick])

  useEffect(() => {
    let cancelled = false
    const el = ref.current
    loadPlotly()
      .then(async (Plotly) => {
        if (cancelled || !el) return
        const gd = (await Plotly.react(el, data, { ...layout, height }, CONFIG)) as PlotlyHTMLElement
        if (!listening.current) {
          listening.current = true
          gd.on('plotly_click', (ev) => {
            const pt = ev.points[0] as { customdata?: unknown } | undefined
            if (pt?.customdata !== undefined) clickRef.current?.(pt.customdata)
          })
        }
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [data, layout, height])

  // Re-fit whenever the container changes size (not only on window resize): a chart first drawn
  // while hidden or in a collapsing layout would otherwise stay tiny.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let lastWidth = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth || el.clientWidth === 0) return
      lastWidth = el.clientWidth
      void loadPlotly().then((Plotly) => {
        if (el.isConnected && el.classList.contains('js-plotly-plot')) void Plotly.Plots.resize(el)
      })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      void loadPlotly().then((Plotly) => Plotly.purge(el))
    }
  }, [])

  return (
    <div className="plot" aria-label={label} role="img" style={{ minHeight: height }}>
      {status !== 'ready' && (
        <p className="muted plot-status">{status === 'loading' ? 'Loading plot…' : 'The plotting library failed to load.'}</p>
      )}
      <div ref={ref} />
    </div>
  )
}
