import {
  SPRING_PRESETS,
  type EasingId,
  type SpringParameters,
  type SpringPresetId,
} from '../../animation'
import { resolveNumericDraft } from './numericInputDraft'

export type TransitionAuthoringMode = 'easing' | 'spring'

export const DEFAULT_EASING: EasingId = 'ease-in-out'
export const EASING_DEFAULT_DURATION_MS = 400
export const DEFAULT_SPRING_PRESET: SpringPresetId = 'gentle'
export const DEFAULT_SEQUENCE_HOLD_MS = 800

export const SPRING_PRESET_DURATION_MS: Readonly<Record<SpringPresetId, number>> = {
  gentle: 700,
  snappy: 400,
  bouncy: 700,
}

export const EASING_OPTION_LABELS: Readonly<Record<EasingId, string>> = {
  linear: 'Linear — constant speed',
  'ease-in': 'Ease in — slow start',
  'ease-out': 'Ease out — slow finish',
  'ease-in-out': 'Ease in-out — slow start & finish',
  smoothstep: 'Smoothstep — softer start & finish',
}

function recommendedDuration(currentDurationMs: number, nextDurationMs: number): number {
  return currentDurationMs === 0 ? 0 : nextDurationMs
}

export function defaultSequenceTransition(index: number): {
  transitionDurationMs: number
  easing: EasingId
  spring: SpringParameters
  holdDurationMs: number
} {
  return {
    transitionDurationMs: index === 0 ? 0 : SPRING_PRESET_DURATION_MS[DEFAULT_SPRING_PRESET],
    easing: DEFAULT_EASING,
    spring: { ...SPRING_PRESETS[DEFAULT_SPRING_PRESET] },
    holdDurationMs: DEFAULT_SEQUENCE_HOLD_MS,
  }
}

export function transitionModeDefaults(
  mode: TransitionAuthoringMode,
  currentDurationMs: number,
): { transitionDurationMs: number; spring?: SpringParameters } {
  if (mode === 'spring') {
    return {
      transitionDurationMs: recommendedDuration(
        currentDurationMs,
        SPRING_PRESET_DURATION_MS[DEFAULT_SPRING_PRESET],
      ),
      spring: { ...SPRING_PRESETS[DEFAULT_SPRING_PRESET] },
    }
  }

  return {
    transitionDurationMs: recommendedDuration(currentDurationMs, EASING_DEFAULT_DURATION_MS),
  }
}

export function springPresetDefaults(
  presetId: SpringPresetId,
  currentDurationMs: number,
): { transitionDurationMs: number; spring: SpringParameters } {
  return {
    transitionDurationMs: recommendedDuration(currentDurationMs, SPRING_PRESET_DURATION_MS[presetId]),
    spring: { ...SPRING_PRESETS[presetId] },
  }
}

/** Resolve a committed State sequence timing draft without mutating on temporary empty/invalid text. */
export function commitSequenceTimingDraft(draft: string, currentValue: number): number {
  return resolveNumericDraft(draft, 0, Number.MAX_SAFE_INTEGER, 1) ?? currentValue
}
