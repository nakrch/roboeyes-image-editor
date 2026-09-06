import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import {
  canFitEyesInCanvas,
  gazeLimits,
  isGazeCanvasSafe,
  minimumCanvasSize,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { setIndependentEyeDimensionSafely } from './eyeDimensions'
import { setIndependentEyePositionSafely } from './eyePositionSafety'
import { setIndependentEyeRotationSafely } from './eyeRotationSafety'
import {
  setIndependentExpressionGeometrySafely,
  setIndependentLidSafely,
} from './independentExpressionSafety'
import { resizeCanvasFromCenter, type EyeSide } from './modelEditing'

// Keep this deterministic: failures must be reproducible from the seed and history.
// 6 seeds × 80 accepted edit attempts = 480 mixed Independent-mode operations.
const SEEDS = [0x1de9e7e, 0x51de1e55, 0x7a11babe, 0xc001d00d, 0xf00dcafe, 0x66aa9911]
const STEPS_PER_SEED = 80
const CANVAS_MIN = 16
const CANVAS_MAX = 640

function createModel(): FaceModel {
  return roboEyesToFaceModel(defaultRoboEyesPreset)
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}

function randomBetween(random: () => number, min: number, max: number): number {
  return min + (max - min) * random()
}

function randomSide(random: () => number): EyeSide {
  return random() < 0.5 ? 'left' : 'right'
}

function assertIndependentInvariants(model: FaceModel, context: string): void {
  const values = [
    model.canvas.width,
    model.canvas.height,
    model.gaze.x,
    model.gaze.y,
    model.leftEye.geometry.position.x,
    model.leftEye.geometry.position.y,
    model.leftEye.geometry.width,
    model.leftEye.geometry.height,
    model.leftEye.geometry.rotation,
    model.rightEye.geometry.position.x,
    model.rightEye.geometry.position.y,
    model.rightEye.geometry.width,
    model.rightEye.geometry.height,
    model.rightEye.geometry.rotation,
  ]
  const details = `${context}\nmodel=${JSON.stringify(model)}`

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`non-finite independent geometry\n${details}`)
  }
  if (!canFitEyesInCanvas(model)) {
    throw new Error(`independent eyes cannot fit canvas\n${details}`)
  }
  if (!isGazeCanvasSafe(model)) {
    throw new Error(`independent visible eye overflow\n${details}`)
  }
  if (visibleEyesOverlap(model)) {
    throw new Error(`independent visible eyes overlap\n${details}`)
  }
}

function resizeLikeUi(model: FaceModel, requestedWidth: number, requestedHeight: number): FaceModel {
  const minimum = minimumCanvasSize(model)
  const width = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(minimum.width), requestedWidth))
  const height = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(minimum.height), requestedHeight))
  return resizeCanvasFromCenter(model, width, height)
}

function setRandomSafeGaze(model: FaceModel, random: () => number): FaceModel {
  const limits = gazeLimits(model)
  return {
    ...model,
    gaze: {
      x: randomBetween(random, limits.x.min, limits.x.max),
      y: randomBetween(random, limits.y.min, limits.y.max),
    },
  }
}

function applyOperation(
  model: FaceModel,
  random: () => number,
): { model: FaceModel; label: string } {
  const operation = Math.floor(random() * 10)
  const side = randomSide(random)

  switch (operation) {
    case 0: {
      const value = randomBetween(random, -320, 640)
      return {
        model: setIndependentEyePositionSafely(model, side, 'x', value),
        label: `${side}.x=${value}`,
      }
    }
    case 1: {
      const value = randomBetween(random, -320, 640)
      return {
        model: setIndependentEyePositionSafely(model, side, 'y', value),
        label: `${side}.y=${value}`,
      }
    }
    case 2: {
      const value = randomBetween(random, 1, 160)
      return {
        model: setIndependentEyeDimensionSafely(model, side, 'width', value),
        label: `${side}.width=${value}`,
      }
    }
    case 3: {
      const value = randomBetween(random, 1, 160)
      return {
        model: setIndependentEyeDimensionSafely(model, side, 'height', value),
        label: `${side}.height=${value}`,
      }
    }
    case 4: {
      const value = randomBetween(random, -45, 45)
      return {
        model: setIndependentEyeRotationSafely(model, side, value),
        label: `${side}.rotation=${value}`,
      }
    }
    case 5: {
      const value = randomBetween(random, -30, 30)
      return {
        model: setIndependentExpressionGeometrySafely(model, side, 'tilt', value),
        label: `${side}.tilt=${value}`,
      }
    }
    case 6: {
      const value = randomBetween(random, 0.5, 1.5)
      return {
        model: setIndependentExpressionGeometrySafely(model, side, 'heightScale', value),
        label: `${side}.heightScale=${value}`,
      }
    }
    case 7: {
      const key = random() < 0.5 ? 'upperLid' : 'lowerLid'
      const value = randomBetween(random, 0, 0.9)
      return {
        model: setIndependentLidSafely(model, side, key, value),
        label: `${side}.${key}=${value}`,
      }
    }
    case 8:
      return { model: setRandomSafeGaze(model, random), label: 'gaze=random-safe' }
    default: {
      const width = randomBetween(random, 32, 320)
      const height = randomBetween(random, 32, 240)
      return {
        model: resizeLikeUi(model, width, height),
        label: `canvas=${width}x${height}`,
      }
    }
  }
}

describe('Independent geometry safety', () => {
  it('keeps the opposite eye geometry unchanged during a per-eye rotation edit', () => {
    const model = createModel()
    const originalRight = structuredClone(model.rightEye.geometry)
    const next = setIndependentEyeRotationSafely(model, 'left', 45)

    expect(next.rightEye.geometry).toEqual(originalRight)
    assertIndependentInvariants(next, 'single-eye rotation')
  })

  for (const seed of SEEDS) {
    it(`preserves invariants for Independent fuzz seed 0x${seed.toString(16)}`, () => {
      const random = mulberry32(seed)
      let model = createModel()
      const history: string[] = []

      for (let step = 0; step < STEPS_PER_SEED; step += 1) {
        const result = applyOperation(model, random)
        model = result.model
        history.push(result.label)
        assertIndependentInvariants(
          model,
          `seed=0x${seed.toString(16)} step=${step} operation=${result.label}\nhistory=${history.join(' -> ')}`,
        )
      }

      expect(history).toHaveLength(STEPS_PER_SEED)
    })
  }
})
