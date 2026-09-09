import { describe, expect, it, vi } from 'vitest'
import { builtInPresets } from '../core/presets'
import { animationExportSchedule, sampleAnimationExportFrames } from './animationFrames'

describe('animation export sampling', () => {
  it('samples exact logical timestamps independent of realtime cadence', () => {
    expect(animationExportSchedule({ durationMs: 1000, fps: 4 })).toEqual([
      { index: 0, timeMs: 0, durationMs: 250 },
      { index: 1, timeMs: 250, durationMs: 250 },
      { index: 2, timeMs: 500, durationMs: 250 },
      { index: 3, timeMs: 750, durationMs: 250 },
    ])
  })

  it('clips the final frame to preserve the requested duration', () => {
    const schedule = animationExportSchedule({ durationMs: 1050, fps: 4 })
    expect(schedule.at(-1)).toEqual({ index: 4, timeMs: 1000, durationMs: 50 })
    expect(schedule.reduce((total, frame) => total + frame.durationMs, 0)).toBe(1050)
  })

  it('supports low-FPS small-display export cadences', () => {
    const schedule = animationExportSchedule({ durationMs: 1000, fps: 20 })
    expect(schedule).toHaveLength(20)
    expect(schedule[1].timeMs).toBe(50)
  })

  it('rejects invalid duration and FPS instead of silently changing semantics', () => {
    expect(() => animationExportSchedule({ durationMs: 0, fps: 30 })).toThrow(RangeError)
    expect(() => animationExportSchedule({ durationMs: 1000, fps: Number.NaN })).toThrow(RangeError)
  })

  it('directly resolves each scheduled timestamp and snapshots the result', () => {
    const base = structuredClone(builtInPresets[0].model)
    const resolver = vi.fn((timeMs: number) => ({
      ...base,
      gaze: { ...base.gaze, x: timeMs / 100 },
    }))

    const frames = sampleAnimationExportFrames({ durationMs: 500, fps: 4 }, resolver)

    expect(resolver.mock.calls.map(([timeMs]) => timeMs)).toEqual([0, 250])
    expect(frames.map((frame) => frame.model.gaze.x)).toEqual([0, 2.5])
    expect(frames[0].model).not.toBe(base)
  })
})
