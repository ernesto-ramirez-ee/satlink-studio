# engine/

Pure physics and math. **No React, no DOM, no fetch** in this folder. Every function takes plain numbers or objects and returns plain numbers or objects, so it can be unit-tested with Vitest.

| Folder | Phase | Purpose | Main exports (planned) |
| --- | --- | --- | --- |
| `units.ts` | 0 | Constants, dB ↔ linear, wavelength, FSPL | `toDb`, `fromDb`, `wavelength`, `fspl` |
| `antennas/` | 1 | Radiation pattern models | `gain(theta, phi, params)` per antenna type, `peakGain`, `hpbw` |
| `orbit/` | 2 | SGP4 propagation and look angles (wraps satellite.js) | `lookAngles(sat, observer, date)`, `predictPasses(...)` |
| `link/` | 3 | Link budget and antenna ranking | `linkBudget(...)`, `marginOverPass(...)`, `recommendAntenna(...)` |
| `steering/` | 4 | Dish pointing, Doppler, phased-array phases, beam hop | `dishCommand(...)`, `doppler(...)`, `elementPhases(...)`, `beamHopSchedule(...)` |

Rules:

- Angles are **radians** inside the engine; convert to degrees only for display.
- Quantities are **SI and linear** inside the engine; dB only at the edges (inputs and outputs that are conventionally in dB, such as EIRP, gain and margin, are named with a `Db` / `Dbi` / `Dbw` suffix).
- Put tests next to the code: `foo.ts` → `foo.test.ts`. Every model needs at least one test against a textbook value (see `docs/PHYSICS.md`).
