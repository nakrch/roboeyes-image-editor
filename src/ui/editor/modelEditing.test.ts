import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import {
  movePair,
  pairCenterX,
  pairCenterY,
  pairSpacing,
  resizeCanvasFromCenter,
  setHorizontalLayout,
} from './modelEditing'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

describe('generic editor model operations', () => {
  it('updates linked widths while preserving pair center and edge spacing', () => {
    const model = createModel()
    const next = setHorizontalLayout(model, 48, 48, pairSpacing(model))

    expect(pairCenterX(next)).toBe(pairCenterX(model))
    expect(pairSpacing(next)).toBe(12)
    expect(next.leftEye.geometry.width).toBe(48)
    expect(next.rightEye.geometry.width).toBe(48)
  })

  it('moves the eye pair without changing its geometry', () => {
    const model = createModel()
    const next = movePair(model, 80, 40)

    expect(pairCenterX(next)).toBe(80)
    expect(pairCenterY(next)).toBe(40)
    expect(pairSpacing(next)).toBe(pairSpacing(model))
    expect(next.leftEye.geometry.width).toBe(model.leftEye.geometry.width)
  })

  it('recenters the face when applying a resolution preset', () => {
    const model = createModel()
    const next = resizeCanvasFromCenter(model, 320, 240)

    expect(next.canvas).toEqual({ width: 320, height: 240 })
    expect(pairCenterX(next)).toBe(160)
    expect(pairCenterY(next)).toBe(120)
    expect(pairSpacing(next)).toBe(pairSpacing(model))
  })
})
