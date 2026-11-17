# engine/steering/ — Phase 4 (done)

- `dish.ts`: `dishCommand(satrec, observer, date)` → az/el, slew rates, range rate; `dopplerShiftHz`; `passPeakRates`; `isKeyholePass` (> 85°); `tleAngularErrorRad`; `ROTATOR_MAX_RATE_RAD_S` (5°/s, assumed)
- `phases.ts`: `elementWeights({ …PhaseSpec, taper })` → complex weight per element (amplitude, phase, re, im); `elementPhases({ nx, ny, dxLambda, dyLambda, thetaRad, phiRad, bits? })` → phases[n][m] in [0, 2π), optionally quantized; `arrayGainFromPhases`; `quantizationLoss`; `scanLossDb`; `steeringFromAzEl`
- `animation.ts`: `passFrames(satrec, observer, from, to, stepS)` → per-frame sub-satellite point and az/el/range for the 3D pass animation; `nearestFrame`; `beamHopFrames(schedule, candidates, observer)` → one frame per beam-hop step for the serving satellite (`trackId` changes at hand-overs, `hidden` during outages), `trackStarts`; `arrayLobeSurface(params, θ0, φ0)` → the steered array pattern in dB relative to broadside (peak = −scan loss)
- `beamhop.ts`: `beamHopSchedule(candidates, observer, start, durationS, stepS, minElRad = 25°)` → samples, serving segments, hand-overs; `bestCandidate`; `sampleAt`

Formulas and test values: docs/PHYSICS.md (Steering).
