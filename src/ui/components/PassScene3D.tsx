// Stylized 3D pass animation (three.js, lazy-loaded): Earth, the satellite and its pass track, and an
// OVERSIZED antenna at the ground station with its radiation lobe aimed at the satellite.
// Geometry only; all physics (positions, look angles, lobe shapes, phases) comes from the engine.
import type * as T from 'three'
import type { OrbitControls as OrbitControlsT } from 'three/examples/jsm/controls/OrbitControls.js'
import { useEffect, useRef, useState } from 'react'
import type { PassFrame } from '../../engine/steering'
import { phaseRgb } from '../format'

export interface LobeGrid {
  x: number[][]
  y: number[][]
  z: number[][]
}

export interface PassSceneProps {
  observer: { latDeg: number; lonDeg: number }
  frames: PassFrame[]
  frameIndex: number
  mode: 'dish' | 'array'
  /** Dish lobe in its own frame (z = boresight), radius normalized to 1 at the peak. */
  dishLobe: LobeGrid
  /** Array lobe for the current frame in the panel frame (z = up). */
  arrayLobe: LobeGrid
  arrayPhases: number[][]
  /** Dish az/el command, or null to park (pointing up). */
  dishAim: { azRad: number; elRad: number } | null
  status: 'tracking' | 'beyond-scan' | 'below-horizon'
  height?: number
}

type ThreeModule = typeof import('three')

const EARTH_RADIUS_M = 6_371_000
/** Antenna drawn ~200 km across so it is visible next to the planet. */
const ANTENNA_SCALE = 0.032
/** Lobe length in Earth radii (~1300 km), long enough to point at LEO satellites. */
const LOBE_LENGTH = 0.2
/** Height of the antenna pivot (dish az/el centre, array panel) above ground, in antenna units. */
const PIVOT = 0.75

/**
 * Satellite position placed at its true az/el/range measured from the antenna pivot (local ENU
 * frame of the station). Because the antenna is drawn oversized, placing the satellite by its
 * ground track instead would leave the lobe visibly mis-aimed (parallax); this way the aim is exact
 * and the satellite moves by at most the antenna's drawn height (~150 km).
 */
function satLocal(THREE: ThreeModule, azRad: number, elRad: number, rangeM: number): T.Vector3 {
  const d = rangeM / EARTH_RADIUS_M
  return new THREE.Vector3(
    d * Math.sin(azRad) * Math.cos(elRad),
    d * Math.cos(azRad) * Math.cos(elRad),
    PIVOT * ANTENNA_SCALE + d * Math.sin(elRad),
  )
}

/** Lat/lon (deg) and radius → scene position. Matches three-globe's texture convention. */
function latLonToVec(THREE: ThreeModule, latDeg: number, lonDeg: number, r: number): T.Vector3 {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  return new THREE.Vector3(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon))
}

function lobeGeometry(THREE: ThreeModule, g: LobeGrid): T.BufferGeometry {
  const nT = g.x.length
  const nP = g.x[0]?.length ?? 0
  const pos = new Float32Array(nT * nP * 3)
  const col = new Float32Array(nT * nP * 3)
  const low = new THREE.Color('#1d3b8b')
  const high = new THREE.Color('#ffd84d')
  const c = new THREE.Color()
  for (let i = 0; i < nT; i++) {
    for (let j = 0; j < nP; j++) {
      const k = (i * nP + j) * 3
      const x = g.x[i][j]
      const y = g.y[i][j]
      const z = g.z[i][j]
      pos[k] = x
      pos[k + 1] = y
      pos[k + 2] = z
      c.copy(low).lerp(high, Math.min(1, Math.hypot(x, y, z)))
      col[k] = c.r
      col[k + 1] = c.g
      col[k + 2] = c.b
    }
  }
  const idx: number[] = []
  for (let i = 0; i < nT - 1; i++) {
    for (let j = 0; j < nP - 1; j++) {
      const a = i * nP + j
      const b = (i + 1) * nP + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

interface SceneRefs {
  THREE: ThreeModule
  renderer: T.WebGLRenderer
  scene: T.Scene
  camera: T.PerspectiveCamera
  controls: OrbitControlsT
  station: T.Vector3
  up: T.Vector3
  north: T.Vector3
  root: T.Group
  sat: T.Mesh
  /** One line per continuous track (beam-hop: one per serving satellite). */
  tracks: T.Group
  los: T.Line
  dishGroup: T.Group
  azGroup: T.Group
  elGroup: T.Group
  dishLobe: T.Mesh
  arrayGroup: T.Group
  arrayLobe: T.Mesh
  panelTexture: T.DataTexture | null
  panelMaterial: T.MeshPhongMaterial
  frame: number
  ro: ResizeObserver
}

export function PassScene3D(props: PassSceneProps) {
  const { observer, frames, frameIndex, mode, dishLobe, arrayLobe, arrayPhases, dishAim, status, height = 480 } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const refs = useRef<SceneRefs | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  // ---- Build the scene once per observer ------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return
    Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')])
      .then(([THREE, { OrbitControls }]) => {
        if (cancelled) return
        const width = host.clientWidth || 600
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height)
        host.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#05070d')
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 200)
        scene.add(new THREE.AmbientLight(0xffffff, 0.55))
        const sun = new THREE.DirectionalLight(0xffffff, 1.4)
        sun.position.set(5, 3, 5)
        scene.add(sun)

        // Earth and a thin atmosphere halo.
        const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}img/earth-blue-marble.jpg`)
        tex.colorSpace = THREE.SRGBColorSpace
        const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshPhongMaterial({ map: tex, shininess: 8 }))
        earth.rotation.y = -Math.PI / 2
        scene.add(earth)
        scene.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(1.015, 64, 48),
            new THREE.MeshBasicMaterial({ color: '#4ba3ff', transparent: true, opacity: 0.12, side: THREE.BackSide }),
          ),
        )

        // Station frame (east, north, up).
        const station = latLonToVec(THREE, observer.latDeg, observer.lonDeg, 1)
        const up = station.clone().normalize()
        const lon = (observer.lonDeg * Math.PI) / 180
        const lat = (observer.latDeg * Math.PI) / 180
        const east = new THREE.Vector3(Math.cos(lon), 0, -Math.sin(lon)).normalize()
        const north = new THREE.Vector3(-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon)).normalize()
        const root = new THREE.Group()
        root.position.copy(station)
        root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, up))
        scene.add(root)

        // Local horizon plane.
        const horizon = new THREE.Mesh(
          new THREE.CircleGeometry(0.42, 64),
          new THREE.MeshBasicMaterial({ color: '#7ee787', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
        )
        horizon.position.z = 0.002
        root.add(horizon)
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(
            Array.from({ length: 96 }, (_, i) => new THREE.Vector3(0.42 * Math.cos((i / 96) * 2 * Math.PI), 0.42 * Math.sin((i / 96) * 2 * Math.PI), 0.003)),
          ),
          new THREE.LineBasicMaterial({ color: '#7ee787', transparent: true, opacity: 0.5 }),
        )
        root.add(ring)

        const metal = new THREE.MeshPhongMaterial({ color: '#d0d7de', shininess: 60, side: THREE.DoubleSide })
        const dark = new THREE.MeshPhongMaterial({ color: '#57606a' })
        const lobeMaterial = () =>
          new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, shininess: 10 })

        // Dish on an az/el mount. Inside elGroup the boresight is +y.
        const dishGroup = new THREE.Group()
        dishGroup.scale.setScalar(ANTENNA_SCALE)
        root.add(dishGroup)
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, PIVOT - 0.05, 16), dark)
        pedestal.rotation.x = Math.PI / 2
        pedestal.position.z = (PIVOT - 0.05) / 2
        dishGroup.add(pedestal)
        const azGroup = new THREE.Group()
        azGroup.position.z = PIVOT
        dishGroup.add(azGroup)
        const elGroup = new THREE.Group()
        azGroup.add(elGroup)
        const f = 0.32
        const profile = Array.from({ length: 24 }, (_, i) => {
          const r = (0.7 * i) / 23
          return new THREE.Vector2(r, (r * r) / (4 * f))
        })
        elGroup.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), metal))
        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, f, 8), dark)
        boom.position.y = f / 2
        elGroup.add(boom)
        const feed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), dark)
        feed.position.y = f
        elGroup.add(feed)
        const dishLobeMesh = new THREE.Mesh(new THREE.BufferGeometry(), lobeMaterial())
        dishLobeMesh.rotation.x = -Math.PI / 2 // lobe frame z (boresight) → +y
        dishLobeMesh.scale.setScalar(LOBE_LENGTH / ANTENNA_SCALE)
        elGroup.add(dishLobeMesh)

        // Flat phased array facing up; its top face shows the element phases.
        const arrayGroup = new THREE.Group()
        arrayGroup.scale.setScalar(ANTENNA_SCALE)
        root.add(arrayGroup)
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, PIVOT - 0.03, 12), dark)
        stand.rotation.x = Math.PI / 2
        stand.position.z = (PIVOT - 0.03) / 2
        arrayGroup.add(stand)
        const panelMaterial = new THREE.MeshPhongMaterial({ color: '#ffffff' })
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 0.06), [dark, dark, dark, dark, panelMaterial, dark])
        panel.position.z = PIVOT - 0.03
        arrayGroup.add(panel)
        const arrayLobeMesh = new THREE.Mesh(new THREE.BufferGeometry(), lobeMaterial())
        arrayLobeMesh.position.z = PIVOT
        arrayLobeMesh.scale.setScalar(LOBE_LENGTH / ANTENNA_SCALE)
        arrayGroup.add(arrayLobeMesh)

        // Satellite, pass track and line of sight.
        const sat = new THREE.Mesh(new THREE.SphereGeometry(0.005, 20, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
        scene.add(sat)
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.011, 20, 16),
          new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.35, depthWrite: false }),
        )
        sat.add(halo)
        const tracks = new THREE.Group()
        scene.add(tracks)
        const los = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#3fb950' }))
        scene.add(los)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.minDistance = 0.05
        controls.maxDistance = 60

        const ro = new ResizeObserver(() => {
          const w = host.clientWidth
          if (!w) return
          renderer.setSize(w, height)
          camera.aspect = w / height
          camera.updateProjectionMatrix()
        })
        ro.observe(host)

        const r: SceneRefs = {
          THREE,
          renderer,
          scene,
          camera,
          controls,
          station,
          up,
          north,
          root,
          sat,
          tracks,
          los,
          dishGroup,
          azGroup,
          elGroup,
          dishLobe: dishLobeMesh,
          arrayGroup,
          arrayLobe: arrayLobeMesh,
          panelTexture: null,
          panelMaterial,
          frame: 0,
          ro,
        }
        const loop = () => {
          r.frame = requestAnimationFrame(loop)
          controls.update()
          renderer.render(scene, camera)
        }
        loop()
        refs.current = r
        // Dev-only handle for debugging the scene from the console.
        if (import.meta.env.DEV) (window as unknown as { __passScene?: SceneRefs }).__passScene = r
        setState('ready')
      })
      .catch(() => !cancelled && setState('error'))

    return () => {
      cancelled = true
      const r = refs.current
      refs.current = null
      if (!r) return
      cancelAnimationFrame(r.frame)
      r.ro.disconnect()
      r.controls.dispose()
      r.scene.traverse((o) => {
        const m = o as T.Mesh
        m.geometry?.dispose()
        const mat = m.material as T.Material | T.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      r.panelTexture?.dispose()
      r.renderer.dispose()
      r.renderer.domElement.remove()
    }
  }, [observer.latDeg, observer.lonDeg, height])

  // ---- Pass track + camera framing when the pass changes ---------------------------------------
  useEffect(() => {
    const r = refs.current
    if (!r || frames.length === 0) return
    const { THREE } = r
    r.root.updateMatrixWorld(true)
    // One line per continuous track; a beam-hop hand-over starts a new one (no line between satellites).
    for (const child of [...r.tracks.children]) {
      const l = child as T.Line
      l.geometry.dispose()
      ;(l.material as T.Material).dispose()
      r.tracks.remove(l)
    }
    const groups = new Map<number, PassFrame[]>()
    for (const fr of frames) {
      if (fr.hidden) continue
      const id = fr.trackId ?? 0
      const g = groups.get(id)
      if (g) g.push(fr)
      else groups.set(id, [fr])
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue
      const pts = group.map((fr) => r.root.localToWorld(satLocal(THREE, fr.azRad, fr.elRad, fr.rangeM)))
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const col = new Float32Array(group.length * 3)
      group.forEach((fr, i) => {
        const c = fr.visible ? new THREE.Color('#58a6ff') : new THREE.Color('#3d444d')
        col.set([c.r, c.g, c.b], i * 3)
      })
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      r.tracks.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true })))
    }

    // Look at the station from above and to the south (the pass usually fills the view).
    // LEO action happens within ~0.1–0.3 Earth radii of the station; GEO is ~6 radii out.
    const far = Math.min(Math.max(...frames.map((fr) => fr.altM)) / EARTH_RADIUS_M, 6)
    const target = r.station.clone().addScaledVector(r.up, 0.03 + far * 0.3)
    const dist = 0.3 + far * 1.3
    r.camera.position.copy(target).addScaledVector(r.up, dist * 0.75).addScaledVector(r.north, -dist * 0.75)
    r.camera.up.copy(r.up)
    r.controls.target.copy(target)
    r.controls.update()
  }, [frames, state])

  // ---- Per-frame updates -------------------------------------------------------------------------
  useEffect(() => {
    const r = refs.current
    const fr = frames[frameIndex]
    if (!r || !fr) return
    const { THREE } = r
    r.root.updateMatrixWorld(true)
    const satPos = r.root.localToWorld(satLocal(THREE, fr.azRad, fr.elRad, fr.rangeM))
    r.sat.position.copy(satPos)
    r.sat.visible = !fr.hidden

    r.dishGroup.visible = mode === 'dish'
    r.arrayGroup.visible = mode === 'array'
    const tracking = status !== 'below-horizon'

    // Dish: azimuth about local up (clockwise from north), then elevation.
    const aim = dishAim ?? { azRad: 0, elRad: Math.PI / 2 }
    r.azGroup.rotation.z = -aim.azRad
    r.elGroup.rotation.x = aim.elRad
    ;(r.dishLobe.material as T.MeshPhongMaterial).opacity = tracking ? 0.55 : 0.12
    ;(r.arrayLobe.material as T.MeshPhongMaterial).opacity = status === 'tracking' ? 0.55 : status === 'beyond-scan' ? 0.4 : 0.12

    // Line of sight from the antenna to the satellite.
    const from = r.root.localToWorld(new THREE.Vector3(0, 0, PIVOT * ANTENNA_SCALE))
    r.los.geometry.dispose()
    r.los.geometry = new THREE.BufferGeometry().setFromPoints([from, satPos])
    r.los.visible = fr.visible && !fr.hidden
    ;(r.los.material as T.LineBasicMaterial).color.set(status === 'tracking' ? '#3fb950' : '#f0883e')
  }, [frames, frameIndex, mode, dishAim, status, state])

  useEffect(() => {
    const r = refs.current
    if (!r) return
    r.dishLobe.geometry.dispose()
    r.dishLobe.geometry = lobeGeometry(r.THREE, dishLobe)
  }, [dishLobe, state])

  useEffect(() => {
    const r = refs.current
    if (!r) return
    r.arrayLobe.geometry.dispose()
    r.arrayLobe.geometry = lobeGeometry(r.THREE, arrayLobe)
  }, [arrayLobe, state])

  useEffect(() => {
    const r = refs.current
    if (!r || arrayPhases.length === 0) return
    const { THREE } = r
    const ny = arrayPhases.length
    const nx = arrayPhases[0].length
    const data = new Uint8Array(nx * ny * 4)
    arrayPhases.forEach((row, n) =>
      row.forEach((p, m) => {
        const [cr, cg, cb] = phaseRgb((p * 180) / Math.PI)
        data.set([cr, cg, cb, 255], (n * nx + m) * 4)
      }),
    )
    let tex = r.panelTexture
    if (!tex || tex.image.width !== nx || tex.image.height !== ny) {
      tex?.dispose()
      tex = new THREE.DataTexture(data, nx, ny, THREE.RGBAFormat)
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      tex.colorSpace = THREE.SRGBColorSpace
      r.panelTexture = tex
      r.panelMaterial.map = tex
      r.panelMaterial.needsUpdate = true
    } else {
      ;(tex.image.data as Uint8Array).set(data)
    }
    tex.needsUpdate = true
  }, [arrayPhases, state])

  return (
    <div className="scene3d" style={{ minHeight: height }}>
      {state !== 'ready' && (
        <p className="muted plot-status">{state === 'loading' ? 'Loading 3D scene…' : 'The 3D scene failed to load (WebGL needed).'}</p>
      )}
      <div ref={hostRef} />
    </div>
  )
}
