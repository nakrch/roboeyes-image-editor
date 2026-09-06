import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import {
  clampGaze,
  isGazeCanvasSafe,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import {
  anchoredPairSpacing,
  anchoredPairSpacingMax,
  anchoredPairSpacingMin,
  setAnchoredPairSpacingSafely,
  setSharedExpressionGeometrySafely,
  setSharedLidSafely,
} from './geometrySafety'
import { pairRotationCenter, resizeCanvasFromCenter, rotatePairSafely } from './modelEditing'

const SPACING_SEEDS = [0x13579bdf, 0x2468ace0, 0x51ac1e55, 0x5a9c1e77]
const OSCILLATION_CYCLES = 24
const FUZZ_STEPS = 64

function createModel(): FaceModel {
  return roboEyesToFaceModel(defaultRoboEyesPreset)
}

function pairAxis(model: FaceModel): { x: number; y: number } {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position
  const dx = right.x - left.x
  const dy = right.y - left.y
  const length = Math.hypot(dx, dy)
  return length > 1e-9 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 }
}

function assertSafe(model: FaceModel, context: string): void {
  if (!isGazeCanvasSafe(model)) {
    throw new Error(`spacing overflow\n${context}\nmodel=${JSON.stringify(model)}`)
  }
  if (visibleEyesOverlap(model)) {
    throw new Error(`spacing overlap\n${context}\nmodel=${JSON.stringify(model)}`)
  }
  const values = [
    model.canvas.width,
    model.canvas.height,
    model.gaze.x,
    model.gaze.y,
    model.leftEye.geometry.position.x,
    model.leftEye.geometry.position.y,
    model.rightEye.geometry.position.x,
    model.rightEye.geometry.position.y,
    anchoredPairSpacing(model),
  ]
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`non-finite spacing geometry\n${context}\nmodel=${JSON.stringify(model)}`)
  }
}

function applySpacing(model: FaceModel, requested: number): FaceModel {
  return clampGaze(setAnchoredPairSpacingSafely(model, requested))
}

function configureBase(config: {
  rotation: number
  tilt: number
  upperLid: number
  lowerLid: number
  heightScale: number
  gazeX: number
  gazeY: number
  canvasWidth?: number
  canvasHeight?: number
}): FaceModel {
  let model = createModel()
  if (config.canvasWidth || config.canvasHeight) {
    model = resizeCanvasFromCenter(
      model,
      config.canvasWidth ?? model.canvas.width,
      config.canvasHeight ?? model.canvas.height,
    )
  }
  model = setSharedLidSafely(model, 'upperLid', config.upperLid)
  model = setSharedLidSafely(model, 'lowerLid', config.lowerLid)
  model = setSharedExpressionGeometrySafely(model, 'heightScale', config.heightScale)
  model = setSharedExpressionGeometrySafely(model, 'tilt', config.tilt)
  model = rotatePairSafely(model, config.rotation)
  model = clampGaze({ ...model, gaze: { x: config.gazeX, y: config.gazeY } })
  model = applySpacing(model, anchoredPairSpacing(model))
  assertSafe(model, `spacing baseline config=${JSON.stringify(config)}`)
  return model
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

describe('Eye spacing stress', () => {
  const cases = [
    { rotation: 0, tilt: 0, upperLid: 0, lowerLid: 0, heightScale: 1, gazeX: 0, gazeY: 0 },
    // Extreme tilt/scale needs a larger canvas so a non-overlapping spacing interval actually exists.
    { rotation: 28, tilt: 24, upperLid: 0, lowerLid: 0, heightScale: 1.45, gazeX: 18, gazeY: -10, canvasWidth: 240, canvasHeight: 128 },
    { rotation: -28, tilt: -24, upperLid: 0.45, lowerLid: 0, heightScale: 1.4, gazeX: -20, gazeY: 12, canvasWidth: 192, canvasHeight: 96 },
    { rotation: 22, tilt: -26, upperLid: 0, lowerLid: 0.5, heightScale: 0.65, gazeX: 20, gazeY: 10 },
    { rotation: -18, tilt: 27, upperLid: 0.35, lowerLid: 0.35, heightScale: 1.5, gazeX: -12, gazeY: -12, canvasWidth: 192, canvasHeight: 96 },
  ] as const

  for (const [index, config] of cases.entries()) {
    it(`clamps min/max boundaries without overlap in case ${index + 1}`, () => {
      let model = configureBase(config)
      const center = pairRotationCenter(model)
      const axis = pairAxis(model)
      const minimum = anchoredPairSpacingMin(model)
      const maximum = anchoredPairSpacingMax(model)
      expect(minimum).toBeLessThanOrEqual(maximum)
      const probes = [minimum - 50, minimum, minimum + 1e-4, (minimum + maximum) / 2, maximum, maximum + 50]

      for (const requested of probes) {
        model = applySpacing(model, requested)
        assertSafe(model, `case=${index + 1} requested=${requested}`)
        const nextCenter = pairRotationCenter(model)
        const nextAxis = pairAxis(model)
        expect(nextCenter.x).toBeCloseTo(center.x, 7)
        expect(nextCenter.y).toBeCloseTo(center.y, 7)
        expect(nextAxis.x).toBeCloseTo(axis.x, 7)
        expect(nextAxis.y).toBeCloseTo(axis.y, 7)
      }
    })

    it(`does not accumulate center/axis drift during repeated spacing oscillation in case ${index + 1}`, () => {
      let model = configureBase(config)
      const originalCenter = pairRotationCenter(model)
      const originalAxis = pairAxis(model)

      for (let cycle = 0; cycle < OSCILLATION_CYCLES; cycle += 1) {
        const minimum = anchoredPairSpacingMin(model)
        const maximum = anchoredPairSpacingMax(model)
        expect(minimum).toBeLessThanOrEqual(maximum)
        model = applySpacing(model, cycle % 2 === 0 ? minimum - 20 : maximum + 20)
        assertSafe(model, `case=${index + 1} cycle=${cycle}`)
      }

      const finalCenter = pairRotationCenter(model)
      const finalAxis = pairAxis(model)
      expect(finalCenter.x).toBeCloseTo(originalCenter.x, 6)
      expect(finalCenter.y).toBeCloseTo(originalCenter.y, 6)
      expect(finalAxis.x).toBeCloseTo(originalAxis.x, 6)
      expect(finalAxis.y).toBeCloseTo(originalAxis.y, 6)
    })
  }

  for (const seed of SPACING_SEEDS) {
    it(`survives seeded spacing-heavy sequence 0x${seed.toString(16)}`, () => {
      const random = mulberry32(seed)
      let model = createModel()
      const history: string[] = []

      for (let step = 0; step < FUZZ_STEPS; step += 1) {
        if (step % 4 === 0) {
          const tilt = randomBetween(random, -28, 28)
          model = clampGaze(setSharedExpressionGeometrySafely(model, 'tilt', tilt))
          history.push(`tilt=${tilt}`)
        } else if (step % 7 === 0) {
          const rotation = randomBetween(random, -32, 32)
          model = clampGaze(rotatePairSafely(model, rotation))
          history.push(`rotation=${rotation}`)
        } else if (step % 9 === 0) {
          const upper = randomBetween(random, 0, 0.7)
          const lower = randomBetween(random, 0, Math.max(0, 0.8 - upper))
          model = clampGaze(setSharedLidSafely(model, 'upperLid', upper))
          model = clampGaze(setSharedLidSafely(model, 'lowerLid', lower))
          history.push(`lids=${upper}/${lower}`)
        } else {
          const minimum = anchoredPairSpacingMin(model)
          const maximum = anchoredPairSpacingMax(model)
          const requested = step % 3 === 0
            ? minimum - randomBetween(random, 0, 30)
            : step % 3 === 1
              ? maximum + randomBetween(random, 0, 30)
              : randomBetween(random, minimum, Math.max(minimum, maximum))
          model = applySpacing(model, requested)
          history.push(`spacing=${requested}`)
        }

        // Re-assert spacing after non-spacing geometry edits before validating this spacing-focused suite.
        model = applySpacing(model, anchoredPairSpacing(model))
        assertSafe(
          model,
          `seed=0x${seed.toString(16)} step=${step}\nhistory=${history.join(' -> ')}`,
        )
      }
    })
  }
})
