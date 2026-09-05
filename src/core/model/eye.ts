export type Point = {
  x: number
  y: number
}

export type EyeGeometry = {
  /** Center position on the face canvas, in canvas units. */
  position: Point
  width: number
  height: number
  cornerRadius: number
  /** Clockwise rotation in degrees around the eye center. */
  rotation: number
}

export type EyeModel = {
  geometry: EyeGeometry
}
