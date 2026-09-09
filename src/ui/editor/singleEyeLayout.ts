import { isEyeVisible, type ExpressionModel, type FaceModel } from '../../core/model'
import { movePair, pairCenterX, pairCenterY, pairSpacing } from './modelEditing'

export const SINGLE_EYE_NEUTRAL_EXPRESSION: Readonly<ExpressionModel> = {
  upperLid: 0,
  lowerLid: 0,
  tilt: 0,
}

function cloneExpression(expression: ExpressionModel): ExpressionModel {
  return structuredClone(expression)
}

export function isSingleEyeLayout(model: FaceModel): boolean {
  return isEyeVisible(model, 'left') && !isEyeVisible(model, 'right')
}

/** Keep authored single-eye mode visually neutral regardless of prior expression state. */
export function enforceSingleEyeNeutralExpression(model: FaceModel): FaceModel {
  if (!isSingleEyeLayout(model)) return model
  return { ...model, expression: cloneExpression(SINGLE_EYE_NEUTRAL_EXPRESSION) }
}

/**
 * Enter the editor's RoboEyes-compatible single-eye layout.
 *
 * The left eye becomes the visible primary eye and is moved to the current pair
 * center. The hidden right eye is translated by the same delta so its relative
 * spacing is retained as reversible editor state without leaking a RoboEyes
 * `cyclops` flag into the generic model/renderer. Single-eye authoring is neutral
 * by design; the editor shell may retain the prior two-eye expression separately
 * so it can be restored when returning to a paired layout.
 */
export function enableSingleEyeLayout(model: FaceModel): FaceModel {
  if (isSingleEyeLayout(model)) return enforceSingleEyeNeutralExpression(model)
  const centered = movePair(model, pairCenterX(model), pairCenterY(model))
  const deltaX = pairCenterX(centered) - centered.leftEye.geometry.position.x
  const deltaY = pairCenterY(centered) - centered.leftEye.geometry.position.y
  return {
    ...movePair(centered, pairCenterX(centered) + deltaX, pairCenterY(centered) + deltaY),
    eyeVisibility: { left: true, right: false },
    expression: cloneExpression(SINGLE_EYE_NEUTRAL_EXPRESSION),
  }
}

/**
 * Return to a two-eye layout centered on the current single-eye position while
 * preserving the stored edge spacing and each eye's geometry. When supplied,
 * `restoreExpression` restores the two-eye expression that was active before
 * entering single-eye mode.
 */
export function disableSingleEyeLayout(
  model: FaceModel,
  restoreExpression?: ExpressionModel,
): FaceModel {
  if (!isSingleEyeLayout(model)) {
    const next: FaceModel = {
      ...model,
      ...(restoreExpression === undefined ? {} : { expression: cloneExpression(restoreExpression) }),
    }
    delete next.eyeVisibility
    return next
  }

  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const centerX = left.position.x
  const centerY = left.position.y
  const spacing = pairSpacing(model)
  const pairWidth = left.width + spacing + right.width
  const leftX = centerX - pairWidth / 2 + left.width / 2
  const rightX = centerX + pairWidth / 2 - right.width / 2

  const next: FaceModel = {
    ...model,
    ...(restoreExpression === undefined ? {} : { expression: cloneExpression(restoreExpression) }),
    leftEye: {
      ...model.leftEye,
      geometry: {
        ...left,
        position: { x: leftX, y: centerY },
      },
    },
    rightEye: {
      ...model.rightEye,
      geometry: {
        ...right,
        position: { x: rightX, y: centerY },
      },
    },
  }
  delete next.eyeVisibility
  return next
}

/** Move the single visible eye while retaining the hidden eye's relative layout. */
export function moveSingleEye(model: FaceModel, x: number | undefined, y: number | undefined): FaceModel {
  if (!isSingleEyeLayout(model)) return model
  const current = model.leftEye.geometry.position
  const targetX = x ?? current.x
  const targetY = y ?? current.y
  return movePair(
    model,
    pairCenterX(model) + (targetX - current.x),
    pairCenterY(model) + (targetY - current.y),
  )
}

/** Keep the hidden eye at the same edge spacing when the visible eye width changes. */
export function preserveSingleEyeSpacing(before: FaceModel, after: FaceModel): FaceModel {
  if (!isSingleEyeLayout(before) || !isSingleEyeLayout(after)) return after
  const spacing = pairSpacing(before)
  const left = after.leftEye.geometry
  const right = after.rightEye.geometry
  return {
    ...after,
    rightEye: {
      ...after.rightEye,
      geometry: {
        ...right,
        position: {
          ...right.position,
          x: left.position.x + left.width / 2 + spacing + right.width / 2,
        },
      },
    },
  }
}
