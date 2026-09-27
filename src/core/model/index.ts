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
export { isEyeVisible, visibleEyeSides } from './face'
export type { CanvasModel, ColorModel, EyeVisibilityModel, FaceModel } from './face'
export { DISPLAY_MASKS, displayMaskCircle, isDisplayMask } from './display'
export type { DisplayMask } from './display'
export { isLensModel, resolveLensStrength, lensRadialMap, warpPointThroughLens } from './lens'
export type { LensFit, LensModel } from './lens'
