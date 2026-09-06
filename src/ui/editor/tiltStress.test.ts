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
  anchoredPairSpacingMin,
  setAnchoredPairSpacingSafely,
  setSharedExpressionGeometrySafely,
  setSharedLidSafely,
  setSideExpressionGeometrySafely,
} from './geometrySafety'
import { pairRotationCenter, resizeCanvasFromCenter, rotatePairSafely } from './modelEditing'

const TILT_SEEDS = [0x71a71001, 0x71a71002, 0x71a71003, 0x71a71004]
const TILT_SWEEP = [-30, -29.9, -24, -12, 0, 12, 24, 29.9, 30] as const
const OSCILLATION_CYCLES = 32
const FUZZ_STEPS = 72

function createModel(): FaceModel {
  return roboEyesToFaceModel(defaultRoboEyesPreset)
}

function assertSafe(model: FaceModel, context: string): void {
  if (!isGazeCanvasSafe(model)) {
    throw new Error(`tilt overflow\n${context}\nmodel=${JSON.stringify(model)}`)
  }
  if (visibleEyesOverlap(model)) {
    throw new Error(`tilt overlap\n${context}\nmodel=${JSON.stringify(model)}`)
  }
  const values = [
    model.expression.tilt,
    model.expression.leftEye?.tilt ?? 0,
    model.expression.rightEye?.tilt ?? 0,
    model.leftEye.geometry.position.x,
    model.leftEye.geometry.position.y,
    model.rightEye.geometry.position.x,
    model.rightEye.geometry.position.y,
    model.gaze.x,
    model.gaze.y,
  ]
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`non-finite tilt geometry\n${context}\nmodel=${JSON.stringify(model)}`)
  }
}

function applySharedTilt(model: FaceModel, requested: number): FaceModel {
  return clampGaze(setSharedExpressionGeometrySafely(model, 'tilt', requested))
}

function applySideTilt(model: FaceModel, side: 'left' | 'right', requested: number): FaceModel {
  return clampGaze(setSideExpressionGeometrySafely(model, side, 'tilt', requested))
}

function prepare(config: {
  rotation: number
  upperLid: number
  lowerLid: number
  heightScale: number
  spacingOffset: number
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
  model = rotatePairSafely(model, config.rotation)
  model = clampGaze(model)
  const minimum = anchoredPairSpacingMin(model)
  model = clampGaze(setAnchoredPairSpacingSafely(model, minimum + config.spacingOffset))
  assertSafe(model, `tilt baseline=${JSON.stringify(config)}`)
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

describe('Expression tilt stress', () => {
  const cases = [
    { rotation: 0, upperLid: 0, lowerLid: 0, heightScale: 1, spacingOffset: 0.5 },
    { rotation: 24, upperLid: 0, lowerLid: 0, heightScale: 1.35, spacingOffset: 1, canvasWidth: 220, canvasHeight: 120 },
    { rotation: -26, upperLid: 0.45, lowerLid: 0, heightScale: 1.45, spacingOffset: 0.5, canvasWidth: 220, canvasHeight: 120 },
    { rotation: 20, upperLid: 0, lowerLid: 0.5, heightScale: 0.65, spacingOffset: 0.25 },
    { rotation: -18, upperLid: 0.35, lowerLid: 0.35, heightScale: 1.5, spacingOffset: 0.5, canvasWidth: 192, canvasHeight: 96 },
  ] as const

  for (const [index, config] of cases.entries()) {
    it(`keeps shared tilt sweep safe in case ${index + 1}`, () => {
      let model = prepare(config)
      const center = pairRotationCenter(model)
      const leftPosition = { ...model.leftEye.geometry.position }
      const rightPosition = { ...model.rightEye.geometry.position }

      for (const requested of TILT_SWEEP) {
        model = applySharedTilt(model, requested)
        assertSafe(model, `case=${index + 1} shared tilt=${requested}`)
        const nextCenter = pairRotationCenter(model)
        expect(nextCenter.x).toBeCloseTo(center.x, 7)
        expect(nextCenter.y).toBeCloseTo(center.y, 7)
        expect(model.leftEye.geometry.position.x).toBeCloseTo(leftPosition.x, 7)
        expect(model.leftEye.geometry.position.y).toBeCloseTo(leftPosition.y, 7)
        expect(model.rightEye.geometry.position.x).toBeCloseTo(rightPosition.x, 7)
        expect(model.rightEye.geometry.position.y).toBeCloseTo(rightPosition.y, 7)
      }
    })

    it(`does not accumulate geometry drift during shared tilt oscillation in case ${index + 1}`, () => {
      let model = prepare(config)
      const center = pairRotationCenter(model)
      const spacing = anchoredPairSpacing(model)

      for (let cycle = 0; cycle < OSCILLATION_CYCLES; cycle += 1) {
        model = applySharedTilt(model, cycle % 2 === 0 ? 30 : -30)
        assertSafe(model, `case=${index + 1} shared cycle=${cycle}`)
      }

      const finalCenter = pairRotationCenter(model)
      expect(finalCenter.x).toBeCloseTo(center.x, 7)
      expect(finalCenter.y).toBeCloseTo(center.y, 7)
      expect(anchoredPairSpacing(model)).toBeCloseTo(spacing, 7)
    })
  }

  it('keeps independent left/right tilt sweeps safe near minimum spacing', () => {
    let model = prepare({
      rotation: 22,
      upperLid: 0.25,
      lowerLid: 0.1,
      heightScale: 1.25,
      spacingOffset: 1,
      canvasWidth: 220,
      canvasHeight: 120,
    })
    const center = pairRotationCenter(model)
    const spacing = anchoredPairSpacing(model)

    for (const leftTilt of TILT_SWEEP) {
      model = applySideTilt(model, 'left', leftTilt)
      assertSafe(model, `independent left=${leftTilt}`)
      for (const rightTilt of [-30, 0, 30] as const) {
        model = applySideTilt(model, 'right', rightTilt)
        assertSafe(model, `independent left=${leftTilt} right=${rightTilt}`)
      }
    }

    const finalCenter = pairRotationCenter(model)
    expect(finalCenter.x).toBeCloseTo(center.x, 7)
    expect(finalCenter.y).toBeCloseTo(center.y, 7)
    expect(anchoredPairSpacing(model)).toBeCloseTo(spacing, 7)
  })

  for (const seed of TILT_SEEDS) {
    it(`survives seeded tilt-heavy sequence 0x${seed.toString(16)}`, () => {
      const random = mulberry32(seed)
      let model = prepare({
        rotation: randomBetween(random, -24, 24),
        upperLid: randomBetween(random, 0, 0.35),
        lowerLid: randomBetween(random, 0, 0.25),
        heightScale: randomBetween(random, 0.75, 1.35),
        spacingOffset: randomBetween(random, 0.25, 4),
        canvasWidth: 220,
        canvasHeight: 120,
      })
      const history: string[] = []

      for (let step = 0; step < FUZZ_STEPS; step += 1) {
        if (step % 6 === 0) {
          const minimum = anchoredPairSpacingMin(model)
          const request = minimum + randomBetween(random, 0.1, 6)
          model = clampGaze(setAnchoredPairSpacingSafely(model, request))
          history.push(`spacing=${request}`)
        } else if (step % 11 === 0) {
          const rotation = randomBetween(random, -28, 28)
          model = clampGaze(rotatePairSafely(model, rotation))
          history.push(`rotation=${rotation}`)
        } else if (step % 13 === 0) {
          const scale = randomBetween(random, 0.65, 1.45)
          model = clampGaze(setSharedExpressionGeometrySafely(model, 'heightScale', scale))
          history.push(`scale=${scale}`)
        } else if (step % 5 === 0) {
          const side = random() < 0.5 ? 'left' : 'right'
          const tilt = randomBetween(random, -30, 30)
          model = applySideTilt(model, side, tilt)
          history.push(`${side} tilt=${tilt}`)
        } else {
          const tilt = randomBetween(random, -30, 30)
          model = applySharedTilt(model, tilt)
          history.push(`shared tilt=${tilt}`)
        }

        assertSafe(
          model,
          `seed=0x${seed.toString(16)} step=${step}\nhistory=${history.join(' -> ')}`,
        )
      }
    })
  }
})
