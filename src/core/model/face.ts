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

export type FaceModel = {
  canvas: CanvasModel
  leftEye: EyeModel
  rightEye: EyeModel
  /** Generic gaze offset in canvas units. */
  gaze: Point
  expression: ExpressionModel
  colors: ColorModel
}
