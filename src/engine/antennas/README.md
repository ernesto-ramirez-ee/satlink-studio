# engine/antennas/ — Phase 1 (done)

One file per antenna type, each built with `defineAntenna()` (`define.ts`) from a power pattern F(θ, φ) and, where one exists, a closed-form peak gain. Without a closed form, the gain is the numerical directivity (`directivity.ts`). Interface (`types.ts`):

```ts
export interface AntennaModel<P extends Params = Params> {
  id: AntennaId                // 'dipole' | 'monopole' | 'qfh' | 'yagi' | 'helix' | 'patch' | 'dish' | 'phased-array'
  label: string
  description: string
  polarization: 'linear' | 'rhcp' | 'lhcp'
  defaults: P                  // all parameters are numbers; options are encoded 0, 1, …
  defaultFreqHz: number
  paramSpecs: ParamSpec[]      // slider / drop-down descriptions for the UI
  gain(theta, phi, params, freqHz): number   // linear gain, radians
  peakGainDbi(params, freqHz): number
  cutPhis(params): [number, number]          // φ of the two principal cuts
  info(params, freqHz): InfoItem[]           // extra readouts (sizes), in display units
  warnings(params, freqHz): string[]         // e.g. grating lobes
}
```

- `index.ts`: the `ANTENNAS` registry, `getAntenna(id)`, and `gratingLobeRisk`.
- `metrics.ts`: `sampleCut`, `hpbwRad`, `firstSidelobeDb`, `patternMetrics`, `sampleSurface`, `surfaceToXyz`.
- `../math/bessel.ts`: J0, J1, J2, `jinc`, `jinc2` for the dish.

`theta` is measured from the antenna boresight (z-axis), `phi` around it. Formulas and expected test values are in `docs/PHYSICS.md`.
