import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import {
  clampGaze,
  isGazeCanvasSafe,
  minimumCanvasSize,
  resolveEyeExpression,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import {
  setIndependentEyeDimensionSafely,
  setLinkedEyeDimensionSafely,
} from './eyeDimensions'
import {
  setAnchoredPairSpacingSafely,
  setSharedExpressionGeometrySafely,
  setSharedLidSafely,
} from './geometrySafety'
import { resizeCanvasFromCenter, rotatePairSafely } from './modelEditing'

const CANVAS_MIN = 16
const CANVAS_MAX = 640
const FUZZ_SEEDS = [0x12345678, 0x5eedc0de, 0xc0ffee42, 0xdecafbad]
const STEPS_PER_SEED = 48

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

function randomChoice<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!
}

function visibleHeight(model: FaceModel, side: 'left' | 'right'): number {
  const geometry = side === 'left' ? model.leftEye.geometry : model.rightEye.geometry
  const expression = resolveEyeExpression(model.expression, side)
  const upper = Math.min(1, Math.max(0, expression.upperLid))
  const lower = Math.min(1, Math.max(0, expression.lowerLid))
  return Math.max(0, geometry.height * Math.max(0, expression.heightScale) * (1 - upper - lower))
}

function allGeometryNumbers(model: FaceModel): number[] {
  const eyes = [model.leftEye.geometry, model.rightEye.geometry]
  return [
    model.canvas.width,
    model.canvas.height,
    model.gaze.x,
    model.gaze.y,
    model.expression.upperLid,
    model.expression.lowerLid,
    model.expression.tilt,
    model.expression.heightScale ?? 1,
    ...eyes.flatMap((geometry) => [
      geometry.position.x,
      geometry.position.y,
      geometry.width,
      geometry.height,
      geometry.cornerRadius,
      geometry.rotation,
    ]),
  ]
}

function assertGeometryInvariants(model: FaceModel, context: string): void {
  const details = `${context}\nmodel=${JSON.stringify(model)}`

  if (allGeometryNumbers(model).some((value) => !Number.isFinite(value))) {
    throw new Error(`non-finite geometry\n${details}`)
  }
  if (!isGazeCanvasSafe(model)) {
    throw new Error(`visible eye overflow\n${details}`)
  }
  if (visibleEyesOverlap(model)) {
    throw new Error(`visible eyes overlap\n${details}`)
  }

  const leftExpression = resolveEyeExpression(model.expression, 'left')
  const rightExpression = resolveEyeExpression(model.expression, 'right')
  const leftExpectedVisible = leftExpression.upperLid + leftExpression.lowerLid < 1 - 1e-9
  const rightExpectedVisible = rightExpression.upperLid + rightExpression.lowerLid < 1 - 1e-9

  if (leftExpectedVisible && visibleHeight(model, 'left') <= 0) {
    throw new Error(`left eye disappeared unexpectedly\n${details}`)
  }
  if (rightExpectedVisible && visibleHeight(model, 'right') <= 0) {
    throw new Error(`right eye disappeared unexpectedly\n${details}`)
  }
}

function resizeCanvasSafely(model: FaceModel, requestedWidth: number, requestedHeight: number): FaceModel {
  const minimum = minimumCanvasSize(model)
  const width = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(minimum.width), requestedWidth))
  const height = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(minimum.height), requestedHeight))
  return resizeCanvasFromCenter(model, width, height)
}

function applyRandomSafeOperation(
  model: FaceModel,
  random: () => number,
): { model: FaceModel; operation: string } {
  const operation = Math.floor(random() * 9)

  switch (operation) {
    case 0: {
      const value = randomBetween(random, 1, 160)
      return { model: setLinkedEyeDimensionSafely(model, 'width', value), operation: `linked width=${value}` }
    }
    case 1: {
      const value = randomBetween(random, 1, 160)
      return { model: setLinkedEyeDimensionSafely(model, 'height', value), operation: `linked height=${value}` }
    }
    case 2: {
      const value = randomBetween(random, 0, 160)
      return { model: setAnchoredPairSpacingSafely(model, value), operation: `spacing=${value}` }
    }
    case 3: {
      const value = randomBetween(random, -45, 45)
      return { model: rotatePairSafely(model, value), operation: `rotation=${value}` }
    }
    case 4: {
      const value = randomBetween(random, -30, 30)
      return { model: setSharedExpressionGeometrySafely(model, 'tilt', value), operation: `tilt=${value}` }
    }
    case 5: {
      const value = randomBetween(random, 0.5, 1.5)
      return { model: setSharedExpressionGeometrySafely(model, 'heightScale', value), operation: `heightScale=${value}` }
    }
    case 6: {
      const key = randomChoice(random, ['upperLid', 'lowerLid'] as const)
      const value = randomBetween(random, 0, 0.9)
      return { model: setSharedLidSafely(model, key, value), operation: `${key}=${value}` }
    }
    case 7: {
      const requested = {
        x: randomBetween(random, -96, 96),
        y: randomBetween(random, -96, 96),
      }
      return {
        model: clampGaze({ ...model, gaze: requested }),
        operation: `gaze=${JSON.stringify(requested)}`,
      }
    }
    default: {
      const width = randomBetween(random, 32, 320)
      const height = randomBetween(random, 32, 240)
      return {
        model: resizeCanvasSafely(model, width, height),
        operation: `canvas=${width}x${height}`,
      }
    }
  }
}

describe('geometry combinatorial regression', () => {
  const scenarios = [
    { rotation: 0, spacing: 0, upperLid: 0, lowerLid: 0, tilt: 0, scale: 1 },
    { rotation: 25, spacing: 0, upperLid: 0, lowerLid: 0, tilt: 20, scale: 1.4 },
    { rotation: -25, spacing: 4, upperLid: 0.45, lowerLid: 0, tilt: -20, scale: 1.4 },
    { rotation: 20, spacing: 2, upperLid: 0, lowerLid: 0.45, tilt: 20, scale: 0.6 },
    { rotation: -15, spacing: 8, upperLid: 0.35, lowerLid: 0.35, tilt: 25, scale: 1.5 },
    { rotation: 30, spacing: 12, upperLid: 0.7, lowerLid: 0, tilt: -25, scale: 1.5 },
  ] as const

  for (const [index, scenario] of scenarios.entries()) {
    it(`keeps representative mixed case ${index + 1} valid`, () => {
      let model = createModel()
      model = setSharedLidSafely(model, 'upperLid', scenario.upperLid)
      model = setSharedLidSafely(model, 'lowerLid', scenario.lowerLid)
      model = setSharedExpressionGeometrySafely(model, 'heightScale', scenario.scale)
      model = setSharedExpressionGeometrySafely(model, 'tilt', scenario.tilt)
      model = rotatePairSafely(model, scenario.rotation)
      model = setAnchoredPairSpacingSafely(model, scenario.spacing)
      model = setLinkedEyeDimensionSafely(model, 'width', 44)
      model = setLinkedEyeDimensionSafely(model, 'height', 42)
      model = clampGaze({ ...model, gaze: { x: 24, y: -16 } })

      assertGeometryInvariants(model, `scenario=${JSON.stringify(scenario)}`)
    })
  }

  it('keeps independent dimension edits valid in a rotated/lidded state', () => {
    let model = createModel()
    model = setSharedLidSafely(model, 'upperLid', 0.4)
    model = setSharedExpressionGeometrySafely(model, 'tilt', 18)
    model = rotatePairSafely(model, 22)
    model = setIndependentEyeDimensionSafely(model, 'left', 'width', 52)
    model = setIndependentEyeDimensionSafely(model, 'right', 'height', 48)
    model = setAnchoredPairSpacingSafely(model, 0)
    model = clampGaze({ ...model, gaze: { x: -32, y: 18 } })

    assertGeometryInvariants(model, 'independent dimension regression')
  })
})

describe('geometry seeded fuzz', () => {
  for (const seed of FUZZ_SEEDS) {
    it(`preserves editor invariants for seed 0x${seed.toString(16)}`, () => {
      const random = mulberry32(seed)
      let model = createModel()
      const history: string[] = []

      for (let step = 0; step < STEPS_PER_SEED; step += 1) {
        const result = applyRandomSafeOperation(model, random)
        model = result.model
        history.push(result.operation)
        assertGeometryInvariants(
          model,
          `seed=0x${seed.toString(16)} step=${step} operation=${result.operation}\nhistory=${history.join(' -> ')}`,
        )
      }

      expect(history).toHaveLength(STEPS_PER_SEED)
    })
  }
})
