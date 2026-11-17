# data/

Browser-side loaders. This is the only place (besides UI) allowed to `fetch`.

- `tle.ts` (done): `TLE_GROUPS`, `loadTleIndex()`, `loadTleGroup(group)` read `./data/tle/*.json` (the same-origin CelesTrak snapshot). `loadCatalog(groups)` turns them into `CatalogEntry` objects (satrec, orbit class, epoch), merging satellites listed in several groups.
- `loadSatellites()` (Phase 3) reads `./data/satellites.json` (hand-curated RF specs).
- `loadTransmitters(noradId)` (Phase 3, optional) queries the SatNOGS DB API, falling back to `satellites.json`.

Always build URLs from `import.meta.env.BASE_URL` so they work under the GitHub Pages sub-path.
