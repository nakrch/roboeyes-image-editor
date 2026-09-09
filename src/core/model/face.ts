import type { ExpressionModel } from './expression'
import type { EyeModel, Point } from './eye'

export type CanvasModel = {
  width: number
  height: number
}

export type ColorModel = {
  eye: string
  /** Optional eye outline color. Falls back to the fill color when omitted. */
  stroke?: string
  background: string
}

/**
 * Renderer-independent eye visibility. Omission preserves the historic
 * two-eye model, so existing presets/JSON remain backward compatible.
 */
export type EyeVisibilityModel = {
  left: boolean
  right: boolean
}

export type FaceModel = {
  canvas: CanvasModel
  leftEye: EyeModel
  rightEye: EyeModel
  /** Generic gaze offset in canvas units. */
  gaze: Point
  expression: ExpressionModel
  colors: ColorModel
  /** Optional generic visibility mask; omitted means both eyes are visible. */
  eyeVisibility?: EyeVisibilityModel
}

export function isEyeVisible(model: FaceModel, side: 'left' | 'right'): boolean {
  return model.eyeVisibility?.[side] ?? true
}

export function visibleEyeSides(model: FaceModel): Array<'left' | 'right'> {
  return (['left', 'right'] as const).filter((side) => isEyeVisible(model, side))
}
