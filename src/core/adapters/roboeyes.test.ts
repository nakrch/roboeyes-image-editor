import { describe, expect, it } from 'vitest'

import { roboEyesToFaceModel, type RoboEyesParameters } from './roboeyes'

const baseParameters: RoboEyesParameters = {
  canvasWidth: 128,
  canvasHeight: 64,
  eyeWidth: 36,
  eyeHeight: 28,
  eyeRadius: 7,
  eyeSpacing: 12,
  gazeX: 4,
  gazeY: -3,
  rotation: 6,
  upperLid: 0.1,
  lowerLid: 0.2,
  expressionTilt: -5,
  eyeColor: '#fff',
  backgroundColor: '#000',
}

describe('roboEyesToFaceModel', () => {
  it('maps representative RoboEyes parameters into a generic face model', () => {
    const model = roboEyesToFaceModel(baseParameters)

    expect(model.canvas).toEqual({ width: 128, height: 64 })
    expect(model.leftEye.geometry).toEqual({
      position: { x: 40, y: 32 },
      width: 36,
      height: 28,
      cornerRadius: 7,
      rotation: 6,
    })
    expect(model.rightEye.geometry).toEqual({
      position: { x: 88, y: 32 },
      width: 36,
      height: 28,
      cornerRadius: 7,
      rotation: 6,
    })
    expect(model.gaze).toEqual({ x: 4, y: -3 })
    expect(model.expression).toEqual({ upperLid: 0.1, lowerLid: 0.2, tilt: -5 })
    expect(model.colors).toEqual({ eye: '#fff', background: '#000' })
  })

  it('uses an explicit pair center and preserves edge spacing with asymmetric eyes', () => {
    const model = roboEyesToFaceModel({
      ...baseParameters,
      centerX: 70,
      centerY: 30,
      eyeSpacing: 10,
      leftEye: { width: 30, height: 20, rotation: -8 },
      rightEye: { width: 50, cornerRadius: 12 },
    })

    expect(model.leftEye.geometry.position).toEqual({ x: 40, y: 30 })
    expect(model.rightEye.geometry.position).toEqual({ x: 90, y: 30 })
    expect(model.leftEye.geometry).toMatchObject({ width: 30, height: 20, rotation: -8 })
    expect(model.rightEye.geometry).toMatchObject({ width: 50, height: 28, cornerRadius: 12 })

    const leftRightEdge = model.leftEye.geometry.position.x + model.leftEye.geometry.width / 2
    const rightLeftEdge = model.rightEye.geometry.position.x - model.rightEye.geometry.width / 2
    expect(rightLeftEdge - leftRightEdge).toBe(10)
  })
})
