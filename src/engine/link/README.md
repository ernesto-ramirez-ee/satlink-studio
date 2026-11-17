# engine/link/ — Phase 3 (done)

Pure link-budget code; depends on `antennas/` and `orbit/` only.

- `budget.ts`: `linkBudget(inputs)` → FSPL, G/T, C/N0, Eb/N0, margin
- `propagation.ts`: atmospheric loss, galactic/atmospheric/receiver noise, `systemTempK`, `polLossDb`, `pointingLossDb`
- `receive.ts`: `GROUND_SETUPS` (mount, complexity rank, assumed ground noise and pointing error), `receiveContext`, `gainTowardDbi(ctx, az, el)`, `practicality(model, params, freq)`
- `passMargin.ts`: `marginTimeline(satrec, observer, from, to, downlink, antennas, nf)` → margin vs. time per antenna; `recommend(timeline)` → best, runner-up, simpler failures, reason; `eirpAt`, `failureIntervals`

Formulas, assumptions and the worked example are in `docs/PHYSICS.md`; ranking and limits are in D-018.
