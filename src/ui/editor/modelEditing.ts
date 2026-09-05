import type { EyeGeometry, FaceModel, Point } from '../../core/model'

export type EyeSide = 'left' | 'right'
export type GeometryKey = 'width' | 'height' | 'cornerRadius' | 'rotation'

export function updateEyeGeometry(
  model: FaceModel,
  side: EyeSide,
  updater: (geometry: EyeGeometry) => EyeGeometry,
): FaceModel {
  if (side === 'left') {
    return {
      ...model,
      leftEye: { ...model.leftEye, geometry: updater(model.leftEye.geometry) },
    }
  }

  return {
    ...model,
    rightEye: { ...model.rightEye, geometry: updater(model.rightEye.geometry) },
  }
}

export function pairSpacing(model: FaceModel): number {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  return right.position.x - right.width / 2 - (left.position.x + left.width / 2)
}

export function pairCenterX(model: FaceModel): number {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const leftOuterEdge = left.position.x - left.width / 2
  const rightOuterEdge = right.position.x + right.width / 2
  return (leftOuterEdge + rightOuterEdge) / 2
}

export function pairCenterY(model: FaceModel): number {
  return (model.leftEye.geometry.position.y + model.rightEye.geometry.position.y) / 2
}

/** Center point between the two eye centers, used as the rigid-pair rotation pivot. */
export function pairRotationCenter(model: FaceModel): Point {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position

  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  }
}

/** Current linked/group rotation represented by the mean eye orientation. */
export function pairRotation(model: FaceModel): number {
  return (model.leftEye.geometry.rotation + model.rightEye.geometry.rotation) / 2
}

function rotatePointAround(point: Point, center: Point, radians: number): Point {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const x = point.x - center.x
  const y = point.y - center.y

  return {
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  }
}

/**
 * Rotate both eyes as one rigid pair around the midpoint between their centers.
 * `rotation` is an absolute group angle; any pre-existing relative eye tilt is preserved.
 */
export function rotatePair(model: FaceModel, rotation: number): FaceModel {
  const currentRotation = pairRotation(model)
  const delta = rotation - currentRotation
  if (delta === 0) return model

  const center = pairRotationCenter(model)
  const radians = (delta * Math.PI) / 180

  return {
    ...model,
    leftEye: {
      ...model.leftEye,
      geometry: {
        ...model.leftEye.geometry,
        position: rotatePointAround(model.leftEye.geometry.position, center, radians),
        rotation: model.leftEye.geometry.rotation + delta,
      },
    },
    rightEye: {
      ...model.rightEye,
      geometry: {
        ...model.rightEye.geometry,
        position: rotatePointAround(model.rightEye.geometry.position, center, radians),
        rotation: model.rightEye.geometry.rotation + delta,
      },
    },
  }
}

export function setHorizontalLayout(
  model: FaceModel,
  leftWidth: number,
  rightWidth: number,
  spacing: number,
): FaceModel {
  const centerX = pairCenterX(model)
  const pairWidth = leftWidth + spacing + rightWidth
  const leftX = centerX - pairWidth / 2 + leftWidth / 2
  const rightX = centerX + pairWidth / 2 - rightWidth / 2

  return {
    ...model,
    leftEye: {
      ...model.leftEye,
      geometry: {
        ...model.leftEye.geometry,
        width: leftWidth,
        position: { ...model.leftEye.geometry.position, x: leftX },
      },
    },
    rightEye: {
      ...model.rightEye,
      geometry: {
        ...model.rightEye.geometry,
        width: rightWidth,
        position: { ...model.rightEye.geometry.position, x: rightX },
      },
    },
  }
}

export function movePair(
  model: FaceModel,
  x: number | undefined,
  y: number | undefined,
): FaceModel {
  const deltaX = x === undefined ? 0 : x - pairCenterX(model)
  const deltaY = y === undefined ? 0 : y - pairCenterY(model)

  return {
    ...model,
    leftEye: {
      ...model.leftEye,
      geometry: {
        ...model.leftEye.geometry,
        position: {
          x: model.leftEye.geometry.position.x + deltaX,
          y: model.leftEye.geometry.position.y + deltaY,
        },
      },
    },
    rightEye: {
      ...model.rightEye,
      geometry: {
        ...model.rightEye.geometry,
        position: {
          x: model.rightEye.geometry.position.x + deltaX,
          y: model.rightEye.geometry.position.y + deltaY,
        },
      },
    },
  }
}

export function resizeCanvasFromCenter(
  model: FaceModel,
  width: number,
  height: number,
): FaceModel {
  const deltaX = width / 2 - model.canvas.width / 2
  const deltaY = height / 2 - model.canvas.height / 2

  return {
    ...model,
    canvas: { width, height },
    leftEye: {
      ...model.leftEye,
      geometry: {
        ...model.leftEye.geometry,
        position: {
          x: model.leftEye.geometry.position.x + deltaX,
          y: model.leftEye.geometry.position.y + deltaY,
        },
      },
    },
    rightEye: {
      ...model.rightEye,
      geometry: {
        ...model.rightEye.geometry,
        position: {
          x: model.rightEye.geometry.position.x + deltaX,
          y: model.rightEye.geometry.position.y + deltaY,
        },
      },
    },
  }
}
