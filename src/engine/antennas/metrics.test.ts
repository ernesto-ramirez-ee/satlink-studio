import { describe, expect, it } from 'vitest'
import { dipole } from './dipole'
import { dish } from './dish'
import { firstSidelobeDb, hpbwRad, patternMetrics, sampleCut, sampleSurface, surfaceToXyz } from './metrics'
import { qfh } from './qfh'

describe('metrics', () => {
  it('samples a closed cut from −π to π', () => {
    const cut = sampleCut(dipole, dipole.defaults, dipole.defaultFreqHz, 0, Math.PI / 180)
    expect(cut.thetaRad[0]).toBeCloseTo(-Math.PI, 12)
    expect(cut.thetaRad.at(-1)).toBeCloseTo(Math.PI, 12)
    expect(cut.gainDbi[0]).toBeCloseTo(cut.gainDbi.at(-1)!, 9)
  })

  it('ignores a dipole’s second main lobe when looking for sidelobes', () => {
    const cut = sampleCut(dipole, dipole.defaults, dipole.defaultFreqHz, 0)
    expect(firstSidelobeDb(cut)).toBeNull()
  })

  it('returns null HPBW for a pattern that never drops 3 dB (QFH with no back-lobe suppression, in-plane)', () => {
    // Turnstile horizon level is −3.01 dB, so the cut barely crosses; with front-back 0 the whole
    // cut stays within ~3 dB and the HPBW is ~180°.
    const hpbw = hpbwRad(sampleCut(qfh, { frontBackDb: 0 }, qfh.defaultFreqHz, 0))
    expect(hpbw === null || hpbw > Math.PI * 0.9).toBe(true)
  })

  it('bundles peak, cuts, HPBW and sidelobe readouts', () => {
    const m = patternMetrics(dish, dish.defaults, dish.defaultFreqHz)
    expect(m.peakGainDbi).toBeCloseTo(39.8, 1)
    expect(m.hpbwRad[0]).not.toBeNull()
    expect(m.firstSidelobeDb).toBeLessThan(-20)
  })

  it('maps the surface peak to radius 1 on boresight', () => {
    const s = sampleSurface(dish, dish.defaults, dish.defaultFreqHz, 21, 9)
    const xyz = surfaceToXyz(s, dish.peakGainDbi(dish.defaults, dish.defaultFreqHz))
    expect(xyz.z[0][0]).toBeCloseTo(1, 6)
    expect(xyz.x[0][0]).toBeCloseTo(0, 12)
  })
})
