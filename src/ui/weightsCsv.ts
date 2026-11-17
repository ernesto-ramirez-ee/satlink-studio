// CSV export of phased-array element weights (formatting only; the values come from the engine).
import type { ElementWeight } from '../engine/steering'

export interface WeightsMeta {
  target: string
  time: Date | null
  thetaDeg: number
  phiDeg: number
  bits: number
  taper: string
  nx: number
  ny: number
  dxLambda: number
  dyLambda: number
  note?: string
}

export function weightsCsv(weights: ElementWeight[], meta: WeightsMeta): string {
  const lines = [
    `# SatLink Studio phased-array weights`,
    `# target: ${meta.target}`,
    `# time_utc: ${meta.time ? meta.time.toISOString() : 'n/a'}`,
    `# steering_theta_deg: ${meta.thetaDeg.toFixed(4)} (from zenith), steering_phi_deg: ${meta.phiDeg.toFixed(4)} (from east, counter-clockwise)`,
    `# array: ${meta.nx} x ${meta.ny}, dx = ${meta.dxLambda} lambda, dy = ${meta.dyLambda} lambda, taper: ${meta.taper}, phase shifters: ${meta.bits ? `${meta.bits}-bit` : 'continuous'}`,
    `# m = column along x (east), n = row along y (north); w = amplitude * exp(j * phase)`,
  ]
  if (meta.note) lines.push(`# note: ${meta.note}`)
  lines.push('m,n,amplitude,phase_deg,re,im')
  for (const w of weights) {
    lines.push([w.m, w.n, w.amplitude.toFixed(6), ((w.phaseRad * 180) / Math.PI).toFixed(4), w.re.toFixed(6), w.im.toFixed(6)].join(','))
  }
  return lines.join('\n') + '\n'
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
