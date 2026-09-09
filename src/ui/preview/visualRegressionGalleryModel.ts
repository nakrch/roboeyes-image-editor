import { createFaceTransition, sampleFaceTransition } from '../../animation'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import type { ExpressionModel, FaceModel, Point } from '../../core/model'
import { defaultRoboEyesPreset, expressionPresets, matchExpressionPreset } from '../../core/presets'
import type { Phase2ExpressionVisualFixture } from '../../renderers/svg/__fixtures__/phase2Expressions'

export type GalleryExpressionSelection = {
  expression: ExpressionModel
  presetId: string
  gaze?: Point
}

export const GALLERY_MOTION_PREVIEW_CYCLE_MS = 1_800
const GALLERY_MOTION_TRANSITION_MS = 350
const GALLERY_MOTION_TARGET_HOLD_END_MS = 950
const GALLERY_MOTION_RETURN_END_MS = GALLERY_MOTION_TARGET_HOLD_END_MS + GALLERY_MOTION_TRANSITION_MS
const HIDDEN_GALLERY_FIXTURE_IDS = new Set([
  'neutral-128x64',
  'curious-center-128x64',
  'happy-240x240',
])

export function isGalleryVisibleFixture(fixture: Phase2ExpressionVisualFixture): boolean {
  return !HIDDEN_GALLERY_FIXTURE_IDS.has(fixture.id)
}

export function expressionForFixture(fixture: Phase2ExpressionVisualFixture): ExpressionModel {
  if (fixture.expression) return structuredClone(fixture.expression)
  const preset = expressionPresets.find((candidate) => candidate.name === fixture.presetName)
  if (!preset) throw new Error(`Missing expression preset for fixture ${fixture.id}`)
  return structuredClone(preset.expression)
}

export function modelForFixture(fixture: Phase2ExpressionVisualFixture): FaceModel {
  const base = roboEyesToFaceModel({
    ...defaultRoboEyesPreset,
    canvasWidth: fixture.canvas.width,
    canvasHeight: fixture.canvas.height,
    gazeX: fixture.gaze.x,
    gazeY: fixture.gaze.y,
  })
  return {
    ...base,
    expression: expressionForFixture(fixture),
  }
}

export function selectionForFixture(
  fixture: Phase2ExpressionVisualFixture,
  includeFixtureGaze = false,
): GalleryExpressionSelection {
  const expression = expressionForFixture(fixture)
  const preset = fixture.presetName === undefined
    ? undefined
    : expressionPresets.find((candidate) => candidate.name === fixture.presetName)

  return {
    expression,
    presetId: preset?.id ?? matchExpressionPreset(expression),
    ...(includeFixtureGaze ? { gaze: { ...fixture.gaze } } : {}),
  }
}

export function applyGallerySelection(
  model: FaceModel,
  selection: GalleryExpressionSelection,
): FaceModel {
  return {
    ...model,
    expression: structuredClone(selection.expression),
    ...(selection.gaze === undefined ? {} : { gaze: { ...selection.gaze } }),
  }
}

function neutralModelForFixture(fixture: Phase2ExpressionVisualFixture): FaceModel {
  const neutral = expressionPresets.find((preset) => preset.id === 'expression:neutral')
  if (!neutral) throw new Error('Missing Neutral expression preset')
  const base = roboEyesToFaceModel({
    ...defaultRoboEyesPreset,
    canvasWidth: fixture.canvas.width,
    canvasHeight: fixture.canvas.height,
    gazeX: 0,
    gazeY: 0,
  })
  return {
    ...base,
    expression: structuredClone(neutral.expression),
  }
}

/**
 * Samples the opt-in card animation without mutating the committed regression fixture.
 * The loop intentionally uses only deterministic Phase 3 state transitions.
 */
export function sampleFixtureMotionPreview(
  fixture: Phase2ExpressionVisualFixture,
  timeMs: number,
): FaceModel {
  const normalizedTime = Number.isFinite(timeMs) && timeMs >= 0
    ? timeMs % GALLERY_MOTION_PREVIEW_CYCLE_MS
    : 0
  const neutral = neutralModelForFixture(fixture)
  const target = modelForFixture(fixture)

  if (normalizedTime <= GALLERY_MOTION_TRANSITION_MS) {
    return sampleFaceTransition(
      createFaceTransition(
        `gallery-motion-enter:${fixture.id}`,
        { expression: target.expression, gaze: target.gaze },
        0,
        GALLERY_MOTION_TRANSITION_MS,
        'ease-in-out',
      ),
      neutral,
      normalizedTime,
    )
  }

  if (normalizedTime < GALLERY_MOTION_TARGET_HOLD_END_MS) return target

  if (normalizedTime <= GALLERY_MOTION_RETURN_END_MS) {
    return sampleFaceTransition(
      createFaceTransition(
        `gallery-motion-return:${fixture.id}`,
        { expression: neutral.expression, gaze: neutral.gaze },
        GALLERY_MOTION_TARGET_HOLD_END_MS,
        GALLERY_MOTION_TRANSITION_MS,
        'ease-in-out',
      ),
      target,
      normalizedTime,
    )
  }

  return neutral
}
