export type ExpressionModel = {
  /** 0 = fully open, 1 = fully closed from the upper lid. */
  upperLid: number
  /** 0 = fully open, 1 = fully closed from the lower lid. */
  lowerLid: number
  /** Generic expression tilt in degrees. */
  tilt: number
}
