import { describe, expect, it } from 'vitest'
import {
  areEyeLidAperturesValid,
  isGazeCanvasSafe,
  resolveEyeExpression,
  resolveGazeReactiveHeightScale,
  type FaceModel,
} from '../core/model'
import { expressionPresets } from '../core/presets'
import {
  applyEasing,
  createAnimationFrameContext,
  createFaceTransition,
  eyeSpacing,
  evaluateAnimationFrame,
  gazeTargetForDirection,
  gazeTargetForRoboEyesPosition,
  interpolateFaceModel,
  normalizedGazeTarget,
  retargetFaceTransition,
  sampleFaceTransition,
  stateTransitionChannelResolver,
  type AnimationDefinition,
  type JsonValue,
} from './index'

const baseModel: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: {
    geometry: {
      position: { x: 40, y: 32 },
      width: 36,
      height: 30,
      cornerRadius: 8,
      rotation: 0,
    },
  },
  rightEye: {
    geometry: {
      position: { x: 88, y: 32 },
      width: 36,
      height: 30,
      cornerRadius: 8,
      rotation: 0,
    },
  },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#ffffff', stroke: '#ffffff', background: '#000000' },
}

const presetExpression = (id: string) => {
  const expression = expressionPresets.find((preset) => preset.id === id)?.expression
  if (expression === undefined) throw new Error(`Missing expression preset ${id}`)
  return expression
}

describe('easing identifiers', () => {
  it('resolve deterministic serializable easing curves', () => {
    expect(applyEasing('linear', 0.25)).toBe(0.25)
    expect(applyEasing('ease-in', 0.5)).toBe(0.25)
    expect(applyEasing('ease-out', 0.5)).toBe(0.75)
    expect(applyEasing('ease-in-out', 0.5)).toBe(0.5)
    expect(applyEasing('smoothstep', 0.5)).toBe(0.5)
  })
})

describe('generic FaceModel interpolation', () => {
  it('interpolates geometry, gaze, spacing, radius, rotation, and expression by explicit time', () => {
    const transition = createFaceTransition(
      'transition:geometry',
      {
        gaze: { x: 8, y: -4 },
        leftEye: {
          geometry: {
            position: { x: 34, y: 30 },
            width: 30,
            height: 24,
            cornerRadius: 5,
            rotation: -10,
          },
        },
        rightEye: {
          geometry: {
            position: { x: 94, y: 34 },
            width: 42,
            height: 36,
            cornerRadius: 11,
            rotation: 10,
          },
        },
        eyeSpacing: 18,
        expression: presetExpression('expression:happy'),
      },
      100,
      800,
      'linear',
    )

    const midpoint = sampleFaceTransition(transition, baseModel, 500)
    expect(midpoint.gaze.x).toBeCloseTo(4)
    expect(midpoint.gaze.y).toBeCloseTo(-2)
    expect(midpoint.leftEye.geometry.width).toBeCloseTo(33)
    expect(midpoint.rightEye.geometry.height).toBeCloseTo(33)
    expect(midpoint.leftEye.geometry.cornerRadius).toBeCloseTo(6.5)
    expect(midpoint.rightEye.geometry.rotation).toBeCloseTo(5)
    expect(midpoint.expression.lowerLid).toBeCloseTo(0.14)

    const endpoint = sampleFaceTransition(transition, baseModel, 900)
    expect(eyeSpacing(endpoint)).toBeCloseTo(18)
    expect(endpoint.expression).toEqual(presetExpression('expression:happy'))
  })

  it('is sampling-order and render-cadence independent at the same logical timestamp', () => {
    const transition = createFaceTransition(
      'transition:gaze',
      { gaze: { x: 10, y: 5 } },
      0,
      1_000,
      'ease-in-out',
    )

    const direct = sampleFaceTransition(transition, baseModel, 640)
    for (const time of [16.6667, 33.3333, 100, 250, 500, 600]) {
      sampleFaceTransition(transition, baseModel, time)
    }
    const after60ishCadence = sampleFaceTransition(transition, baseModel, 640)
    for (const time of [40, 80, 120, 160, 240, 320, 400, 480, 560, 600]) {
      sampleFaceTransition(transition, baseModel, time)
    }
    const after25Cadence = sampleFaceTransition(transition, baseModel, 640)

    expect(after60ishCadence).toEqual(direct)
    expect(after25Cadence).toEqual(direct)
  })

  it('keeps canvas and colors discrete while preserving exact static endpoints', () => {
    const targetModel: FaceModel = {
      ...baseModel,
      canvas: { width: 240, height: 240 },
      colors: { eye: '#00ff00', background: '#222222' },
      gaze: { x: 4, y: 0 },
    }

    const midpoint = interpolateFaceModel(baseModel, targetModel, 0.5)
    expect(midpoint.canvas).toEqual(baseModel.canvas)
    expect(midpoint.colors).toEqual(baseModel.colors)
    expect(interpolateFaceModel(baseModel, targetModel, 0)).toEqual(baseModel)
    expect(interpolateFaceModel(baseModel, targetModel, 1)).toEqual(targetModel)
  })
})

describe('expression interpolation', () => {
  it.each([
    'expression:happy',
    'expression:angry',
    'expression:tired',
    'expression:surprised',
  ])('transitions Neutral to %s without expression-name branches', (targetId) => {
    const transition = createFaceTransition(
      `transition:${targetId}`,
      { expression: presetExpression(targetId) },
      0,
      400,
      'smoothstep',
    )

    const frame = sampleFaceTransition(transition, baseModel, 200)
    expect(areEyeLidAperturesValid(frame.expression)).toBe(true)
    expect(frame.expression).not.toEqual(baseModel.expression)
    expect(sampleFaceTransition(transition, baseModel, 400).expression).toEqual(presetExpression(targetId))
  })

  it('interpolates asymmetric per-eye overrides independently', () => {
    const suspicious = presetExpression('expression:suspicious')
    const transition = createFaceTransition(
      'transition:asymmetric',
      { expression: suspicious },
      0,
      1_000,
      'linear',
    )
    const midpoint = sampleFaceTransition(transition, baseModel, 500)
    const left = resolveEyeExpression(midpoint.expression, 'left')
    const right = resolveEyeExpression(midpoint.expression, 'right')

    expect(left.upperLid).toBeCloseTo(0.12)
    expect(right.upperLid).toBeCloseTo(0.03)
    expect(left.heightScale).toBeCloseTo(0.89)
    expect(right.heightScale).toBeCloseTo(1)
    expect(left.upperLid).not.toBe(right.upperLid)
  })

  it('keeps Curious deformation continuous while gaze itself is interpolating', () => {
    const curiousModel: FaceModel = {
      ...baseModel,
      expression: presetExpression('expression:curious'),
    }
    const target = gazeTargetForDirection(curiousModel, 'right')
    const transition = createFaceTransition(
      'transition:curious-gaze',
      { gaze: target },
      0,
      1_000,
      'linear',
    )

    const early = sampleFaceTransition(transition, curiousModel, 250)
    const middle = sampleFaceTransition(transition, curiousModel, 500)
    const late = sampleFaceTransition(transition, curiousModel, 750)
    const earlyScale = resolveGazeReactiveHeightScale(early.expression, 'right', early.gaze.x, early.canvas.width)
    const middleScale = resolveGazeReactiveHeightScale(middle.expression, 'right', middle.gaze.x, middle.canvas.width)
    const lateScale = resolveGazeReactiveHeightScale(late.expression, 'right', late.gaze.x, late.canvas.width)

    expect(early.gaze.x).toBeLessThan(middle.gaze.x)
    expect(middle.gaze.x).toBeLessThan(late.gaze.x)
    expect(earlyScale).toBeLessThanOrEqual(middleScale)
    expect(middleScale).toBeLessThanOrEqual(lateScale)
  })
})

describe('gaze targets and safety', () => {
  it('maps arbitrary normalized targets into safe bounds', () => {
    const target = normalizedGazeTarget(baseModel, { x: 0.37, y: -0.61 })
    const transition = createFaceTransition('transition:arbitrary', { gaze: target }, 0, 100, 'linear')
    const endpoint = sampleFaceTransition(transition, baseModel, 100)

    expect(target.x).toBeGreaterThan(0)
    expect(target.y).toBeLessThan(0)
    expect(isGazeCanvasSafe(endpoint)).toBe(true)
  })

  it('supports directional and RoboEyes-style 9-position vocabulary', () => {
    expect(gazeTargetForDirection(baseModel, 'left')).toEqual(gazeTargetForRoboEyesPosition(baseModel, 'W'))
    expect(gazeTargetForDirection(baseModel, 'up-right')).toEqual(gazeTargetForRoboEyesPosition(baseModel, 'NE'))
    expect(gazeTargetForDirection(baseModel, 'center')).toEqual(gazeTargetForRoboEyesPosition(baseModel, 'DEFAULT'))

    const east = gazeTargetForRoboEyesPosition(baseModel, 'E')
    const west = gazeTargetForRoboEyesPosition(baseModel, 'W')
    expect(east.x).toBeGreaterThan(0)
    expect(west.x).toBeLessThan(0)
  })

  it('clamps an authored unsafe gaze target and keeps every sampled frame canvas-safe', () => {
    const transition = createFaceTransition(
      'transition:safe-gaze',
      { gaze: { x: 10_000, y: -10_000 } },
      0,
      1_000,
      'ease-out',
    )

    for (let time = 0; time <= 1_000; time += 25) {
      const frame = sampleFaceTransition(transition, baseModel, time)
      expect(isGazeCanvasSafe(frame)).toBe(true)
      expect(areEyeLidAperturesValid(frame.expression)).toBe(true)
    }
  })
})

describe('interruptible retargeting', () => {
  it('rebases from the resolved mid-transition model without snapping', () => {
    const first = createFaceTransition(
      'transition:look-right',
      { gaze: gazeTargetForDirection(baseModel, 'right') },
      0,
      1_000,
      'ease-in-out',
    )
    const beforeRetarget = sampleFaceTransition(first, baseModel, 400)
    const retargeted = retargetFaceTransition(
      first,
      baseModel,
      { gaze: gazeTargetForDirection(beforeRetarget, 'left') },
      400,
      { id: 'transition:look-left', durationMs: 600, easing: 'smoothstep' },
    )

    expect(sampleFaceTransition(retargeted, baseModel, 400)).toEqual(beforeRetarget)
    expect(sampleFaceTransition(retargeted, baseModel, 700).gaze.x).toBeLessThan(beforeRetarget.gaze.x)
    expect(retargeted.from).toEqual(beforeRetarget)
  })

  it('produces the same rebased transition regardless of prior sampling history', () => {
    const first = createFaceTransition('transition:a', { gaze: { x: 8 } }, 0, 800, 'ease-in-out')
    const target = { gaze: { x: -8, y: 2 } }
    const direct = retargetFaceTransition(first, baseModel, target, 350)

    for (const time of [10, 20, 50, 125, 200, 300]) sampleFaceTransition(first, baseModel, time)
    const afterSampling = retargetFaceTransition(first, baseModel, target, 350)
    expect(afterSampling).toEqual(direct)
  })
})

describe('#98 runtime integration', () => {
  it('round-trips a transition as JSON-safe authored channel data and resolves through the state channel', () => {
    const transition = createFaceTransition(
      'transition:runtime',
      { gaze: { x: 6 }, expression: presetExpression('expression:happy') },
      100,
      400,
      'ease-in-out',
    )
    const serialized = JSON.stringify(transition)
    const channelDefinition = JSON.parse(serialized) as JsonValue
    const definition: AnimationDefinition = {
      version: 1,
      enabled: true,
      channels: { 'state-transition': channelDefinition },
    }

    const frame = evaluateAnimationFrame({
      baseModel,
      definition,
      context: createAnimationFrameContext(300, 123),
      channelResolvers: { 'state-transition': stateTransitionChannelResolver },
    })
    const direct = sampleFaceTransition(transition, baseModel, 300)

    expect(frame.model).toEqual(direct)
    expect(frame.model.gaze.x).toBeGreaterThan(0)
    expect(frame.model.expression.lowerLid).toBeGreaterThan(0)
  })
})
