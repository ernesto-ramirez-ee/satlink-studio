// Bessel functions of the first kind, J0, J1 and J2.
// Polynomial approximations from Abramowitz & Stegun, Handbook of Mathematical
// Functions, §9.4.1–9.4.6 (absolute error < 1e-7). No dependency needed.

function j0Positive(x: number): number {
  if (x <= 3) {
    const t = (x / 3) ** 2
    return (
      1 +
      t * (-2.2499997 + t * (1.2656208 + t * (-0.3163866 + t * (0.0444479 + t * (-0.0039444 + t * 0.00021)))))
    )
  }
  const z = 3 / x
  const f0 =
    0.79788456 +
    z * (-0.00000077 + z * (-0.0055274 + z * (-0.00009512 + z * (0.00137237 + z * (-0.00072805 + z * 0.00014476)))))
  const th0 =
    x -
    0.78539816 +
    z * (-0.04166397 + z * (-0.00003954 + z * (0.00262573 + z * (-0.00054125 + z * (-0.00029333 + z * 0.00013558)))))
  return (f0 * Math.cos(th0)) / Math.sqrt(x)
}

/** J1(x)/x for x ≥ 0, finite at x = 0 (limit 1/2). */
function j1OverXPositive(x: number): number {
  if (x <= 3) {
    const t = (x / 3) ** 2
    return (
      0.5 +
      t * (-0.56249985 + t * (0.21093573 + t * (-0.03954289 + t * (0.00443319 + t * (-0.00031761 + t * 0.00001109)))))
    )
  }
  const z = 3 / x
  const f1 =
    0.79788456 +
    z * (0.00000156 + z * (0.01659667 + z * (0.00017105 + z * (-0.00249511 + z * (0.00113653 + z * -0.00020033)))))
  const th1 =
    x -
    2.35619449 +
    z * (0.12499612 + z * (0.0000565 + z * (-0.00637879 + z * (0.00074348 + z * (0.00079824 + z * -0.00029166)))))
  return (f1 * Math.cos(th1)) / (x * Math.sqrt(x))
}

export const besselJ0 = (x: number): number => j0Positive(Math.abs(x))

export const besselJ1 = (x: number): number => x * j1OverXPositive(Math.abs(x))

export function besselJ2(x: number): number {
  const ax = Math.abs(x)
  // Series near zero avoids cancellation in 2·J1/x − J0.
  if (ax < 0.5) {
    const x2 = x * x
    return (x2 / 8) * (1 - x2 / 12 + (x2 * x2) / 384)
  }
  return 2 * j1OverXPositive(ax) - j0Positive(ax)
}

/** 2·J1(u)/u, the field of a uniformly lit circular aperture (→ 1 at u = 0). */
export const jinc = (u: number): number => 2 * j1OverXPositive(Math.abs(u))

/** 8·J2(u)/u², the field of a circular aperture with (1 − r²) taper (→ 1 at u = 0). */
export function jinc2(u: number): number {
  const au = Math.abs(u)
  if (au < 0.5) {
    const u2 = u * u
    return 1 - u2 / 12 + (u2 * u2) / 384
  }
  return (8 * besselJ2(au)) / (au * au)
}
