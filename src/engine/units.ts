// Unit helpers shared by every engine module.
// Convention (see AGENTS.md): internal math is SI and linear; dB only at the edges.

export const C = 299_792_458 // speed of light, m/s
export const K_BOLTZMANN = 1.380649e-23 // J/K
export const K_BOLTZMANN_DB = 10 * Math.log10(K_BOLTZMANN) // ≈ -228.6 dBW/K/Hz

export const toDb = (linear: number): number => 10 * Math.log10(linear)
export const fromDb = (db: number): number => 10 ** (db / 10)

export const deg2rad = (deg: number): number => (deg * Math.PI) / 180
export const rad2deg = (rad: number): number => (rad * 180) / Math.PI

/** Wavelength in metres for a frequency in Hz. */
export const wavelength = (freqHz: number): number => C / freqHz

/** Free-space path loss in dB for a distance in metres and a frequency in Hz. */
export const fspl = (distanceM: number, freqHz: number): number =>
  20 * Math.log10((4 * Math.PI * distanceM * freqHz) / C)
