import type { FaceModel } from '../../core/model'
import { expressionPresets, matchExpressionPreset } from '../../core/presets'
import {
  EASING_IDS,
  PROGRAM_PLAYBACK_MODES,
  builtInBehaviorProfiles,
  type AnimationProgram,
  type AnimationProgramStep,
  type EasingId,
  type JsonValue,
  type PresetAnimationDefaults,
  type PresetAnimationDefaultsV1,
  type ProgramPlaybackMode,
  type RuntimeAnimationEvent,
} from '../../animation'
import { editableAnimationDefaults } from '../editor/animationPreview'
import type { AnimationPlaybackSession } from '../editor/animationPlayback'

type AnimationPanelProps = {
  model: FaceModel
  animationDefaults: PresetAnimationDefaults
  playback: AnimationPlaybackSession
  reducedMotion: boolean
  onAnimationDefaultsChange: (next: PresetAnimationDefaults) => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onRestart: () => void
  onPlaybackRateChange: (rate: number) => void
  onTrigger: (action: string, channel: RuntimeAnimationEvent['channel']) => void
}

function editable(defaults: PresetAnimationDefaults): PresetAnimationDefaultsV1 {
  return editableAnimationDefaults(defaults)
}

function withDefinitionChannel(
  defaults: PresetAnimationDefaults,
  channel: 'eye-openness' | 'gaze-pose' | 'motion-offset',
  value: JsonValue | undefined,
): PresetAnimationDefaultsV1 {
  const next = editable(defaults)
  const channels = { ...(next.definition?.channels ?? {}) }
  if (value === undefined) delete channels[channel]
  else channels[channel] = value
  return {
    ...next,
    definition: {
      version: 1,
      enabled: Object.keys(channels).length > 0,
      ...(Object.keys(channels).length === 0 ? {} : { channels }),
    },
  }
}

function eyeDefinition(defaults: PresetAnimationDefaults): Record<string, unknown> {
  const value = editable(defaults).definition?.channels?.['eye-openness']
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value) as Record<string, unknown>
    : { kind: 'eye-openness' }
}

function idleDefinition(defaults: PresetAnimationDefaults): Record<string, unknown> {
  const value = editable(defaults).definition?.channels?.['gaze-pose']
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value) as Record<string, unknown>
    : {
        kind: 'idle-gaze',
        enabled: false,
        intervalMs: 1_000,
        variationMs: 3_000,
        transitionDurationMs: 350,
        easing: 'ease-in-out',
        xRange: { min: -24, max: 24 },
        yRange: { min: -10, max: 10 },
      }
}

function motionDefinition(defaults: PresetAnimationDefaults): Record<string, unknown> {
  const value = editable(defaults).definition?.channels?.['motion-offset']
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value) as Record<string, unknown>
    : {
        kind: 'continuous-motion',
        axis: 'x',
        amplitude: 2,
        periodMs: 120,
        phase: 0,
        waveform: 'sine',
      }
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function makeStep(model: FaceModel, index: number): AnimationProgramStep {
  return {
    id: `step:${crypto.randomUUID()}`,
    target: {
      expression: structuredClone(model.expression),
      gaze: structuredClone(model.gaze),
    },
    transitionDurationMs: index === 0 ? 0 : 200,
    easing: 'ease-in-out',
    holdDurationMs: 800,
  }
}

function createProgram(model: FaceModel): AnimationProgram {
  return {
    version: 1,
    id: `animation:${crypto.randomUUID()}`,
    name: 'Editor sequence',
    playbackMode: 'loop',
    steps: [makeStep(model, 0)],
  }
}

function moveStep(program: AnimationProgram, index: number, delta: number): AnimationProgram {
  const target = index + delta
  if (target < 0 || target >= program.steps.length) return program
  const steps = [...program.steps]
  const [step] = steps.splice(index, 1)
  steps.splice(target, 0, step)
  return { ...program, steps }
}

function updateStep(
  program: AnimationProgram,
  stepId: string,
  updater: (step: AnimationProgramStep) => AnimationProgramStep,
): AnimationProgram {
  return {
    ...program,
    steps: program.steps.map((step) => step.id === stepId ? updater(step) : step),
  }
}

export function AnimationPanel({
  model,
  animationDefaults,
  playback,
  reducedMotion,
  onAnimationDefaultsChange,
  onPlay,
  onPause,
  onStop,
  onRestart,
  onPlaybackRateChange,
  onTrigger,
}: AnimationPanelProps) {
  const authored = editable(animationDefaults)
  const eye = eyeDefinition(animationDefaults)
  const autoBlink = eye.autoBlink && typeof eye.autoBlink === 'object' && !Array.isArray(eye.autoBlink)
    ? eye.autoBlink as Record<string, unknown>
    : { enabled: false, intervalMs: 2_500, variationMs: 1_500 }
  const idle = idleDefinition(animationDefaults)
  const motion = motionDefinition(animationDefaults)
  const program = authored.program

  const commitAuthored = (updater: (current: PresetAnimationDefaultsV1) => PresetAnimationDefaultsV1) => {
    onAnimationDefaultsChange(updater(editable(animationDefaults)))
  }

  const setEye = (next: Record<string, unknown>) => {
    onAnimationDefaultsChange(withDefinitionChannel(animationDefaults, 'eye-openness', next as JsonValue))
  }
  const setIdle = (next: Record<string, unknown>) => {
    onAnimationDefaultsChange(withDefinitionChannel(animationDefaults, 'gaze-pose', next as JsonValue))
  }
  const setMotion = (next: Record<string, unknown> | undefined) => {
    onAnimationDefaultsChange(withDefinitionChannel(animationDefaults, 'motion-offset', next as JsonValue | undefined))
  }

  const updateProgram = (next: AnimationProgram | undefined) => {
    commitAuthored((current) => {
      if (next === undefined) {
        const copy = { ...current }
        delete copy.program
        return copy
      }
      return { ...current, program: next }
    })
  }

  return (
    <section className="panel animation-panel" aria-label="Animation">
      <div className="panel-heading animation-heading">
        <div>
          <p className="eyebrow">Animation</p>
          <h2>Preview & behavior</h2>
        </div>
        <span className={`animation-status ${playback.clock.status}`}>
          {playback.clock.status}
        </span>
      </div>

      {reducedMotion && (
        <p className="animation-note" role="status">
          Reduced motion is active: automatic profile/idle/blink motion is suppressed in preview. Direct controls and authored data remain available.
        </p>
      )}

      <div className="animation-section">
        <div className="animation-toolbar" aria-label="Playback controls">
          <button type="button" onClick={onPlay}>Play</button>
          <button type="button" onClick={onPause}>Pause</button>
          <button type="button" onClick={onStop}>Stop</button>
          <button type="button" onClick={onRestart}>Restart</button>
        </div>
        <div className="animation-inline-fields">
          <label>
            <span>Speed</span>
            <select
              value={playback.clock.playbackRate}
              onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
            >
              {[0.25, 0.5, 1, 1.5, 2].map((rate) => (
                <option key={rate} value={rate}>{rate}×</option>
              ))}
            </select>
          </label>
          <label>
            <span>Seed</span>
            <input
              className="number-input"
              type="number"
              min="0"
              max="4294967295"
              step="1"
              value={authored.seed ?? 0}
              onChange={(event) => commitAuthored((current) => ({
                ...current,
                seed: Math.max(0, Math.min(0xffffffff, Number(event.target.value) || 0)) >>> 0,
              }))}
            />
          </label>
          <button
            type="button"
            onClick={() => commitAuthored((current) => ({
              ...current,
              seed: crypto.getRandomValues(new Uint32Array(1))[0],
            }))}
          >
            Reseed
          </button>
        </div>
        <p className="animation-time">Logical time: {Math.round(playback.clock.positionMs)} ms</p>
      </div>

      <div className="animation-section">
        <h3>Manual triggers</h3>
        <div className="animation-trigger-grid">
          <button type="button" onClick={() => onTrigger('blink', 'eye-openness')}>Blink</button>
          <button type="button" onClick={() => onTrigger('wink-left', 'eye-openness')}>Wink L</button>
          <button type="button" onClick={() => onTrigger('wink-right', 'eye-openness')}>Wink R</button>
          <button type="button" onClick={() => onTrigger('open', 'eye-openness')}>Open</button>
          <button type="button" onClick={() => onTrigger('close', 'eye-openness')}>Close</button>
          <button type="button" onClick={() => onTrigger('sleep', 'eye-openness')}>Sleep</button>
          <button type="button" onClick={() => onTrigger('confused', 'motion-offset')}>Confused</button>
          <button type="button" onClick={() => onTrigger('laugh', 'motion-offset')}>Laugh</button>
        </div>
      </div>

      <div className="animation-section">
        <h3>Behavior profile</h3>
        <label className="animation-field">
          <span>Profile</span>
          <select
            value={authored.behaviorProfile?.id ?? ''}
            onChange={(event) => commitAuthored((current) => {
              const selected = builtInBehaviorProfiles.find((profile) => profile.id === event.target.value)
              if (selected === undefined) {
                const copy = { ...current }
                delete copy.behaviorProfile
                return copy
              }
              return { ...current, behaviorProfile: structuredClone(selected) }
            })}
          >
            <option value="">None</option>
            {builtInBehaviorProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </label>
        <p className="animation-note">
          Static Expression remains separate; selecting a behavior profile does not replace the current Expression.
        </p>
      </div>

      <details className="animation-section" open>
        <summary>Auto blink & idle</summary>
        <div className="animation-fields-grid">
          <label className="animation-check">
            <input
              type="checkbox"
              checked={boolValue(autoBlink.enabled, false)}
              onChange={(event) => setEye({
                ...eye,
                kind: 'eye-openness',
                autoBlink: { ...autoBlink, enabled: event.target.checked },
              })}
            />
            Auto blink
          </label>
          <label className="animation-field">
            <span>Blink interval (ms)</span>
            <input className="number-input" type="number" min="1" step="100" value={numberValue(autoBlink.intervalMs, 2500)} onChange={(event) => setEye({ ...eye, kind: 'eye-openness', autoBlink: { ...autoBlink, intervalMs: Math.max(1, Number(event.target.value) || 1) } })} />
          </label>
          <label className="animation-field">
            <span>Blink variation (ms)</span>
            <input className="number-input" type="number" min="0" step="100" value={numberValue(autoBlink.variationMs, 1500)} onChange={(event) => setEye({ ...eye, kind: 'eye-openness', autoBlink: { ...autoBlink, variationMs: Math.max(0, Number(event.target.value) || 0) } })} />
          </label>
          <label className="animation-check">
            <input type="checkbox" checked={boolValue(idle.enabled, false)} onChange={(event) => setIdle({ ...idle, kind: 'idle-gaze', enabled: event.target.checked })} />
            Idle wander
          </label>
          <label className="animation-field">
            <span>Idle interval (ms)</span>
            <input className="number-input" type="number" min="1" step="100" value={numberValue(idle.intervalMs, 1000)} onChange={(event) => setIdle({ ...idle, intervalMs: Math.max(1, Number(event.target.value) || 1) })} />
          </label>
          <label className="animation-field">
            <span>Idle variation (ms)</span>
            <input className="number-input" type="number" min="0" step="100" value={numberValue(idle.variationMs, 3000)} onChange={(event) => setIdle({ ...idle, variationMs: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
        </div>
      </details>

      <details className="animation-section">
        <summary>Continuous motion</summary>
        <div className="animation-fields-grid">
          <label className="animation-check">
            <input
              type="checkbox"
              checked={authored.definition?.channels?.['motion-offset'] !== undefined}
              onChange={(event) => setMotion(event.target.checked ? motion : undefined)}
            />
            Enabled
          </label>
          <label className="animation-field">
            <span>Axis</span>
            <select value={String(motion.axis ?? 'x')} onChange={(event) => setMotion({ ...motion, kind: 'continuous-motion', axis: event.target.value })}>
              <option value="x">Horizontal</option>
              <option value="y">Vertical</option>
            </select>
          </label>
          <label className="animation-field">
            <span>Amplitude</span>
            <input className="number-input" type="number" min="0" step="0.5" value={numberValue(motion.amplitude, 2)} onChange={(event) => setMotion({ ...motion, amplitude: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <label className="animation-field">
            <span>Period (ms)</span>
            <input className="number-input" type="number" min="1" step="10" value={numberValue(motion.periodMs, 120)} onChange={(event) => setMotion({ ...motion, periodMs: Math.max(1, Number(event.target.value) || 1) })} />
          </label>
          <label className="animation-field">
            <span>Waveform</span>
            <select value={String(motion.waveform ?? 'sine')} onChange={(event) => setMotion({ ...motion, waveform: event.target.value })}>
              <option value="sine">Sine</option>
              <option value="triangle">Triangle</option>
              <option value="square">Square</option>
              <option value="jitter">Jitter</option>
            </select>
          </label>
        </div>
      </details>

      <details className="animation-section" open={program !== undefined}>
        <summary>State sequence</summary>
        {program === undefined ? (
          <button type="button" onClick={() => updateProgram(createProgram(model))}>Create sequence</button>
        ) : (
          <div className="sequence-editor">
            <div className="animation-inline-fields">
              <label>
                <span>Playback mode</span>
                <select value={program.playbackMode} onChange={(event) => updateProgram({ ...program, playbackMode: event.target.value as ProgramPlaybackMode })}>
                  {PROGRAM_PLAYBACK_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => updateProgram({ ...program, steps: [...program.steps, makeStep(model, program.steps.length)] })}>Add step</button>
              <button type="button" onClick={() => updateProgram(undefined)}>Remove sequence</button>
            </div>

            {program.steps.map((step, index) => {
              const expressionId = step.target.expression === undefined
                ? ''
                : matchExpressionPreset(step.target.expression)
              return (
                <fieldset className="sequence-step" key={step.id}>
                  <legend>Step {index + 1}</legend>
                  <div className="sequence-step-actions">
                    <button type="button" disabled={index === 0} onClick={() => updateProgram(moveStep(program, index, -1))}>↑</button>
                    <button type="button" disabled={index === program.steps.length - 1} onClick={() => updateProgram(moveStep(program, index, 1))}>↓</button>
                    <button
                      type="button"
                      disabled={program.steps.length === 1}
                      onClick={() => updateProgram({ ...program, steps: program.steps.filter((candidate) => candidate.id !== step.id) })}
                    >
                      Delete
                    </button>
                  </div>
                  <label className="animation-field">
                    <span>Expression target</span>
                    <select
                      value={expressionId}
                      onChange={(event) => {
                        const expression = expressionPresets.find((preset) => preset.id === event.target.value)?.expression
                        if (expression === undefined) return
                        updateProgram(updateStep(program, step.id, (current) => ({
                          ...current,
                          target: { ...current.target, expression: structuredClone(expression) },
                        })))
                      }}
                    >
                      {expressionId === 'custom' && <option value="custom">Custom current target</option>}
                      {expressionPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                    </select>
                  </label>
                  <div className="animation-fields-grid">
                    <label className="animation-field">
                      <span>Transition (ms)</span>
                      <input className="number-input" type="number" min="0" step="25" value={step.transitionDurationMs} onChange={(event) => updateProgram(updateStep(program, step.id, (current) => ({ ...current, transitionDurationMs: Math.max(0, Number(event.target.value) || 0) })))} />
                    </label>
                    <label className="animation-field">
                      <span>Hold (ms)</span>
                      <input className="number-input" type="number" min="0" step="50" value={step.holdDurationMs} onChange={(event) => updateProgram(updateStep(program, step.id, (current) => ({ ...current, holdDurationMs: Math.max(0, Number(event.target.value) || 0) })))} />
                    </label>
                    <label className="animation-field">
                      <span>Easing</span>
                      <select value={step.easing} onChange={(event) => updateProgram(updateStep(program, step.id, (current) => ({ ...current, easing: event.target.value as EasingId })))}>
                        {EASING_IDS.map((easing) => <option key={easing} value={easing}>{easing}</option>)}
                      </select>
                    </label>
                  </div>
                </fieldset>
              )
            })}
          </div>
        )}
      </details>
    </section>
  )
}
