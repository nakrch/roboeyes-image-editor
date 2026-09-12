import type { JsonObject, RuntimeAnimationEvent } from '../../../animation'
import type { AnimationPlaybackSession } from '../../editor/animationPlayback'

type LiveTransportBarProps = {
  playback: AnimationPlaybackSession
  canUndo: boolean
  canRedo: boolean
  reducedMotion: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onRestart: () => void
  onPlaybackRateChange: (rate: number) => void
  onTrigger: (action: string, channel: RuntimeAnimationEvent['channel'], payload?: JsonObject) => void
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
  onOpenPresets: () => void
}

function formatTimecode(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const remainder = Math.floor(ms % 1000)
  const secStr = String(seconds).padStart(2, '0')
  const msStr = String(remainder).padStart(3, '0')
  return `${secStr}.${msStr}s`
}

export function LiveTransportBar({
  playback,
  canUndo,
  canRedo,
  reducedMotion,
  onPlay,
  onPause,
  onStop,
  onRestart,
  onPlaybackRateChange,
  onTrigger,
  onUndo,
  onRedo,
  onReset,
  onOpenPresets,
}: LiveTransportBarProps) {
  const isPlaying = playback.clock.status === 'playing'

  return (
    <header className="vb-transport-bar" aria-label="Live Transport & Control Bar">
      {/* Brand & Status */}
      <div className="vb-transport-brand">
        <div className="vb-brand-title">
          <span className="vb-brand-neon">ROBOEYES</span>
          <span className="vb-brand-sub">STUDIO B</span>
        </div>
        <div className="vb-status-pill">
          <span className={`vb-status-dot ${playback.clock.status}`} />
          <span className="vb-status-text">{playback.clock.status.toUpperCase()}</span>
          {reducedMotion && <span className="vb-reduced-pill">REDUCED MOTION</span>}
        </div>
        <div className="vb-timecode-display" title="Animation position">
          <code>{formatTimecode(playback.clock.positionMs)}</code>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="vb-transport-playback">
        <div className="vb-playback-btn-group">
          <button
            type="button"
            className="vb-tp-btn"
            onClick={onRestart}
            title="Restart from 0:00"
            aria-label="Restart animation"
          >
            ⏮
          </button>
          {isPlaying ? (
            <button
              type="button"
              className="vb-tp-btn vb-tp-btn-primary active"
              onClick={onPause}
              title="Pause animation"
              aria-label="Pause animation"
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              type="button"
              className="vb-tp-btn vb-tp-btn-primary"
              onClick={onPlay}
              title="Play animation"
              aria-label="Play animation"
            >
              ▶ Play
            </button>
          )}
          <button
            type="button"
            className="vb-tp-btn"
            onClick={onStop}
            title="Stop and reset to 0"
            aria-label="Stop animation"
          >
            ⏹ Stop
          </button>
        </div>

        <div className="vb-speed-selector">
          {[0.5, 1, 2].map((rate) => (
            <button
              key={rate}
              type="button"
              className={`vb-speed-btn ${playback.clock.rate === rate ? 'active' : ''}`}
              onClick={() => onPlaybackRateChange(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Manual Live Triggers */}
      <div className="vb-transport-triggers">
        <span className="vb-triggers-label">LIVE TRIGGERS:</span>
        <button
          type="button"
          className="vb-trig-btn"
          onClick={() => onTrigger('blink', 'eye-openness')}
          title="Trigger instantaneous blink"
        >
          Blink
        </button>
        <button
          type="button"
          className="vb-trig-btn"
          onClick={() => onTrigger('wink-left', 'eye-openness')}
          title="Wink Left eye"
        >
          Wink L
        </button>
        <button
          type="button"
          className="vb-trig-btn"
          onClick={() => onTrigger('wink-right', 'eye-openness')}
          title="Wink Right eye"
        >
          Wink R
        </button>
        <button
          type="button"
          className="vb-trig-btn"
          onClick={() => onTrigger('curious', 'motion-offset')}
          title="Curious gaze motion"
        >
          Curious
        </button>
        <button
          type="button"
          className="vb-trig-btn"
          onClick={() => onTrigger('shiver', 'motion-offset')}
          title="Shiver / Shake motion"
        >
          Shake
        </button>
        <button
          type="button"
          className="vb-trig-btn"
          onClick={() => onTrigger('laugh', 'motion-offset')}
          title="Laugh motion"
        >
          Laugh
        </button>
      </div>

      {/* History & Presets */}
      <div className="vb-transport-actions">
        <div className="vb-history-group">
          <button
            type="button"
            className="vb-action-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last edit (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            className="vb-action-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪ Redo
          </button>
          <button
            type="button"
            className="vb-action-btn"
            onClick={onReset}
            title="Reset to preset defaults"
          >
            ↺ Reset
          </button>
        </div>

        <button
          type="button"
          className="vb-presets-modal-trigger"
          onClick={onOpenPresets}
          title="Manage Face Presets"
        >
          Presets ▾
        </button>
      </div>
    </header>
  )
}
