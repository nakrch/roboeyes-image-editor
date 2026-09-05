import type { EyeGeometry, FaceModel } from '../../core/model'

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
