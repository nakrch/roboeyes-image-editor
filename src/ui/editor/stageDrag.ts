import type { FaceModel } from '../../core/model'
import { rigidEyePositionRange, setIndependentEyePositionSafely } from './eyePositionSafety'
import { movePair, pairCenterX, pairCenterY, type EyeSide } from './modelEditing'
import { isSingleEyeLayout, moveSingleEye } from './singleEyeLayout'

export type CanvasDelta = { dx: number; dy: number }

function clamp(value: number, range: { min: number; max: number }): number {
  return Math.max(range.min, Math.min(range.max, value))
}

/** Resolve every pointer move against the authored model captured at pointer-down. */
export function applyStageDrag(startModel: FaceModel, side: EyeSide, linkedEyes: boolean, { dx, dy }: CanvasDelta): FaceModel {
  if (isSingleEyeLayout(startModel)) {
    const position = startModel.leftEye.geometry.position
    return moveSingleEye(
      startModel,
      clamp(position.x + dx, rigidEyePositionRange(startModel, 'x', position.x)),
      clamp(position.y + dy, rigidEyePositionRange(startModel, 'y', position.y)),
    )
  }
  if (linkedEyes) {
    const x = pairCenterX(startModel)
    const y = pairCenterY(startModel)
    return movePair(
      startModel,
      clamp(x + dx, rigidEyePositionRange(startModel, 'x', x)),
      clamp(y + dy, rigidEyePositionRange(startModel, 'y', y)),
    )
  }
  const position = (side === 'left' ? startModel.leftEye : startModel.rightEye).geometry.position
  const movedX = setIndependentEyePositionSafely(startModel, side, 'x', position.x + dx)
  return setIndependentEyePositionSafely(movedX, side, 'y', position.y + dy)
}

export function pointerToCanvas(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, canvas: FaceModel['canvas']): { x: number; y: number } {
  return {
    x: (clientX - rect.left) * canvas.width / rect.width,
    y: (clientY - rect.top) * canvas.height / rect.height,
  }
}
