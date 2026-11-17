# Build plan

Deadline **Wed Nov 18, 2026**. Phases run in order; each ends with something demo-able on the live site. **Phases 0–3 are a complete submission** (MVP gate, Sun Nov 15). Phase 4 adds the beam-hop wow factor.

| Phase | Dates (2026) | Deliverable |
| --- | --- | --- |
| 0 — Setup | Tue Nov 10 | Repo structure, deploy pipeline, tests running |
| 1 — Antenna Lab | Wed Nov 11 – Thu Nov 12 | 8 pattern models, 2D and 3D plots, sliders |
| 2 — Sky View | Fri Nov 13 | Own location, satellites overhead, pass list |
| 3 — Link Check | Sat Nov 14 – Sun Nov 15 | Margin vs. time, antenna recommendation → **MVP gate** |
| 4 — Live Steering | Mon Nov 16 – Tue Nov 17 | Dish pointing, phase map, beam-hop demo |
| Buffer + submit | Wed Nov 18 | Fixes, final deploy, write-up |

Tick boxes as items are done. Don't remove items without the owner's OK; move them to "Cut" with a reason instead.

## Phase 0 — Setup (Nov 10)

- [x] Vite + React + TypeScript project, Vitest running
- [x] Folder structure, `AGENTS.md`, and docs
- [x] GitHub Actions: deploy to Pages, plus a 6-hourly TLE snapshot
- [x] Units helper (dB ↔ linear, wavelength, FSPL) with tests
- [ ] Owner creates the GitHub repo, pushes, and enables Pages (see README) — moved to Submit day (D-012)
- [ ] First successful TLE snapshot committed by the workflow — a local snapshot exists (`npm run fetch-tle`, Nov 10); the workflow run waits for the repo
- [ ] Check SatNOGS DB API CORS from the deployed site

## Phase 1 — Antenna Lab (Nov 11–12)

- [x] `AntennaModel` interface and 8 models: dipole, monopole, QFH, Yagi, helix, patch, dish, planar phased array
- [x] Tests: peak gains within 0.5 dB of textbook values (`docs/PHYSICS.md`)
- [x] 2D polar cuts (E- and H-plane) and a 3D pattern surface, both updating live
- [x] Readouts: peak gain, HPBW, first sidelobe level
- [x] Phased array: steering angle slider; grating-lobe warning (exact rule d/λ ≥ 1/(1 + |sin θ0|))

## Phase 2 — Sky View (Nov 13)

- [x] Geolocation, with a manual lat/lon fallback, stored in the shared ground-station panel
- [x] SGP4 look angles; ISS az/el within 0.5° of an independent tracker (Heavens-Above, 17 passes: times ±1 s, max el. within its 1° rounding)
- [x] Polar sky plot of satellites above the horizon, updating every second
- [x] 24 h pass list for a selected satellite
- [x] 3D globe with orbits and the user's pin (lazy-loaded)

## Phase 3 — Link Check (Nov 14–15)

- [x] `satellites.json` with ≥ 10 satellites; each value has a cited source or is flagged as assumed (12 satellites, enforced by `src/data/satellites.test.ts`)
- [x] Link budget function, tested against a worked example
- [x] Margin-vs-time plot for the selected pass: one line per antenna, 0 dB line, red failure regions
- [x] Recommendation card: smallest antenna with ≥ 3 dB margin for the whole pass above 10° elevation, with its reason
- [ ] **MVP gate:** works on the live site for 3 real satellites from the user's location — passes locally for all 12 satellites (Nov 10); re-check on the live site at deploy (D-012)

## Phase 4 — Live Steering (Nov 16–17)

- [x] Dish panel: live az/el, slew rate, Doppler, keyhole warning near zenith
- [x] Phased array: N×M phase heat map, with an N-bit quantization option
- [x] Beam-hop demo: the array hands over to the next Starlink satellite when the current one drops below 25° elevation; hand-overs marked on a timeline
- [x] Simulated clock (play, pause, ×60) for the class presentation
- [x] *(Added by the owner, Nov 10)* 3D pass animation: Earth, satellite and an oversized dish or phased array whose radiation lobe follows the satellite over a pass, with a time slider, play and follow-clock (D-024)

## Submit (Nov 18)

- [ ] Final deploy, smoke-tested on the live URL
- [ ] README feature table updated to "Done"
- [ ] Short write-up of how Claude was directed (for the class)

## Cut

_Nothing cut yet._
