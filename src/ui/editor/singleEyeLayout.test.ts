import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../../core/model'
import { pairCenterX, pairSpacing } from './modelEditing'
import {
  disableSingleEyeLayout,
  enableSingleEyeLayout,
  isSingleEyeLayout,
  moveSingleEye,
  preserveSingleEyeSpacing,
} from './singleEyeLayout'

const model: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 40, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  rightEye: { geometry: { position: { x: 88, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#fff', background: '#000' },
}

describe('single-eye editor layout', () => {
  it('centers the visible eye and round-trips the unchanged pair layout', () => {
    const single = enableSingleEyeLayout(model)
    expect(isSingleEyeLayout(single)).toBe(true)
    expect(single.leftEye.geometry.position).toEqual({ x: 64, y: 32 })
    expect(pairSpacing(single)).toBe(pairSpacing(model))

    const pair = disableSingleEyeLayout(single)
    expect(pair.eyeVisibility).toBeUndefined()
    expect(pair.leftEye.geometry.position).toEqual(model.leftEye.geometry.position)
    expect(pair.rightEye.geometry.position).toEqual(model.rightEye.geometry.position)
  })

  it('moves the visible eye and hidden layout together', () => {
    const single = enableSingleEyeLayout(model)
    const moved = moveSingleEye(single, 70, 27)
    expect(moved.leftEye.geometry.position).toEqual({ x: 70, y: 27 })
    expect(pairSpacing(moved)).toBe(pairSpacing(single))

    const pair = disableSingleEyeLayout(moved)
    expect(pairCenterX(pair)).toBeCloseTo(70)
    expect(pair.leftEye.geometry.position.y).toBe(27)
    expect(pair.rightEye.geometry.position.y).toBe(27)
  })

  it('can retain edge spacing after a visible-eye width edit', () => {
    const single = enableSingleEyeLayout(model)
    const spacing = pairSpacing(single)
    const resized: FaceModel = {
      ...single,
      leftEye: {
        ...single.leftEye,
        geometry: { ...single.leftEye.geometry, width: 44 },
      },
    }
    const preserved = preserveSingleEyeSpacing(single, resized)
    expect(pairSpacing(preserved)).toBeCloseTo(spacing)
  })
})
