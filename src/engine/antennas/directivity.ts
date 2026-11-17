// Numerical directivity: D = 4π · F_max / ∮ F dΩ, using the midpoint rule over θ ∈ (0, π), φ ∈ [0, 2π).

export interface PatternStats {
  /** Largest sampled value of the (unnormalized) power pattern. */
  fMax: number
  /** ∮ F(θ, φ) sinθ dθ dφ */
  integral: number
  /** Linear directivity. */
  directivity: number
}

export type PowerPattern = (thetaRad: number, phiRad: number) => number

/**
 * Integrates a power pattern over the sphere.
 * `hints` are directions where the peak is known to lie (they are evaluated too, so a peak
 * between grid points is not missed).
 */
export function patternStats(
  pattern: PowerPattern,
  nTheta = 360,
  nPhi = 180,
  hints: [number, number][] = [],
): PatternStats {
  const dTheta = Math.PI / nTheta
  const dPhi = (2 * Math.PI) / nPhi
  let integral = 0
  let fMax = 0
  for (let i = 0; i < nTheta; i++) {
    const theta = (i + 0.5) * dTheta
    const sinT = Math.sin(theta)
    let ring = 0
    for (let j = 0; j < nPhi; j++) {
      const f = pattern(theta, j * dPhi)
      ring += f
      if (f > fMax) fMax = f
    }
    integral += ring * sinT
  }
  integral *= dTheta * dPhi
  for (const [t, p] of hints) fMax = Math.max(fMax, pattern(t, p))
  return { fMax, integral, directivity: (4 * Math.PI * fMax) / integral }
}
