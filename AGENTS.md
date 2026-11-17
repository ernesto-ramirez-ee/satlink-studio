# AGENTS.md — start here

You are working on **SatLink Studio**, a class project built by an AI agent under the direction of the project owner (Ernesto, electrical engineering background). **Deadline: Wednesday, November 18, 2026.**

The owner directs; the agent builds. Don't change scope, drop features, or add major dependencies without asking the owner first. Log every such decision in `docs/DECISIONS.md`.

## What the app does

A static web app, hosted on GitHub Pages, that:

1. Visualizes radiation patterns of 8 antenna types with live parameter sliders (**Antenna Lab**).
2. Uses the browser's location to show which real satellites are overhead and when they pass (**Sky View**).
3. Runs a link budget over a pass, plots **link margin vs. time**, and recommends the best antenna (**Link Check**).
4. Gives live pointing for dishes and per-element phases for phased arrays, including a Starlink-style **beam-hop demo** (**Live Steering**).

## Read in this order

1. `docs/ASSIGNMENT.md` — goal, deliverables, grading context, constraints
2. `docs/PROGRESS.md` — **current status and what to do next** (always check this)
3. `docs/PLAN.md` — phases, dates, done-criteria checklists
4. `docs/ARCHITECTURE.md` — layers, folders, data flow
5. `docs/PHYSICS.md` — formulas and the textbook values tests must match
6. `docs/DATA_SOURCES.md` — CelesTrak, SatNOGS, `satellites.json` schema
7. `docs/DECISIONS.md` — decisions already made; don't relitigate them silently

## Commands

```bash
npm install          # once
npm run dev          # local dev server (http://localhost:5173)
npm test             # Vitest, must pass before every commit
npm run build        # type-check + production build into dist/
npm run lint         # oxlint
npm run fetch-tle    # refresh public/data/tle/ from CelesTrak (max once per 2 h)
```

## Folder map

```
.github/workflows/   deploy.yml (build + publish to Pages), update-tle.yml (TLE snapshot every 6 h)
docs/                project docs (this file links them all)
public/data/         static data served with the site: satellites.json, tle/*.json
scripts/             Node scripts run by CI or by hand (fetch-tle.mjs)
src/engine/          pure physics: units, antennas, orbit, link, steering (no React, no fetch)
src/data/            browser data loaders (the only non-UI code allowed to fetch)
src/ui/tabs/         one React component per tab
src/ui/components/   shared UI pieces
```

Each folder under `src/` has a `README.md` describing its planned contents and interfaces.

## Hard constraints (GitHub Pages)

- **Static only.** No server, no database, no API keys or secrets in the code. Everything runs in the browser.
- **Relative paths.** `vite.config.ts` uses `base: './'`. Build data URLs from `import.meta.env.BASE_URL`. Don't add a client-side router with path URLs; use tabs or hash routes.
- **HTTPS is required** for geolocation. Pages provides it; `localhost` also works.
- External APIs must work from the browser (CORS). Orbital data comes from the same-origin snapshot in `public/data/tle/` first.

## Coding conventions

- TypeScript everywhere, with `strict` on. Don't use `any` in `src/engine/`.
- Inside `src/engine/`: SI units, linear values, radians. dB and degrees only at the edges. Names carry units when ambiguous: `freqHz`, `rangeM`, `eirpDbw`, `gainDbi`, `elRad`.
- Every engine function gets a test (`foo.test.ts` next to `foo.ts`) against a textbook value from `docs/PHYSICS.md`.
- UI imports physics from `src/engine/`; never put formulas in components.
- Keep the first page load light: lazy-load Plotly and the globe with `import()`.

## Session ritual

- **Start:** read `docs/PROGRESS.md`, run `npm install && npm test`.
- **During:** tick checkboxes in `docs/PLAN.md` as items are done.
- **End:** add a dated entry at the top of `docs/PROGRESS.md` covering what changed, what's next, and any blockers. Record new decisions in `docs/DECISIONS.md`.
