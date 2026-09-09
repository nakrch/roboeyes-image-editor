import type { FaceModel } from '../../core/model'

export type PositionAxis = 'x' | 'y'

type CanvasModel = Pick<FaceModel, 'canvas'>

function canvasCenter(model: CanvasModel, axis: PositionAxis): number {
  return axis === 'x' ? model.canvas.width / 2 : model.canvas.height / 2
}

/** Convert an internal absolute eye/pair center coordinate into the editor's center-relative value. */
export function toCenterRelativePosition(
  model: CanvasModel,
  axis: PositionAxis,
  absoluteValue: number,
): number {
  return absoluteValue - canvasCenter(model, axis)
}

/** Convert a center-relative editor value back into the existing absolute model coordinate. */
export function fromCenterRelativePosition(
  model: CanvasModel,
  axis: PositionAxis,
  relativeValue: number,
): number {
  return canvasCenter(model, axis) + relativeValue
}

/** Preserve an existing absolute control interval while presenting it in center-relative units. */
export function centerRelativePositionRange(
  model: CanvasModel,
  axis: PositionAxis,
  absoluteMin: number,
  absoluteMax: number,
): { min: number; max: number } {
  const center = canvasCenter(model, axis)
  return {
    min: absoluteMin - center,
    max: absoluteMax - center,
  }
}
