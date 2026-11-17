// Simulated clock shared by every tab (docs/ARCHITECTURE.md: clock = { now, playing, speed }).
// Real time by default; it can be paused or run ×60 for demos.
import { useCallback, useEffect, useState } from 'react'

export type ClockSpeed = 1 | 60

export interface SimClock {
  now: Date
  playing: boolean
  speed: ClockSpeed
  /** True when the clock shows the real time (playing at ×1 with no offset). */
  live: boolean
  play: () => void
  pause: () => void
  setSpeed: (s: ClockSpeed) => void
  /** Back to real time, playing at ×1. */
  goLive: () => void
}

interface Anchor {
  real: number
  sim: number
  playing: boolean
  speed: ClockSpeed
}

const simAt = (a: Anchor, real: number): number => (a.playing ? a.sim + (real - a.real) * a.speed : a.sim)

export function useSimClock(): SimClock {
  const [anchor, setAnchor] = useState<Anchor>(() => ({ real: Date.now(), sim: Date.now(), playing: true, speed: 1 }))
  const [real, setReal] = useState(() => Date.now())

  useEffect(() => {
    if (!anchor.playing) return
    const id = setInterval(() => setReal(Date.now()), anchor.speed === 1 ? 1000 : 250)
    return () => clearInterval(id)
  }, [anchor.playing, anchor.speed])

  // Re-anchor at the current simulated time whenever play state or speed changes.
  const update = useCallback((patch: Partial<Pick<Anchor, 'playing' | 'speed'>>) => {
    const r = Date.now()
    setAnchor((a) => ({ ...a, ...patch, real: r, sim: simAt(a, r) }))
    setReal(r)
  }, [])

  const nowMs = simAt(anchor, real)
  return {
    now: new Date(nowMs),
    playing: anchor.playing,
    speed: anchor.speed,
    live: anchor.playing && anchor.speed === 1 && Math.abs(nowMs - real) < 2000,
    play: () => update({ playing: true }),
    pause: () => update({ playing: false }),
    setSpeed: (speed) => update({ speed }),
    goLive: () => {
      const r = Date.now()
      setAnchor({ real: r, sim: r, playing: true, speed: 1 })
      setReal(r)
    },
  }
}
