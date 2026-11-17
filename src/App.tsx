import { useState } from 'react'
import { getAntenna, type AntennaId } from './engine/antennas'
import { useSimClock } from './ui/clock'
import { ClockControls } from './ui/components/ClockControls'
import { GroundStationPanel } from './ui/components/GroundStationPanel'
import { useTleIndex } from './ui/hooks'
import {
  DEFAULT_NOISE_FIGURE_DB,
  DEFAULT_NORAD_ID,
  initialAntennaSettings,
  loadObserver,
  saveObserver,
  type ObserverState,
} from './ui/state'
import { AntennaLab } from './ui/tabs/AntennaLab'
import { LinkCheck } from './ui/tabs/LinkCheck'
import { LiveSteering } from './ui/tabs/LiveSteering'
import { SkyView } from './ui/tabs/SkyView'

const TABS = [
  { id: 'lab', label: 'Antenna Lab' },
  { id: 'sky', label: 'Sky View' },
  { id: 'link', label: 'Link Check' },
  { id: 'steer', label: 'Live Steering' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('lab')
  // Shared across tabs (docs/ARCHITECTURE.md "Shared state").
  const [antennaId, setAntennaId] = useState<AntennaId>('dish')
  const [antennaSettings, setAntennaSettings] = useState(initialAntennaSettings)
  const [observer, setObserver] = useState<ObserverState>(loadObserver)
  const [selectedNoradId, setSelectedNoradId] = useState(DEFAULT_NORAD_ID)
  const [noiseFigureDb, setNoiseFigureDb] = useState(DEFAULT_NOISE_FIGURE_DB)
  const clock = useSimClock()
  const now = clock.now
  const tleIndex = useTleIndex()

  const antenna = getAntenna(antennaId)
  const settings = antennaSettings[antennaId]

  const changeObserver = (o: ObserverState) => {
    setObserver(o)
    saveObserver(o)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>SatLink Studio</h1>
        <nav role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              className={t.id === tab ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <ClockControls clock={clock} />
      </header>
      <div className="app-body">
        <GroundStationPanel
          observer={observer}
          onObserverChange={changeObserver}
          antennaLabel={antenna.label}
          antennaGainDbi={antenna.peakGainDbi(settings.params, settings.freqHz)}
          now={now}
          clockLive={clock.live}
          tleFetchedAt={tleIndex === null ? undefined : tleIndex.fetchedAt}
          noiseFigureDb={noiseFigureDb}
          onNoiseFigureChange={setNoiseFigureDb}
        />
        <main className="tab-panel" role="tabpanel">
          {tab === 'lab' && (
            <AntennaLab
              antennaId={antennaId}
              settings={settings}
              onSelect={setAntennaId}
              onChange={(s) => setAntennaSettings((all) => ({ ...all, [antennaId]: s }))}
            />
          )}
          {tab === 'sky' && (
            <SkyView observer={observer} now={now} selectedId={selectedNoradId} onSelect={setSelectedNoradId} />
          )}
          {tab === 'link' && (
            <LinkCheck
              observer={observer}
              now={now}
              selectedNoradId={selectedNoradId}
              onSelectSatellite={setSelectedNoradId}
              yourAntennaId={antennaId}
              antennaSettings={antennaSettings}
              noiseFigureDb={noiseFigureDb}
            />
          )}
          {tab === 'steer' && (
            <LiveSteering
              observer={observer}
              now={now}
              selectedNoradId={selectedNoradId}
              onSelectSatellite={setSelectedNoradId}
              antennaSettings={antennaSettings}
            />
          )}
        </main>
      </div>
    </div>
  )
}
