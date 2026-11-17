# Physics and models

Everything is closed-form or a short numerical sum. Each model has a test against the reference value listed here.

## Conventions

- θ is measured from the antenna boresight (+z); φ is the angle around it. Radians inside the engine.
- Gains are linear inside the engine; `*Dbi` names are in dB.
- Topocentric frame: ENU (east, north, up). Azimuth is clockwise from north; elevation is measured from the horizon.

## Antennas (Phase 1)

| Antenna | Pattern model | Peak gain (test reference) | Parameters |
| --- | --- | --- | --- |
| Half-wave dipole | E(θ) = cos(π/2·cosθ)/sinθ (axis along z) | 2.15 dBi | freq, orientation |
| Quarter-wave monopole | Dipole pattern, upper half-space only | 5.15 dBi (ideal ground) | freq |
| QFH / turnstile | Two crossed dipoles fed at 90°, RHCP: (1 + cos²θ)/2, back hemisphere × front-to-back ratio k (assumed 10 dB) → D = 3/(1 + k) | ~2–5 dBic (4.36 at k = 10 dB) | freq, F/B ratio |
| Yagi-Uda | Hansen-Woodyard end-fire array factor × dipole element; gain log-interpolated from the NBS TN 688 table vs. boom length | ~7–15 dBi | elements, boom length |
| Axial-mode helix | Kraus: G ≈ 15·C²·N·S (C, S in λ units); cosⁿθ pattern with HPBW 52°/(C√(NS)) | 10–16 dBic | turns, spacing, circumference |
| Patch | cosⁿθ over the front hemisphere, D = 2(n + 1); n = 1.5 + 1/εr (assumed trend) | ~6–8 dBi | freq, εr |
| Parabolic dish | Airy: E(u) = 2J₁(u)/u (uniform) or 8J₂(u)/u² ((1 − r²) taper), u = (πD/λ)·sinθ; G = η(πD/λ)² | 1 m at 12 GHz, η = 0.6: ≈ 39.8 dBi | D, η, illumination, freq |
| Planar phased array | AF × cos^1.2θ element; gain = numerical directivity | ≈ 4πA/λ² at broadside (A = Nx·dx·Ny·dy); ≈ N·G_element within 2 dB | Nx, Ny, dx/λ, dy/λ, θ₀, φ₀, taper |

Useful checks:

- Dish HPBW ≈ 70·λ/D degrees for a typical tapered feed (72.8 for the (1 − r²) taper); 58.9·λ/D for uniform illumination.
- First sidelobe: −17.6 dB for a uniformly illuminated aperture, −24.6 dB for the (1 − r²) taper.
- Half-wave dipole HPBW: 78°.
- Grating lobes appear when d/λ ≥ 1/(1 + |sin θ₀|).
- N·G_element overstates the array gain because an isolated element's gain is higher than its embedded gain in a λ/2 grid (D-009).

## Orbits (Phase 2)

SGP4 from OMM elements via `satellite.js`: ECI (TEME) → ECEF → ENU at the observer. The outputs are az, el, slant range, and range rate. A pass is the interval with el > 0, and the pass list uses a configurable minimum elevation.

Known limit: element sets are accurate to ~1 km near epoch, and accuracy degrades over days. Show the element age in the UI.

Implementation (`src/engine/orbit/`):

- `geodesy.ts`: WGS-84 geodetic → ECEF, ECEF → ENU, az/el/range. Written independently of satellite.js.
- `sgp4.ts`: TEME → ECEF by GMST rotation; Earth-relative velocity v = R·v_TEME − ω⊕ × r (ω⊕ = 7.292115×10⁻⁵ rad/s); range rate = (r_sat − r_obs)·v / |r_sat − r_obs|.
- `passes.ts`: 30 s elevation scan, horizon crossings refined by bisection (12 steps), culmination by golden-section search. A satellite up for the whole window (GEO) is one pass clipped at both ends.
- Orbit classes: LEO if n ≥ 11.25 rev/day (period ≤ 128 min), GEO if 0.9 < n < 1.1 rev/day, HEO if e ≥ 0.25, otherwise MEO.

Test references: Vallado's SGP4 verification case 00005 at epoch; WGS-84 polar radius 6 356 752.314 m; GOES-19 from Notre Dame ≈ 40.5° el / 163.7° az (hand calculation); range rate vs. finite difference of range. Independent check: ISS passes for Notre Dame vs. Heavens-Above, Nov 10–12 2026: all 17 culmination times within 1 s and max elevations within its 1° rounding.

## Link budget (Phase 3)

```
C/N0 [dBHz] = EIRP [dBW] − L_fs − L_atm − L_pol − L_point + G/T [dB/K] + 228.6
Eb/N0 [dB]  = C/N0 − 10·log10(Rb)
Margin [dB] = Eb/N0 − (Eb/N0)_required
L_fs [dB]   = 20·log10(4π·d·f / c)
G/T         = G_rx(θ, φ toward satellite) − 10·log10(T_sys)
```

- The receive gain is the pattern evaluated at the satellite's actual direction in the antenna frame. Fixed antennas therefore lose gain as the satellite moves.
- Atmospheric loss (simplified): L_atm = L_zenith(f) / sin(el), clamped below 5° elevation. Zenith values come from a small table per band. ITU-R P.618 rain fade is a stretch goal.
- Polarization: circular ↔ circular (same sense) 0 dB; linear ↔ circular 3 dB; linear ↔ linear uses the mismatch angle (Faraday rotation is not modelled at VHF/UHF, so assume 3 dB average).
- Test reference: GEO at 35 786 km and 12 GHz gives FSPL ≈ 205.1 dB (already in `units.test.ts`).

**Recommendation rule:** among antennas that are practical for the band, choose the one with the smallest size or complexity that keeps margin ≥ 3 dB for the whole pass above 10° elevation. Show the reason string and the runner-up.

Implementation (`src/engine/link/`):

- **Receive gain toward the satellite.** Fixed antennas face up, so θ = 90° − el and φ = 90° − az (x = east, y = north). Rotator-mounted (Yagi, helix) and tracked (dish) antennas use peak − 12·(ε/θ₃dB)² with an assumed pointing error ε of 5° and 0.2°. The phased array steers electronically up to 60° from zenith: peak − 12·log10(cos θ), and beyond 60° the satellite also falls off the broadened beam. Ranking and practicality limits: D-018.
- **Noise.** T_sys = 60·λ^2.55 K (galactic) + 290·(1 − 10^(−L_zen/10)) + T_ground (assumed per antenna) + 290·(10^(NF/10) − 1). See D-019.
- **Zenith gaseous loss (assumed, ITU-R P.676 order of magnitude):** 0.03 dB below 1 GHz, 0.04 to 3 GHz, 0.05 to 8 GHz, 0.15 to 15 GHz, 0.5 to 30 GHz.
- **Pointing loss:** 12·(ε/θ₃dB)² dB, i.e. 3 dB at ε = θ₃dB/2, capped at 30 dB.
- **EIRP vs. elevation:** optional per downlink (NOAA-20's isoflux antenna), otherwise constant.

**Worked example** (`budget.test.ts`): Ku GEO TV, EIRP 50 dBW, range 38 000 km, 12 GHz, 1 m dish 39.8 dBi, T_sys 150 K, L_atm 0.3 dB, L_point 0.5 dB, 30 Mbit/s, required Eb/N0 6 dB.

| Term | Value |
| --- | --- |
| L_fs = 20·log10(4π·3.8×10⁷·1.2×10¹⁰ / 2.998×10⁸) | 205.63 dB |
| G/T = 39.8 − 10·log10(150) | 18.04 dB/K |
| C/N0 = 50 − 205.63 − 0.3 − 0.5 + 18.04 + 228.6 | 90.21 dBHz |
| Eb/N0 = 90.21 − 10·log10(3×10⁷) | 15.44 dB |
| Margin = 15.44 − 6 | 9.44 dB |

Cross-check in the app: GOES-18 HRIT from Notre Dame (el ≈ 20°) with a 1 m dish gives a 7.5 dB margin; a hand calculation with the same inputs gives 7.6 dB.

## Steering (Phase 4)

- Doppler: Δf = −(ṙ / c)·f
- Dish: az/el command plus slew rates. Warn when the predicted max elevation is > 85° (az/el keyhole: the azimuth rate blows up).
- Phased array element (m, n) phase, with u = sinθ·cosφ and v = sinθ·sinφ:

  φ_mn = −(2π/λ)·(m·dx·u + n·dy·v) mod 2π

  Optional quantization to 2^bits levels. Scan loss ≈ cos^1.2(θ).
- Beam hop: serve the highest-elevation visible satellite; hand over when the current one drops below 25° and a better one exists.

Implementation (`src/engine/steering/`) and test references:

- `dish.ts`: `dishCommand` (az/el, rates by central difference ±0.5 s, azimuth wrapped), `dopplerShiftHz` (+3.40 kHz at 145.8 MHz for ṙ = −7 km/s), `passPeakRates`, `isKeyholePass` (> 85°; the 87° ISS pass over Notre Dame on Nov 10 needs > 5°/s in azimuth), `tleAngularErrorRad` (1 km at 500 km ≈ 0.11°).
- `phases.ts`: `elementPhases` (λ/2, 30° → 0°, 270°, 180°, 90°), `quantizePhase`, `arrayGainFromPhases` (|Σ|²/N², exactly 1 toward the steered direction), `quantizationLoss` = [sin(π/2^B)/(π/2^B)]² (1/2/3 bits: −3.92/−0.91/−0.22 dB; a real 3-bit 16×16 array agrees within 0.5 dB), `scanLossDb`, `steeringFromAzEl` (θ = 90° − el, φ = 90° − az).
- Element weights (`elementWeights`): w_mn = a_m·a_n·e^{jφ_mn}, with the same separable taper as the array model (uniform, or cosine a_k = sin(π(k + ½)/N)), normalized to a peak amplitude of 1. Test: λ/2 spacing steered 30° in x gives element (1, 0) w = −j (270°); Σ w·e^{jk·r·û} peaks at the steering angle.
- `beamhop.ts`: `beamHopSchedule` (serve the highest satellite; hand over below 25° to the highest available; outage if none), `sampleAt`. Tested on a synthetic train of ISS-orbit copies: hand-overs only below 25°, always to the best candidate.

## Simplifications to state in the UI

Analytic patterns (no mutual coupling, no feed blockage); receive-only; simplified atmosphere; assumed EIRP values flagged; TLE accuracy limits pointing for very narrow beams.
