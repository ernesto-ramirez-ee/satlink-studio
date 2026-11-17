// Header controls for the simulated clock.
import type { SimClock } from '../clock'
import { fmtDayTime } from '../format'

export function ClockControls({ clock }: { clock: SimClock }) {
  return (
    <div className="clock-controls" role="group" aria-label="Simulation clock">
      <span className={`clock-time mono${clock.live ? '' : ' simulated'}`} title={clock.now.toISOString()}>
        {fmtDayTime(clock.now)}
      </span>
      {!clock.live && <span className="badge sim-badge">{clock.playing ? `×${clock.speed}` : 'paused'}</span>}
      <button
        type="button"
        className="button icon"
        onClick={clock.playing ? clock.pause : clock.play}
        aria-label={clock.playing ? 'Pause' : 'Play'}
        title={clock.playing ? 'Pause' : 'Play'}
      >
        {clock.playing ? '❚❚' : '▶'}
      </button>
      <button
        type="button"
        className={`button${clock.speed === 60 ? ' primary' : ''}`}
        onClick={() => clock.setSpeed(clock.speed === 60 ? 1 : 60)}
        aria-pressed={clock.speed === 60}
        title="Run time 60× faster (1 minute per second)"
      >
        ×60
      </button>
      <button type="button" className="button" onClick={clock.goLive} disabled={clock.live} title="Back to real time">
        Now
      </button>
    </div>
  )
}
