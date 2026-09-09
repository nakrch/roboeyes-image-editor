import { describe, expect, it } from 'vitest'
import { SPRING_PRESETS } from '../../animation'
import {
  DEFAULT_EASING,
  DEFAULT_SPRING_PRESET,
  EASING_DEFAULT_DURATION_MS,
  EASING_OPTION_LABELS,
  SPRING_PRESET_DURATION_MS,
  commitSequenceTimingDraft,
  defaultSequenceTransition,
  springPresetDefaults,
  transitionModeDefaults,
} from './animationTransitionAuthoring'

describe('State sequence transition authoring defaults', () => {
  it('creates new animated steps as gentle Spring transitions', () => {
    const first = defaultSequenceTransition(0)
    const next = defaultSequenceTransition(1)

    expect(first.transitionDurationMs).toBe(0)
    expect(first.spring).toEqual(SPRING_PRESETS[DEFAULT_SPRING_PRESET])
    expect(next.transitionDurationMs).toBe(SPRING_PRESET_DURATION_MS.gentle)
    expect(next.spring).toEqual(SPRING_PRESETS.gentle)
    expect(next.easing).toBe(DEFAULT_EASING)
  })

  it('uses longer easing defaults and settling-friendly Spring durations', () => {
    expect(EASING_DEFAULT_DURATION_MS).toBe(400)
    expect(transitionModeDefaults('easing', 200)).toEqual({ transitionDurationMs: 400 })
    expect(transitionModeDefaults('spring', 200)).toEqual({
      transitionDurationMs: 700,
      spring: SPRING_PRESETS.gentle,
    })
    expect(springPresetDefaults('snappy', 700).transitionDurationMs).toBe(400)
    expect(springPresetDefaults('bouncy', 400).transitionDurationMs).toBe(700)
  })

  it('preserves an explicit zero-duration transition when modes or presets change', () => {
    expect(transitionModeDefaults('easing', 0).transitionDurationMs).toBe(0)
    expect(transitionModeDefaults('spring', 0).transitionDurationMs).toBe(0)
    expect(springPresetDefaults('bouncy', 0).transitionDurationMs).toBe(0)
  })

  it('describes easing choices in author-facing labels', () => {
    expect(EASING_OPTION_LABELS.linear).toContain('constant speed')
    expect(EASING_OPTION_LABELS['ease-in']).toContain('slow start')
    expect(EASING_OPTION_LABELS['ease-out']).toContain('slow finish')
    expect(EASING_OPTION_LABELS['ease-in-out']).toContain('start & finish')
    expect(EASING_OPTION_LABELS.smoothstep).toContain('softer')
  })
})

describe('State sequence timing draft commit', () => {
  it('keeps empty or invalid temporary drafts from replacing the committed value', () => {
    expect(commitSequenceTimingDraft('', 400)).toBe(400)
    expect(commitSequenceTimingDraft(' ', 400)).toBe(400)
    expect(commitSequenceTimingDraft('invalid', 400)).toBe(400)
  })

  it('commits zero and replacement integer timings after editing completes', () => {
    expect(commitSequenceTimingDraft('0', 400)).toBe(0)
    expect(commitSequenceTimingDraft('650', 400)).toBe(650)
    expect(commitSequenceTimingDraft('12.6', 400)).toBe(13)
    expect(commitSequenceTimingDraft('-50', 400)).toBe(0)
  })
})
