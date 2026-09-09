import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../core/model'
import {
  cloneFaceModel,
  createFaceTransition,
  createSpringFaceTransition,
  sampleFaceTransition,
  sampleSpringFaceTransition,
} from './index'

const singleEyeModel: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 64, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  rightEye: { geometry: { position: { x: 112, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#fff', background: '#000' },
  eyeVisibility: { left: true, right: false },
}

describe('single-eye animation compatibility', () => {
  it('preserves visibility when cloning runtime state', () => {
    const clone = cloneFaceModel(singleEyeModel)
    expect(clone.eyeVisibility).toEqual({ left: true, right: false })
    expect(clone.eyeVisibility).not.toBe(singleEyeModel.eyeVisibility)
  })

  it('preserves single-eye visibility through easing transitions', () => {
    const transition = createFaceTransition('single:gaze', { gaze: { x: 20 } }, 0, 1_000, 'ease-in-out')
    for (const timeMs of [0, 250, 500, 750, 1_000]) {
      expect(sampleFaceTransition(transition, singleEyeModel, timeMs).eyeVisibility)
        .toEqual({ left: true, right: false })
    }
  })

  it('preserves single-eye visibility through spring transitions', () => {
    const transition = createSpringFaceTransition('single:spring', { gaze: { x: -20 } }, 0, 1_000)
    for (const timeMs of [0, 125, 400, 800, 1_000]) {
      expect(sampleSpringFaceTransition(transition, singleEyeModel, timeMs).eyeVisibility)
        .toEqual({ left: true, right: false })
    }
  })
})
