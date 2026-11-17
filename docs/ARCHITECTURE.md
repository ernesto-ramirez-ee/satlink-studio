# Architecture

The whole app runs in the browser as a static site on GitHub Pages. There is no backend.

```
                ┌────────────────────── Data (fetched + cached) ───────────────────────┐
                │ public/data/tle/*.json   SatNOGS DB API   Geolocation   satellites.json │
                └───────────────┬──────────────────────────────────────────────────────┘
                                │  src/data/ loaders (the only non-UI code that fetches)
                ┌───────────────▼──────────── Engine (src/engine/, pure TS) ────────────┐
                │ antennas/ ──► link/ ◄── orbit/ ──► steering/        units.ts          │
                └───────────────┬──────────────────────────────────────────────────────┘
                                │  plain function calls, recomputed per clock tick / slider change
                ┌───────────────▼──────────── UI (src/ui/, React) ──────────────────────┐
                │ Antenna Lab   Sky View   Link Check   Live Steering  + Ground-station panel │
                └──────────────────────────────────────────────────────────────────────┘
```

## Layers

| Layer | Folder | Depends on | Rule |
| --- | --- | --- | --- |
| Data | `public/data/`, `src/data/` | — | Same-origin snapshot first; live APIs optional with fallback |
| Engine | `src/engine/` | `satellite.js` only | Pure functions, SI/linear/radians, fully unit-tested |
| UI | `src/ui/`, `src/App.tsx` | engine, data | No formulas in components |

## Shared state

Keep it simple: React state in `App.tsx`, passed down as props (or one React context if it grows). State that's shared across tabs:

- `observer`: `{ latDeg, lonDeg, altM, source: 'gps' | 'manual' }`
- `selectedAntenna`: `{ type, params }`
- `selectedSatellite`: NORAD ID
- `clock`: `{ now: Date, playing: boolean, speed: 1 | 60 }`, so the simulated clock drives every tab

## Tech stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Build | Vite 8, TypeScript 7, React 19 | `base: './'` for Pages |
| Orbits | `satellite.js` | SGP4/SDP4 |
| Plots | `plotly.js-dist-min` | Lazy-loaded; polar, 3D surface, line, heat map |
| Globe | `globe.gl` (added in Phase 2) | Lazy-loaded; local Blue Marble texture in `public/img/`; ask the owner before switching to CesiumJS |
| 3D animation | `three` (0.187) | Lazy-loaded; Live Steering's pass animation (D-024) |
| Tests | Vitest | `src/**/*.test.ts` |
| Lint | oxlint | |
| CI/CD | GitHub Actions | `deploy.yml`, `update-tle.yml` |

## Deployment

`deploy.yml` runs on each push to `main`: `npm ci` → `npm test` → `npm run build` → upload `dist/` → deploy to Pages. `update-tle.yml` runs every 6 hours. It refreshes `public/data/tle/`, commits any change, and starts a deploy.
