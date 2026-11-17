# Progress log

Newest entry first. Every session adds one entry when it ends.

## Status at a glance

| Phase | Status |
| --- | --- |
| 0 — Setup | Mostly done; waiting on the owner to create the GitHub repo |
| 1 — Antenna Lab | **Done** (Nov 10, ahead of the Nov 12 date); verified locally, not yet on Pages |
| 2 — Sky View | **Done** (Nov 10, ahead of Nov 13); verified locally |
| 3 — Link Check | **Done** (Nov 10, ahead of the Nov 15 MVP gate); MVP gate met locally, live-site check at deploy |
| 4 — Live Steering | **Done** (Nov 10, ahead of Nov 17); verified locally |

---

## 2026-11-17 — Ready for GitHub

- Moved `deploy.yml` and `update-tle.yml` into `.github/workflows/`. `setup/` now only holds a note saying it's obsolete; the owner can delete it (the agent's delete was blocked by permissions).
- README "Publish to GitHub Pages" updated: install Git, set name/email, create an empty public repo, `git init` → push, Settings → Pages → Source "GitHub Actions", then run the deploy workflow once.
- Still to do (owner): install Git, create the repo, push, enable Pages. Then the agent does the live-site smoke test.

---

## 2026-11-17 — Orbit data refreshed

- `npm run fetch-tle`: stations, amateur and Starlink downloaded. Weather, GPS, Iridium and geo returned HTTP 500 from CelesTrak at first and were retried a minute later, successfully. All 7 groups are now from 2026-11-17, and all 12 Link Check satellites are present with epochs under a day old. 152 tests pass.
- Fixed `scripts/fetch-tle.mjs`: a partial failure used to drop the failed groups from `index.json` and stamp the whole snapshot with today's date. Each group now has its own `fetchedAt`, failed groups keep their previous file and entry, the top-level `fetchedAt` is the oldest group (so "snapshot age" is never understated), and the script accepts group names to retry only the failures (`node scripts/fetch-tle.mjs weather geo`). The GitHub workflow call (no arguments) is unchanged. See D-027.
- Reminder: until the GitHub workflow is running (Submit day), refresh by hand before demos. CelesTrak asks for at most one download every 2 hours.

---

## 2026-11-10 — 3D animation tracks the Starlink beam-hop (owner request)

**Done**

- The 3D pass animation has a source switch: "<satellite> pass" or "Starlink beam-hop". Choosing the beam-hop loads Starlink and computes the schedule if needed, then switches to the phased array. The slider spans the 30-minute window with a tick per hand-over. The readouts show the serving satellite, hand-overs so far and the next one, and outages hide the satellite.
- Each serving satellite's arc is drawn as its own track (16 for 15 hand-overs). The phase map and CSV weights follow the animation and are labelled with the serving satellite's name.
- Engine: `beamHopFrames` and `trackStarts` (2 new tests, 152 total).
- Checked in the browser: hand-over at 14:45:10, with STARLINK-4105 at 27.5° (θ 62.5°, past the scan limit) replaced by STARLINK-31797 at 83.7° (θ 6.3°). The phase panel switched target and time with it, and there are no console errors. A screenshot showed the beam pointing near zenith after the hand-over.
- The beam-hop timeline's legend (≈15 names) overlapped the axis; it was removed, and the names show on hover.

---

## 2026-11-10 — Phase map follows the animation slider; exact weights export (owner request)

**Done**

- The phased-array phase map now steers toward the 3D animation's current frame by default (new "3D animation (slider time)" target). Moving the slider, pressing play or following the clock updates the phases, steering angles, and scan and quantization loss. The panel shows the exact time (local and UTC) the weights are for.
- New engine function `elementWeights` returns the complex weight of each element (taper amplitude × e^{j·phase}, quantized if bits are set).
- The panel has an "Element weights" table (m, n, amplitude, phase, Re, Im) and Download / Copy CSV with metadata (target, UTC time, θ/φ, array size, spacing, taper, bits, and notes when the beam is clamped or the satellite is below the horizon). See D-025.
- Tests: 5 new (150 total). Checked in the browser: the panel follows the slider (02:01:25 → 02:03:39), the steering matches the animation (az 147.4°, el 50.1° → θ 39.9°, φ 302.6°), and element (1, 0) is 297.82° in the table and the heat map, matching a hand calculation (297.8°).

---

## 2026-11-10 — 3D pass animation (owner request)

**Done**

- The new "3D pass animation" card at the top of Live Steering: Earth (local Blue Marble texture), the satellite with its pass track (blue above the horizon, grey below), a line of sight (green when tracking, orange beyond the array's scan limit, hidden below the horizon), the local horizon disc, and an oversized antenna at your station.
  - **Dish**: az/el mount that turns and tilts to follow the satellite and parks pointing up when it's out of range. Its lobe is the real Antenna Lab dish pattern (30 dB scale).
  - **Phased array**: the panel stays still, and its top face shows the element phases (same colours as the phase map). The lobe is the engine's steered array pattern, which shrinks by the scan loss and stops at the 60° limit.
  - **Controls**: pass picker (next 24 h), slider over the pass ± 2 min, play, and "follow the clock" (works with ×60), with live readouts and a status line (tracking / beyond scan / out of range).
- Engine: `passFrames`, `nearestFrame` and `arrayLobeSurface` (5 new tests, 145 total). `three` + `@types/three` were added with the owner's OK (D-024).
- Verified numerically in the browser: dish boresight to satellite error 0.000°; array lobe peak within 1.7° (its 2° grid) with peak length 0.948 vs. the expected 0.952 from the 1.45 dB scan loss; the out-of-range and beyond-scan states; play advances. Renders checked by screenshot.
- Fixed while verifying: the camera was framed too far out (everything a few pixels wide); parallax from the oversized antenna (12° aim error), fixed by placing the satellite topocentrically from the antenna pivot; an oversized satellite marker; a VHF dish lobe covering half the sky (now drawn at the Antenna Lab frequency, with a note); "59.99999999999999°" in two messages.

**Notes**

- A hidden browser tab pauses `requestAnimationFrame`, so the scene only animates while visible (normal for WebGL). In dev builds the scene is exposed as `window.__passScene` for debugging.

---

## 2026-11-10 — Phase 4: Live Steering

**Done**

- Engine `src/engine/steering/`: Doppler, dish commands and slew rates, keyhole detection, TLE pointing error, element phases with B-bit quantization, quantization and scan loss, and the beam-hop schedule (D-021). 20 new tests, 140 total.
- Simulated clock (D-023): ▶/❚❚, ×60 and "Now" in the header drive every tab. The side panel marks the time as simulated.
- Live Steering tab:
  - **Dish pointing** for the selected satellite: az/el command, slew rates, range rate, Doppler and the frequency to tune to (from satellites.json), TLE error vs. beamwidth, the next or current pass with peak slew rates, a keyhole warning, and a mini sky plot. It also warns when your dish isn't practical at that frequency.
  - **Phased-array phases**: a heat map with a cyclic colour scale for your Antenna Lab array, steered at the selected satellite or the beam-hop serving satellite. Continuous or 1–6-bit phase shifters, with scan loss, quantization loss and the grating-lobe and scan-limit warnings.
  - **Starlink beam-hop**: loads ~11 200 Starlink satellites on demand. It shows the sky plot with the 25° ring and the serving track, a timeline (elevation per serving segment, hand-over lines, 25° limit, "now" marker), and the serving satellite with the countdown to the next hand-over. Example: about 14 hand-overs per 30 min from Notre Dame.
- Fixed while verifying: the schedule effect could hang on "Computing…" (busy flag cancelled its own timer); stale "outage" status while recomputing; charts first drawn in a hidden or zero-width container stayed tiny (PlotlyChart now re-fits with a ResizeObserver).

**Next**

1. Owner (Submit day, D-012): install Git, create the GitHub repo, move `setup/github-workflows/*.yml` into `.github/workflows/`, push, enable Pages, run "Update TLE snapshot".
2. Agent: README feature table and data credits, live-site smoke test (all four tabs, MVP gate), and the write-up of how Claude was directed.

**Notes**

- At ×60 the beam-hop schedule is recomputed every ~29 s of real time (a sub-second pause).
- Lint shows only React-Compiler memo hints (the compiler isn't used).

## 2026-11-10 — Phase 3: Link Check (MVP)

**Done**

- RF data: `public/data/satellites.json` (schema v2, D-017) has 12 satellites over LEO, MEO and GEO. Frequencies come from the SatNOGS DB API; GPS, GOES HRIT, NOAA-20 HRD, Metop AHRPT, ARISS, AMSAT-UK and the Starlink filing were checked by fetching the documents. EIRPs that couldn't be sourced are flagged "assumed" with how they were estimated. A test enforces "sourced or assumed" for every value.
- Engine `src/engine/link/`: link budget, atmosphere, noise (galactic + ground + LNA), polarization, pointing, ground mounts and practicality (D-018/D-019), margin timeline, the recommendation rule, EIRP vs. elevation, and failure intervals. 41 new tests (120 total), including the hand-worked GEO budget.
- UI: the Link Check tab has satellite, downlink and pass pickers (GEO shows the next hour) and a margin-vs-time plot: one line per practical antenna, your antenna drawn thick, the 0 dB and 3 dB lines, the region below 0 tinted red, and the times your antenna fails shaded red. Below it: a recommendation card with the reason, runner-up and "why not simpler", a table of all antennas with verdicts, a step-by-step budget for your antenna at the highest point, and the downlink data with "assumed" badges and source links. The ground-station panel gained an LNA noise-figure slider.
- MVP gate (locally, Notre Dame): Link Check runs for all 12 satellites in about 0.6 s each. Example recommendations: ISS FM → monopole, SO-50 → Yagi, GOES-18/19 HRIT → 1 m dish (7.5 dB, matching a hand calculation), Metop-B → dish. NOAA-20 X-band fails with a 1 m dish (worst −0.9 dB), which matches the usual 2+ m dishes for HRD.
- Fixed while verifying: the dish practicality limit (10 λ → 4 λ), a UTC/local offset in the failure shading, and the plot legend overlapping the axis.

**Next**

1. Agent: Phase 4 (Live Steering): dish pointing (az/el, slew rate, Doppler, keyhole warning), the phased-array phase map with quantization, the Starlink beam-hop demo, and the simulated clock (play/pause/×60).

**Notes**

- Results for satellites with assumed EIRP (Meteor LRPT, AO-73) are only as good as those assumptions. The Meteor margins look generous, so the real EIRP is probably lower than 6 dBW.
- Lint shows only React-Compiler memo hints (the compiler isn't used).

## 2026-11-10 — Phase 2: Sky View

**Done**

- Downloaded a local CelesTrak snapshot (`npm run fetch-tle`). The `noaa` group no longer exists, so it was removed from the script (D-013).
- Engine `src/engine/orbit/`: WGS-84 geodesy and ENU look angles, an SGP4 wrapper with range rate, orbit classification, a pass finder, and sky and ground tracks. 17 new tests, 79 total, all passing.
- Independent check: ISS passes for Notre Dame match Heavens-Above (all 17 passes Nov 10–12: culmination ±1 s, max elevation within its 1° rounding). This meets the 0.5° requirement.
- Data `src/data/tle.ts`: snapshot loaders and a merged satellite catalog.
- UI: the ground-station panel has "Use my location" (Geolocation API), validated manual entry, the antenna summary, a local/UTC clock and the snapshot age. The location is remembered in this browser only. Sky View has group toggles, a live polar sky plot (click to select), selected-satellite readouts (az/el, range, range rate, sub-satellite point, element age), a 24 h pass list with a minimum-elevation filter and the pass track on the plot, a table of satellites above the horizon, and a lazy-loaded 3D globe (globe.gl) with your pin and the selected orbit.
- Added `globe.gl` (D-014), a local Earth texture, and `worker.format: 'es'` in Vite for satellite.js 7 (D-015). Build, tests and lint pass. The only lint output is 2 React-Compiler-only hints in SkyView, which don't apply because the compiler isn't used.
- Checked in the browser: GOES-18 seen from Quito (manual entry) is due west at 23.5°, matching a hand calculation. Starlink loads 11,423 satellites in 1.5 s. No console errors.

**Next**

1. ~~Owner: OK Meteor-M2 as the 137 MHz replacement?~~ Approved (D-013).
2. Agent: Phase 3 (Link Check): build `satellites.json` with ≥ 10 sourced satellites, the link-budget engine and its tests, the margin-vs-time plot, and the antenna recommendation.

**Blockers / open questions**

- The local TLE snapshot is from Nov 10. Refresh it with `npm run fetch-tle` (at most once every 2 h) before demos until the GitHub workflow takes over.

## 2026-11-10 — Phase 1: Antenna Lab

**Done**

- Engine: `AntennaModel` interface plus `defineAntenna()` helper, 8 models (dipole, monopole, QFH, Yagi, helix, patch, dish, phased array), numerical directivity, own Bessel J0/J1/J2, and pattern metrics (cuts, HPBW, first sidelobe, 3D surface).
- Tests: 62 passing across 13 files. Textbook checks: dipole 2.15 dBi and 78° HPBW; monopole 5.15 dBi; dish 39.8 dBi with −17.6 dB SLL / 58.9·λ/D (uniform) and 72.8·λ/D / −24.6 dB (tapered); Kraus helix; NBS Yagi table; array ≈ 4πA/λ², steering, scan loss, grating-lobe rule.
- UI: the Antenna Lab tab has an antenna picker, a log frequency slider, generated parameter sliders, a polar cut plot (with zoom to the main lobe), a 3D surface, readouts, warnings and a simplifications note. Plotly is lazy-loaded (separate 1.4 MB gzip chunk; main bundle 77 kB gzip).
- `npm test`, `npm run build` and `npm run lint` pass. The dev server was checked in a browser: all 8 antennas render with no console errors, in light and dark mode, and the grating-lobe warning shows for 8×8, d = 0.7λ, θ0 = 40°.
- Added `.claude/launch.json` for the preview server. Decisions D-006 to D-010 logged; PHYSICS.md clarified (dish taper vs. HPBW, array reference).

**Next**

1. Agent: Phase 2 (Sky View): geolocation + manual fallback in `GroundStationPanel`, SGP4 look angles (`src/engine/orbit/`), polar sky plot, 24 h pass list, then the lazy-loaded globe.
2. Owner: install Git, create the GitHub repo, move `setup/github-workflows/*.yml` into `.github/workflows/`, push, enable Pages, and run "Update TLE snapshot" once. Phase 2 needs TLE data: if the repo isn't up yet, the agent will run `npm run fetch-tle` locally.

**Blockers / open questions**

- ~~PATH order~~ Resolved: a fresh terminal now finds Node v22.23.4 (`C:\Program Files\nodejs`) before Pulsar's bundled v20.16. Terminals opened before the fix still need to be reopened.
- ~~Yagi table check~~ Owner verified the NBS TN 688 values (D-007).
- Owner decision: GitHub repo + Pages setup moves to the end (Submit day). Until then the app runs locally with `npm run dev` → http://localhost:5173.
- ~~`@types/plotly.js-dist-min`~~ Removed with the owner's OK (Plotly 4 ships its own types). Tests, build and lint still pass.

## 2026-11-10 — Project setup

**Done**

- Scaffolded Vite 8 + React 19 + TypeScript 7 with `base: './'` for GitHub Pages.
- App shell with four placeholder tabs and the shared ground-station panel.
- `src/engine/units.ts` with tests (4 passing). `npm test`, `npm run build`, and `npm run lint` all pass.
- Workflows: `deploy.yml` (test → build → Pages) and `update-tle.yml` (CelesTrak snapshot every 6 h).
- Docs: `AGENTS.md`, `docs/*`, and a README in each source folder.

**Next**

1. Owner: move `setup/github-workflows/*.yml` into `.github/workflows/` (see `setup/README.md`), then create the GitHub repo, push, and set Settings → Pages → Source to "GitHub Actions" (steps in the README). Then run the "Update TLE snapshot" workflow once by hand.
2. Agent: Phase 1, starting with the `AntennaModel` interface plus dipole and dish models and their tests.

**Blockers / open questions**

- The agent's file bridge can't write into `.github/`, so the workflows were delivered in `setup/github-workflows/`. If `.github/workflows/` exists, `setup/` can be deleted.
- The `public/data/tle/` snapshot is empty until the workflow runs for the first time, or until `npm run fetch-tle` is run locally.
