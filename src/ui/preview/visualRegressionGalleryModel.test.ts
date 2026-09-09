import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets'
import { phase2ExpressionVisualFixtures } from '../../renderers/svg/__fixtures__/phase2Expressions'
import {
  GALLERY_MOTION_PREVIEW_CYCLE_MS,
  applyGallerySelection,
  isInteractiveGalleryFixture,
  sampleFixtureMotionPreview,
  selectionForFixture,
} from './visualRegressionGalleryModel'

function fixture(id: string) {
  const value = phase2ExpressionVisualFixtures.find((candidate) => candidate.id === id)
  if (!value) throw new Error(`Missing fixture ${id}`)
  return value
}

describe('interactive visual regression gallery model', () => {
  it('keeps regression-only fixtures visible but non-interactive', () => {
    expect(isInteractiveGalleryFixture(fixture('curious-center-128x64'))).toBe(false)
    expect(isInteractiveGalleryFixture(fixture('happy-240x240'))).toBe(false)
    expect(isInteractiveGalleryFixture(fixture('curious-left-128x64'))).toBe(true)
    expect(isInteractiveGalleryFixture(fixture('happy-128x64'))).toBe(true)
  })

  it('applies a square fixture expression without changing the editor canvas', () => {
    const current = roboEyesToFaceModel({ ...defaultRoboEyesPreset, canvasWidth: 320, canvasHeight: 120 })
    const selected = applyGallerySelection(current, selectionForFixture(fixture('happy-240x240')))

    expect(selected.canvas).toEqual({ width: 320, height: 120 })
    expect(selected.expression).not.toEqual(current.expression)
  })

  it('keeps current gaze when Curious is applied as expression only', () => {
    const current = roboEyesToFaceModel({ ...defaultRoboEyesPreset, gazeX: 9, gazeY: -4 })
    const selected = applyGallerySelection(current, selectionForFixture(fixture('curious-left-128x64')))

    expect(selected.gaze).toEqual(current.gaze)
    expect(selectionForFixture(fixture('curious-left-128x64')).presetId).toBe('expression:curious')
  })

  it('applies Curious fixture gaze only through the explicit gaze selection', () => {
    const current = roboEyesToFaceModel(defaultRoboEyesPreset)
    const curiousLeft = fixture('curious-left-128x64')
    const selected = applyGallerySelection(current, selectionForFixture(curiousLeft, true))

    expect(selected.gaze).toEqual(curiousLeft.gaze)
  })

  it('treats the asymmetric fixture as custom without creating preset identity', () => {
    const selection = selectionForFixture(fixture('asymmetric-custom-128x64'))

    expect(selection.presetId).toBe('custom')
    expect(selection.gaze).toBeUndefined()
  })

  it('samples card motion deterministically and loops by logical time', () => {
    const happy = fixture('happy-128x64')
    const first = sampleFixtureMotionPreview(happy, 175)
    const repeated = sampleFixtureMotionPreview(happy, 175 + GALLERY_MOTION_PREVIEW_CYCLE_MS)

    expect(repeated).toEqual(first)
  })

  it('does not mutate the fixture while sampling motion', () => {
    const curious = fixture('curious-right-128x64')
    const before = structuredClone(curious)

    sampleFixtureMotionPreview(curious, 700)

    expect(curious).toEqual(before)
  })
})
