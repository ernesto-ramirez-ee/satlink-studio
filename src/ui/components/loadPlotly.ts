// Plotly is ~1 MB, so it is loaded on first use (a separate chunk), never at startup.

export type PlotlyStatic = (typeof import('plotly.js-dist-min'))['default']

let pending: Promise<PlotlyStatic> | undefined

export function loadPlotly(): Promise<PlotlyStatic> {
  if (!pending) pending = import('plotly.js-dist-min').then((m) => m.default)
  return pending
}

/** Colours for plots, read from the CSS design tokens so light and dark mode both work. */
export function plotTheme(): { text: string; muted: string; grid: string; accent: string; bad: string } {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    text: v('--text', '#1b1f27'),
    muted: v('--muted', '#5d6675'),
    grid: v('--border', '#dde1e7'),
    accent: v('--accent', '#1f6feb'),
    bad: v('--bad', '#cf222e'),
  }
}
