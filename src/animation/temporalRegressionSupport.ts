import {
  areEyeLidAperturesValid,
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  resolveEyeExpression,
  type FaceModel,
} from '../core/model'
import { expressionPresets, roboEyesPreset } from '../core/presets'
import {
  advancePlaybackClock,
  createFaceTransition,
  createPlaybackClock,
  eyeSpacing,
  normalizeIdleGazeDefinition,
  playPlaybackClock,
  type AnimationProgram,
  type RuntimeAnimationEvent,
} from './index'

export const TEMPORAL_BASE = roboEyesPreset.model
export const TEMPORAL_SEED = 0x1234abcd
export const TEMPORAL_FRAME_RATES = [20, 25, 30, 60, 120] as const

const EXPRESSION_KEYS = [
  'upperLid',
  'upperLidInner',
  'upperLidOuter',
  'lowerLid',
  'lowerLidCurvature',
  'tilt',
  'heightScale',
  'gazeHeightExpansion',
  'gazeHeightThreshold',
] as const

export function temporalExpression(id: string) {
  const preset = expressionPresets.find((entry) => entry.id === id)
  if (preset === undefined) throw new Error(`Missing expression preset ${id}`)
  return preset.expression
}

export function temporalRound(value: number, digits = 9): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function resolvedExpressionSignature(model: FaceModel, side: 'left' | 'right') {
  const resolved = resolveEyeExpression(model.expression, side)
  return EXPRESSION_KEYS.map((key) => temporalRound(resolved[key]))
}

export function temporalFrameSignature(model: FaceModel) {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  return {
    canvas: [temporalRound(model.canvas.width), temporalRound(model.canvas.height)],
    left: [
      temporalRound(left.position.x), temporalRound(left.position.y),
      temporalRound(left.width), temporalRound(left.height),
      temporalRound(left.cornerRadius), temporalRound(left.rotation),
    ],
    right: [
      temporalRound(right.position.x), temporalRound(right.position.y),
      temporalRound(right.width), temporalRound(right.height),
      temporalRound(right.cornerRadius), temporalRound(right.rotation),
    ],
    spacing: temporalRound(eyeSpacing(model)),
    gaze: [temporalRound(model.gaze.x), temporalRound(model.gaze.y)],
    expression: {
      left: resolvedExpressionSignature(model, 'left'),
      right: resolvedExpressionSignature(model, 'right'),
    },
  }
}

export function temporalTransitionFixtureSignature(model: FaceModel) {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const leftExpression = resolveEyeExpression(model.expression, 'left')
  const rightExpression = resolveEyeExpression(model.expression, 'right')
  return [
    temporalRound(left.position.x), temporalRound(right.position.x),
    temporalRound(left.width), temporalRound(right.width),
    temporalRound(left.height), temporalRound(right.height),
    temporalRound(left.cornerRadius), temporalRound(right.cornerRadius),
    temporalRound(left.rotation), temporalRound(right.rotation),
    temporalRound(eyeSpacing(model)), temporalRound(model.gaze.x), temporalRound(model.gaze.y),
    temporalRound(leftExpression.lowerLid), temporalRound(leftExpression.lowerLidCurvature),
    temporalRound(rightExpression.lowerLid), temporalRound(rightExpression.lowerLidCurvature),
  ]
}

function collectNumericValues(value: unknown, output: number[] = []): number[] {
  if (typeof value === 'number') output.push(value)
  else if (Array.isArray(value)) value.forEach((entry) => collectNumericValues(entry, output))
  else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectNumericValues(entry, output))
  }
  return output
}

export function temporalInvariantErrors(model: FaceModel): string[] {
  const errors: string[] = []
  if (!collectNumericValues(model).every(Number.isFinite)) errors.push('non-finite numeric value')
  if (model.canvas.width < 0 || model.canvas.height < 0) errors.push('negative canvas dimension')
  for (const [side, eye] of [['left', model.leftEye], ['right', model.rightEye]] as const) {
    if (eye.geometry.width < 0) errors.push(`${side} eye negative width`)
    if (eye.geometry.height < 0) errors.push(`${side} eye negative height`)
    if (eye.geometry.cornerRadius < 0) errors.push(`${side} eye negative radius`)
    if (resolveEyeExpression(model.expression, side).heightScale < 0) errors.push(`${side} eye negative height scale`)
  }
  if (!areEyeLidAperturesValid(model.expression)) errors.push('inverted eyelid aperture')
  if (!canFitEyesInCanvas(model)) errors.push('eye geometry cannot fit canvas')
  if (!isGazeCanvasSafe(model)) errors.push('gaze outside canvas-safe bounds')
  return errors
}

export function temporalRuntimeEvent(
  id: string,
  channel: RuntimeAnimationEvent['channel'],
  action: string,
  startTimeMs: number,
  order = 0,
  priority = 0,
): RuntimeAnimationEvent {
  return { id, channel, action, startTimeMs, order, priority }
}

/**
 * Advance using the requested redraw cadence, then use one final partial frame
 * when the target timestamp is not an exact cadence boundary. Tiny floating
 * accumulation inside the clock is normalized to the requested logical time.
 */
export function temporalPlaybackPositionAt(frameRate: number, durationMs: number): number {
  const frameDurationMs = 1_000 / frameRate
  const wholeFrames = Math.floor(durationMs / frameDurationMs)
  let clock = playPlaybackClock(createPlaybackClock())
  for (let frame = 0; frame < wholeFrames; frame += 1) {
    clock = advancePlaybackClock(clock, frameDurationMs)
  }
  const remainderMs = durationMs - wholeFrames * frameDurationMs
  if (remainderMs > 1e-9) clock = advancePlaybackClock(clock, remainderMs)
  return Math.abs(clock.positionMs - durationMs) <= 1e-7 ? durationMs : clock.positionMs
}

export const temporalGeometryTransition = createFaceTransition(
  'fixture:geometry-expression',
  {
    gaze: { x: 8, y: -4 },
    leftEye: { geometry: { width: 30, height: 28, cornerRadius: 6, rotation: -10 } },
    rightEye: { geometry: { width: 42, height: 32, cornerRadius: 10, rotation: 10 } },
    eyeSpacing: 18,
    expression: temporalExpression('expression:happy'),
  },
  100,
  800,
  'linear',
)

export const temporalAutoBlinkDefinition = {
  enabled: true,
  startTimeMs: 0,
  intervalMs: 1_000,
  variationMs: 500,
}

export const temporalIdleDefinition = normalizeIdleGazeDefinition({
  kind: 'idle-gaze',
  enabled: true,
  intervalMs: 1_000,
  variationMs: 700,
  transitionDurationMs: 300,
  easing: 'ease-in-out',
  xRange: { min: -10, max: 10 },
  yRange: { min: -5, max: 5 },
})

export const temporalSequenceProgram: AnimationProgram = {
  version: 1,
  id: 'fixture:sequence',
  playbackMode: 'once',
  steps: [
    {
      id: 'neutral',
      target: { expression: temporalExpression('expression:neutral'), gaze: { x: -6, y: 0 } },
      transitionDurationMs: 0,
      easing: 'linear',
      holdDurationMs: 100,
    },
    {
      id: 'happy',
      target: { expression: temporalExpression('expression:happy'), gaze: { x: 6, y: 0 } },
      transitionDurationMs: 100,
      easing: 'linear',
      holdDurationMs: 150,
      actions: [{ id: 'blink', channel: 'eye-openness', action: 'blink', offsetMs: 50 }],
    },
    {
      id: 'angry',
      target: { expression: temporalExpression('expression:angry'), gaze: { x: 0, y: 0 } },
      transitionDurationMs: 200,
      easing: 'ease-in-out',
      holdDurationMs: 100,
    },
  ],
}
