// 3D globe (globe.gl, lazy-loaded) with the observer, satellites and the selected orbit.
import type { GlobeInstance } from 'globe.gl'
import { useEffect, useRef, useState } from 'react'
import type { OrbitClass } from '../../engine/orbit'
import { cssVar, ORBIT_CLASSES, orbitColorVar } from '../format'

const EARTH_RADIUS_M = 6_371_000

export interface GlobeSat {
  latDeg: number
  lonDeg: number
  altM: number
  orbitClass: OrbitClass
}

interface Props {
  observer: { latDeg: number; lonDeg: number }
  sats: GlobeSat[]
  selected: GlobeSat | null
  /** One orbit of the selected satellite. */
  orbit: { latDeg: number; lonDeg: number; altM: number }[]
}

type P = { lat: number; lng: number; alt: number }
type ParticleSet = { color: string; pts: P[] }

const HEIGHT = 440

export function GlobeView({ observer, sats, selected, orbit }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Create the globe once.
  useEffect(() => {
    let cancelled = false
    let globe: GlobeInstance | null = null
    let resize: ResizeObserver | null = null
    const el = ref.current
    import('globe.gl')
      .then(({ default: Globe }) => {
        if (cancelled || !el) return
        globe = new Globe(el)
          .globeImageUrl(`${import.meta.env.BASE_URL}img/earth-blue-marble.jpg`)
          .backgroundColor('rgba(0,0,0,0)')
          .width(el.clientWidth)
          .height(HEIGHT)
          .particlesList((d) => (d as ParticleSet).pts)
          .particleLat((d) => (d as P).lat)
          .particleLng((d) => (d as P).lng)
          .particleAltitude((d) => (d as P).alt)
          .particlesColor((d) => (d as ParticleSet).color)
          .particlesSize(4)
          .particlesSizeAttenuation(false)
          .pathPoints((d) => d as P[])
          .pathPointLat((p) => (p as P).lat)
          .pathPointLng((p) => (p as P).lng)
          .pathPointAlt((p) => (p as P).alt)
          .pathStroke(1.5)
          .pathTransitionDuration(0)
          .pointLat((d) => (d as P).lat)
          .pointLng((d) => (d as P).lng)
          .pointAltitude(0.02)
          .pointRadius(0.6)
          .pointsTransitionDuration(0)
          .pointOfView({ lat: observer.latDeg, lng: observer.lonDeg, altitude: 2.6 })
        globeRef.current = globe
        resize = new ResizeObserver(() => globe?.width(el.clientWidth))
        resize.observe(el)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
      resize?.disconnect()
      globe?._destructor()
      globeRef.current = null
      if (el) el.innerHTML = ''
    }
    // The initial point of view only; later moves are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update layers whenever the data changes.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const toP = (s: { latDeg: number; lonDeg: number; altM: number }): P => ({
      lat: s.latDeg,
      lng: s.lonDeg,
      alt: s.altM / EARTH_RADIUS_M,
    })
    const sets: ParticleSet[] = ORBIT_CLASSES.map((cls) => ({
      color: cssVar(orbitColorVar(cls)),
      pts: sats.filter((s) => s.orbitClass === cls).map(toP),
    }))
    if (selected) sets.push({ color: cssVar('--bad'), pts: [toP(selected)] })
    g.particlesData(sets)
    g.pathsData(orbit.length > 1 ? [orbit.map(toP)] : []).pathColor(() => cssVar('--bad'))
    g.pointsData([{ lat: observer.latDeg, lng: observer.lonDeg, alt: 0 }]).pointColor(() => '#ffd33d')
  }, [sats, selected, orbit, observer, status])

  return (
    <div className="plot globe" style={{ minHeight: HEIGHT }}>
      {status !== 'ready' && (
        <p className="muted plot-status">{status === 'loading' ? 'Loading globe…' : 'The 3D globe failed to load (WebGL needed).'}</p>
      )}
      <div ref={ref} />
    </div>
  )
}
