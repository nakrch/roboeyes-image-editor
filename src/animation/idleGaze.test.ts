import { describe, expect, it } from 'vitest'
import {
  isGazeCanvasSafe,
  resolveGazeReactiveHeightScale,
  type FaceModel,
} from '../core/model'
import { expressionPresets, roboEyesPreset } from '../core/presets'
import {
  IDLE_GAZE_KIND,
  idleGazeChannelResolver,
  normalizeIdleGazeDefinition,
  resolveIdleGaze,
  scheduledIdleGazeTargets,
} from './idleGaze'
import {
  createAnimationFrameContext,
  evaluateAnimationFrame,
  normalizeRuntimeAnimationEvents,
  type RuntimeAnimationEvent,
} from './runtime'

const baseModel = roboEyesPreset.model

function control(
  id: string,
  action: 'idle-gaze-enable' | 'idle-gaze-disable',
  startTimeMs: number,
  order = 0,
  payload?: RuntimeAnimationEvent['payload'],
): RuntimeAnimationEvent {
  return {
    id,
    channel: 'gaze-pose',
    action,
    startTimeMs,
    order,
    ...(payload === undefined ? {} : { payload }),
  }
}

function normalized(...events: RuntimeAnimationEvent[]) {
  return normalizeRuntimeAnimationEvents(events)
}

function modelWithGaze(x: number, y: number): FaceModel {
  return {
    ...baseModel,
    gaze: { x, y },
  }
}

describe('idle gaze definition', () => {
  it('normalizes serializable defaults and validates ranges', () => {
    const definition = normalizeIdleGazeDefinition({ kind: IDLE_GAZE_KIND })
    expect(definition).toMatchObject({
      kind: IDLE_GAZE_KIND,
      enabled: false,
      startTimeMs: 0,
      intervalMs: 1_000,
      variationMs: 3_000,
      transitionDurationMs: 350,
      easing: 'ease-in-out',
    })
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition)
    expect(() => normalizeIdleGazeDefinition({
      kind: IDLE_GAZE_KIND,
      xRange: { min: 2, max: 1 },
    })).toThrow(/min must be <= max/)
    expect(() => normalizeIdleGazeDefinition({
      kind: IDLE_GAZE_KIND,
      intervalMs: 0,
    })).toThrow(/greater than zero/)
    expect(() => normalizeIdleGazeDefinition({
      kind: IDLE_GAZE_KIND,
      easing: 'spring',
    })).toThrow(/supported easing id/)
  })
})

describe('deterministic scheduling and targets', () => {
  const definition = normalizeIdleGazeDefinition({
    kind: IDLE_GAZE_KIND,
    enabled: true,
    intervalMs: 1_000,
    variationMs: 700,
    transitionDurationMs: 300,
    xRange: { min: -10, max: 10 },
    yRange: { min: -5, max: 5 },
  })

  it('reproduces identical target times and positions for the same seed', () => {
    const first = scheduledIdleGazeTargets(definition, [], baseModel, 8_000, 1234)
    const second = scheduledIdleGazeTargets(definition, [], baseModel, 8_000, 1234)
    expect(second).toEqual(first)
    expect(first.length).toBeGreaterThan(3)

    const reverseSamples = [8_000, 4_000, 2_000].map((timeMs) =>
      scheduledIdleGazeTargets(definition, [], baseModel, timeMs, 1234),
    )
    expect(reverseSamples[0]).toEqual(first)
    expect(scheduledIdleGazeTargets(definition, [], baseModel, 8_000, 1234)).toEqual(first)
  })

  it('uses independent seeded values so different seeds can produce different targets', () => {
    const seedA = scheduledIdleGazeTargets(definition, [], baseModel, 6_000, 1)
    const seedB = scheduledIdleGazeTargets(definition, [], baseModel, 6_000, 2)
    expect(seedB).not.toEqual(seedA)
  })

  it('keeps every generated target inside configured and canvas-safe bounds', () => {
    const targets = scheduledIdleGazeTargets(definition, [], baseModel, 20_000, 77)
    for (const entry of targets) {
      expect(entry.target.x).toBeGreaterThanOrEqual(-10)
      expect(entry.target.x).toBeLessThanOrEqual(10)
      expect(entry.target.y).toBeGreaterThanOrEqual(-5)
      expect(entry.target.y).toBeLessThanOrEqual(5)
      expect(isGazeCanvasSafe(modelWithGaze(entry.target.x, entry.target.y))).toBe(true)
    }
  })

  it('handles zero variation and degenerate target ranges exactly', () => {
    const fixed = normalizeIdleGazeDefinition({
      kind: IDLE_GAZE_KIND,
      enabled: true,
      intervalMs: 1_000,
      variationMs: 0,
      xRange: { min: 4, max: 4 },
      yRange: { min: -2, max: -2 },
    })
    const targets = scheduledIdleGazeTargets(fixed, [], baseModel, 3_000, 999)
    expect(targets.map((entry) => entry.startTimeMs)).toEqual([0, 1_000, 2_000, 3_000])
    expect(targets.every((entry) => entry.target.x === 4 && entry.target.y === -2)).toBe(true)
  })
})

describe('smooth transition behavior', () => {
  const fixedTarget = normalizeIdleGazeDefinition({
    kind: IDLE_GAZE_KIND,
    enabled: true,
    intervalMs: 2_000,
    variationMs: 0,
    transitionDurationMs: 400,
    easing: 'linear',
    xRange: { min: 10, max: 10 },
    yRange: { min: 4, max: 4 },
  })

  it('starts from authored gaze and reaches the target through #99 interpolation', () => {
    const atStart = resolveIdleGaze(fixedTarget, [], baseModel, 0, 5).model
    const halfway = resolveIdleGaze(fixedTarget, [], baseModel, 200, 5).model
    const finished = resolveIdleGaze(fixedTarget, [], baseModel, 400, 5).model

    expect(atStart.gaze).toEqual(baseModel.gaze)
    expect(halfway.gaze.x).toBeCloseTo(5)
    expect(halfway.gaze.y).toBeCloseTo(2)
    expect(finished.gaze.x).toBeCloseTo(10)
    expect(finished.gaze.y).toBeCloseTo(4)
  })

  it('is sampling-order and frame-cadence independent', () => {
    const direct = resolveIdleGaze(fixedTarget, [], baseModel, 350, 5).model
    for (const timeMs of [16, 33, 80, 120, 240, 300]) {
      resolveIdleGaze(fixedTarget, [], baseModel, timeMs, 5)
    }
    expect(resolveIdleGaze(fixedTarget, [], baseModel, 350, 5).model).toEqual(direct)
  })

  it('rebases overlapping retargets from the currently resolved gaze without snapping', () => {
    const fastRetarget = normalizeIdleGazeDefinition({
      kind: IDLE_GAZE_KIND,
      enabled: true,
      intervalMs: 100,
      variationMs: 0,
      transitionDurationMs: 400,
      easing: 'linear',
      xRange: { min: -10, max: 10 },
      yRange: { min: 0, max: 0 },
    })
    const before = resolveIdleGaze(fastRetarget, [], baseModel, 99.999, 8).model.gaze.x
    const atRetarget = resolveIdleGaze(fastRetarget, [], baseModel, 100, 8).model.gaze.x
    expect(atRetarget).toBeCloseTo(before, 3)
  })
})

describe('control and authored/manual gaze ownership', () => {
  const definition = normalizeIdleGazeDefinition({
    kind: IDLE_GAZE_KIND,
    enabled: true,
    intervalMs: 1_000,
    variationMs: 0,
    transitionDurationMs: 200,
    easing: 'linear',
    xRange: { min: 10, max: 10 },
    yRange: { min: 0, max: 0 },
  })

  it('returns control to authored/manual base gaze exactly when disabled', () => {
    const authored = modelWithGaze(3, -1)
    const events = normalized(control('off', 'idle-gaze-disable', 500))
    expect(resolveIdleGaze(definition, events, authored, 499, 1).active).toBe(true)
    const disabled = resolveIdleGaze(definition, events, authored, 500, 1)
    expect(disabled.active).toBe(false)
    expect(disabled.model).toEqual(authored)
  })

  it('re-enable starts a fresh deterministic epoch from the explicit enable timestamp', () => {
    const events = normalized(
      control('off', 'idle-gaze-disable', 500),
      control('on', 'idle-gaze-enable', 1_000, 1, {
        intervalMs: 800,
        variationMs: 0,
        transitionDurationMs: 200,
        easing: 'linear',
        xRange: { min: -8, max: -8 },
        yRange: { min: 0, max: 0 },
      }),
    )
    const atEnable = resolveIdleGaze(definition, events, baseModel, 1_000, 1)
    const after = resolveIdleGaze(definition, events, baseModel, 1_200, 1)
    expect(atEnable.model.gaze).toEqual(baseModel.gaze)
    expect(after.model.gaze.x).toBeCloseTo(-8)
    expect(after.targets[0]).toMatchObject({ epochIndex: 1, targetIndex: 0, startTimeMs: 1_000 })
  })

  it('runtime enable works without authored idle state and uses payload configuration', () => {
    const events = normalized(control('on', 'idle-gaze-enable', 100, 0, {
      intervalMs: 1_000,
      variationMs: 0,
      transitionDurationMs: 100,
      easing: 'linear',
      xRange: { min: 6, max: 6 },
      yRange: { min: 0, max: 0 },
    }))
    const disabledDefinition = normalizeIdleGazeDefinition({ kind: IDLE_GAZE_KIND })
    expect(resolveIdleGaze(disabledDefinition, events, baseModel, 200, 5).model.gaze.x).toBeCloseTo(6)
  })
})

describe('Curious and runtime integration', () => {
  it('lets Curious react continuously to generated horizontal idle gaze while staying safe', () => {
    const curious = expressionPresets.find((preset) => preset.id === 'expression:curious')
    expect(curious).toBeDefined()
    const model: FaceModel = {
      ...baseModel,
      expression: curious!.expression,
    }
    const definition = normalizeIdleGazeDefinition({
      kind: IDLE_GAZE_KIND,
      enabled: true,
      intervalMs: 2_000,
      variationMs: 0,
      transitionDurationMs: 200,
      easing: 'linear',
      xRange: { min: 10, max: 10 },
      yRange: { min: 0, max: 0 },
    })
    const resolved = resolveIdleGaze(definition, [], model, 200, 3).model
    expect(resolved.gaze.x).toBeCloseTo(10)
    expect(resolveGazeReactiveHeightScale(
      resolved.expression,
      'right',
      resolved.gaze.x,
      resolved.canvas.width,
    )).toBeGreaterThan(1)
    expect(resolveGazeReactiveHeightScale(
      resolved.expression,
      'left',
      resolved.gaze.x,
      resolved.canvas.width,
    )).toBeCloseTo(1)
    expect(isGazeCanvasSafe(resolved)).toBe(true)
  })

  it('integrates through the generic gaze-pose channel resolver', () => {
    const animationDefinition = {
      version: 1 as const,
      enabled: true,
      channels: {
        'gaze-pose': {
          kind: IDLE_GAZE_KIND,
          enabled: true,
          intervalMs: 1_000,
          variationMs: 0,
          transitionDurationMs: 200,
          easing: 'linear',
          xRange: { min: 8, max: 8 },
          yRange: { min: 0, max: 0 },
        },
      },
    }
    const model = evaluateAnimationFrame({
      baseModel,
      definition: animationDefinition,
      context: createAnimationFrameContext(200, 44),
      channelResolvers: { 'gaze-pose': idleGazeChannelResolver },
    }).model
    expect(model.gaze.x).toBeCloseTo(8)
    expect(model.gaze.y).toBeCloseTo(0)
  })
})
