import { useState } from 'react'
import type { FaceModel } from '../../../core/model'
import {
  builtInBehaviorProfiles,
  type AnimationProgram,
  type PresetAnimationDefaults,
  type PresetAnimationDefaultsV1,
} from '../../../animation'
import { editableAnimationDefaults } from '../../editor/animationPreview'
import { useToast } from '../../feedback/ToastProvider'
import { TactileSlider } from '../controls/TactileSlider'
import { ModeSwitch } from '../controls/ModeSwitch'

type MotionDeckCardProps = {
  model: FaceModel
  animationDefaults: PresetAnimationDefaults
  onAnimationDefaultsChange: (next: PresetAnimationDefaults) => void
  onPreviewSequenceStep?: (program: AnimationProgram, stepId: string) => void
}

function editable(defaults: PresetAnimationDefaults): PresetAnimationDefaultsV1 {
  return editableAnimationDefaults(defaults)
}

function withDefinitionChannel(
  defaults: PresetAnimationDefaults,
  channel: 'eye-openness' | 'gaze-pose' | 'motion-offset' | 'transient-effect',
  value: unknown,
): PresetAnimationDefaultsV1 {
  const next = editable(defaults)
  const channels = { ...(next.definition?.channels ?? {}) }
  if (value === undefined) delete channels[channel]
  else channels[channel] = value as never
  return {
    ...next,
    definition: {
      version: 1,
      enabled: Object.keys(channels).length > 0,
      ...(Object.keys(channels).length === 0 ? {} : { channels }),
    },
  }
}

export function MotionDeckCard({
  model: _model,
  animationDefaults,
  onAnimationDefaultsChange,
}: MotionDeckCardProps) {
  const [subTab, setSubTab] = useState<'profile' | 'autoblink' | 'idlegaze' | 'transient'>('profile')
  const { notify } = useToast()

  const currentDefaults = editable(animationDefaults)
  const activeProfileId = currentDefaults.behaviorProfile?.id ?? ''

  // Auto-blink channel data
  const eyeChannel = (currentDefaults.definition?.channels?.['eye-openness'] ?? {}) as Record<string, unknown>
  const autoBlinkEnabled = eyeChannel.kind === 'eye-openness' && typeof eyeChannel.autoBlink === 'object' && eyeChannel.autoBlink !== null
    ? ((eyeChannel.autoBlink as Record<string, unknown>).enabled !== false)
    : false
  const autoBlinkConfig = (eyeChannel.autoBlink as Record<string, unknown>) ?? {
    enabled: false,
    intervalMs: 3000,
    variationMs: 2000,
    durationMs: 150,
  }

  // Idle-gaze channel data
  const gazeChannel = (currentDefaults.definition?.channels?.['gaze-pose'] ?? {}) as Record<string, unknown>
  const idleGazeEnabled = gazeChannel.kind === 'idle-gaze' ? Boolean(gazeChannel.enabled) : false
  const idleGazeConfig = gazeChannel.kind === 'idle-gaze' ? gazeChannel : {
    enabled: false,
    intervalMs: 2000,
    variationMs: 2500,
    transitionDurationMs: 300,
    xRange: { min: -20, max: 20 },
    yRange: { min: -10, max: 10 },
  }

  const handleProfileChange = (profileId: string) => {
    const matched = builtInBehaviorProfiles.find((p) => p.id === profileId)
    if (!matched) {
      const copy = { ...currentDefaults }
      delete copy.behaviorProfile
      onAnimationDefaultsChange(copy)
      notify('success', 'Behavior profile cleared.')
      return
    }

    const next: PresetAnimationDefaultsV1 = {
      ...currentDefaults,
      behaviorProfile: structuredClone(matched),
    }
    onAnimationDefaultsChange(next)
    notify('success', `Switched to "${matched.name}" profile.`)
  }

  const updateAutoBlink = (partial: Record<string, unknown>) => {
    const nextAutoBlink = { ...autoBlinkConfig, ...partial }
    const nextEyeChannel = {
      kind: 'eye-openness',
      ...eyeChannel,
      autoBlink: nextAutoBlink,
    }
    onAnimationDefaultsChange(withDefinitionChannel(animationDefaults, 'eye-openness', nextEyeChannel))
  }

  const updateIdleGaze = (partial: Record<string, unknown>) => {
    const nextGazeChannel = {
      kind: 'idle-gaze',
      ...idleGazeConfig,
      ...partial,
    }
    onAnimationDefaultsChange(withDefinitionChannel(animationDefaults, 'gaze-pose', nextGazeChannel))
  }

  return (
    <div className="vb-deck-card vb-motion-card" aria-label="Motion & Animation Controls">
      <div className="vb-card-section">
        <ModeSwitch
          size="sm"
          value={subTab}
          options={[
            { value: 'profile', label: 'Profiles' },
            { value: 'autoblink', label: 'Auto-Blink' },
            { value: 'idlegaze', label: 'Idle Gaze' },
            { value: 'transient', label: 'Effects' },
          ]}
          onChange={(val) => setSubTab(val as typeof subTab)}
          ariaLabel="Motion subcategories"
        />
      </div>

      {subTab === 'profile' && (
        <div className="vb-card-section">
          <div className="vb-section-label">BEHAVIOR PRESET PROFILES</div>
          <div className="vb-profile-grid">
            {builtInBehaviorProfiles.map((p) => {
              const isSelected = p.id === activeProfileId
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`vb-profile-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleProfileChange(isSelected ? '' : p.id)}
                >
                  <div className="vb-profile-header">
                    <span className="vb-profile-name">{p.name}</span>
                    {isSelected && <span className="vb-profile-badge">ACTIVE</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {subTab === 'autoblink' && (
        <div className="vb-card-section">
          <div className="vb-section-header-row">
            <span className="vb-section-label">AUTO-BLINK GENERATOR</span>
            <label className="vb-switch-toggle">
              <input
                type="checkbox"
                checked={autoBlinkEnabled}
                onChange={(e) => updateAutoBlink({ enabled: e.target.checked })}
              />
              <span className="vb-switch-slider" />
              <span className="vb-switch-text">{autoBlinkEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>

          <div className="vb-sliders-grid">
            <TactileSlider
              label="Interval Mean"
              value={Number(autoBlinkConfig.intervalMs ?? 3000)}
              min={500}
              max={10000}
              step={100}
              unit="ms"
              disabled={!autoBlinkEnabled}
              onChange={(val) => updateAutoBlink({ intervalMs: val })}
            />
            <TactileSlider
              label="Interval Variation (Jitter)"
              value={Number(autoBlinkConfig.variationMs ?? 2000)}
              min={0}
              max={6000}
              step={100}
              unit="ms"
              disabled={!autoBlinkEnabled}
              onChange={(val) => updateAutoBlink({ variationMs: val })}
            />
            <TactileSlider
              label="Blink Duration"
              value={Number(autoBlinkConfig.durationMs ?? 150)}
              min={50}
              max={500}
              step={10}
              unit="ms"
              disabled={!autoBlinkEnabled}
              onChange={(val) => updateAutoBlink({ durationMs: val })}
            />
          </div>
        </div>
      )}

      {subTab === 'idlegaze' && (
        <div className="vb-card-section">
          <div className="vb-section-header-row">
            <span className="vb-section-label">IDLE GAZE WANDER</span>
            <label className="vb-switch-toggle">
              <input
                type="checkbox"
                checked={idleGazeEnabled}
                onChange={(e) => updateIdleGaze({ enabled: e.target.checked })}
              />
              <span className="vb-switch-slider" />
              <span className="vb-switch-text">{idleGazeEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>

          <div className="vb-sliders-grid">
            <TactileSlider
              label="Wander Interval"
              value={Number(idleGazeConfig.intervalMs ?? 2000)}
              min={500}
              max={8000}
              step={100}
              unit="ms"
              disabled={!idleGazeEnabled}
              onChange={(val) => updateIdleGaze({ intervalMs: val })}
            />
            <TactileSlider
              label="Transition Duration"
              value={Number(idleGazeConfig.transitionDurationMs ?? 300)}
              min={50}
              max={1000}
              step={25}
              unit="ms"
              disabled={!idleGazeEnabled}
              onChange={(val) => updateIdleGaze({ transitionDurationMs: val })}
            />
          </div>
        </div>
      )}

      {subTab === 'transient' && (
        <div className="vb-card-section">
          <div className="vb-section-label">TRANSIENT OVERLAYS & PARTICLES</div>
          <p className="vb-card-desc">
            Transient overlays like sweat drops or curiosity indicators trigger deterministically during expressions.
          </p>
          <div className="vb-transient-notice">
            Overlays are active during dynamic triggers and expression sequences. Use the Live Triggers in the top bar to preview real-time transient effects.
          </div>
        </div>
      )}
    </div>
  )
}
