export {
  areEyeLidAperturesValid,
  resolveEyeExpression,
  resolveEyeLidAperture,
  resolveGazeReactiveHeightScale,
} from './expression'
export type { ExpressionModel, EyeExpression, EyeLidAperture } from './expression'
export { canFitEyesInCanvas, clampGaze, gazeLimits, isGazeCanvasSafe, minimumCanvasSize, visibleEyesOverlap } from './gaze'
export type { CanvasMinimumSize, GazeLimits, NumericRange } from './gaze'
export type { EyeGeometry, EyeModel, Point } from './eye'
export type { CanvasModel, ColorModel, FaceModel } from './face'
