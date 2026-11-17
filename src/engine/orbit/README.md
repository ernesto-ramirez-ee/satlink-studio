# engine/orbit/ — Phase 2 (done)

Wraps `satellite.js` (SGP4). Inputs are OMM JSON records (from `public/data/tle/*.json`) and an observer `{ latRad, lonRad, altM }` (`observerFromDeg()` converts the UI's degrees).

- `geodesy.ts`: `geodeticToEcefM`, `ecefToEnu`, `lookFromEcef` (WGS-84, independent of satellite.js)
- `sgp4.ts`: `satrecFromOmm`, `stateAt(satrec, date)` → ECEF position/velocity + sub-satellite point, `lookAngles(satrec, observer, date)` → `{ azRad, elRad, rangeM, rangeRateMps }`, `epochOf`, `orbitalPeriodS`, `classifyOrbit`
- `passes.ts`: `findPasses(satrec, observer, start, durationS, minElRad)` → `[{ rise, culmination, set, maxElRad, riseAzRad, setAzRad, riseClipped, setClipped }]`, `skyTrack`, `groundTrack`
- `fixtures.ts`: fixed ISS / GOES-19 element sets and the Vallado 00005 case for tests

Validation: ISS passes match Heavens-Above (see docs/PHYSICS.md).
