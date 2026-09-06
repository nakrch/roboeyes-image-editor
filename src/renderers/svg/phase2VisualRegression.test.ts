import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import type { ExpressionModel, FaceModel } from '../../core/model'
import { defaultRoboEyesPreset, expressionPresets } from '../../core/presets'
import { renderExportSvg } from '../../export/staticAssets'
import { renderFaceToSvg } from './index'
import {
  phase2ExpressionVisualFixtures,
  type Phase2ExpressionVisualFixture,
} from './__fixtures__/phase2Expressions'

function expressionForFixture(fixture: Phase2ExpressionVisualFixture): ExpressionModel {
  if (fixture.expression) return structuredClone(fixture.expression)
  const preset = expressionPresets.find((candidate) => candidate.name === fixture.presetName)
  if (!preset) throw new Error(`Missing expression preset for fixture ${fixture.id}`)
  return structuredClone(preset.expression)
}

function modelForFixture(fixture: Phase2ExpressionVisualFixture): FaceModel {
  const base = roboEyesToFaceModel({
    ...defaultRoboEyesPreset,
    canvasWidth: fixture.canvas.width,
    canvasHeight: fixture.canvas.height,
    gazeX: fixture.gaze.x,
    gazeY: fixture.gaze.y,
  })
  return {
    ...base,
    expression: expressionForFixture(fixture),
  }
}

function aperturePath(svg: string, side: 'left' | 'right'): string {
  const path = svg.match(new RegExp(`data-eye-aperture="${side}" d="([^"]+)"`))?.[1]
  if (!path) throw new Error(`Missing ${side} aperture path`)
  return path
}

function eyeTransform(svg: string, side: 'left' | 'right'): string {
  const transform = svg.match(new RegExp(`data-eye="${side}"[^>]* transform="([^"]+)"`))?.[1]
  if (!transform) throw new Error(`Missing ${side} eye transform`)
  return transform
}

function upperEdgeYs(path: string): [number, number] {
  const match = path.match(/^M [-\d.]+ ([-\d.]+) L [-\d.]+ ([-\d.]+)/)
  if (!match) throw new Error(`Unable to parse upper edge from ${path}`)
  return [Number(match[1]), Number(match[2])]
}

function lowerCurveY(path: string): { edge: number; control: number } {
  const match = path.match(/L [-\d.]+ ([-\d.]+) Q [-\d.]+ ([-\d.]+)/)
  if (!match) throw new Error(`Unable to parse lower curve from ${path}`)
  return { edge: Number(match[1]), control: Number(match[2]) }
}

describe('Phase 2 expression visual regression fixtures', () => {
  it('covers every built-in expression preset', () => {
    const coveredPresetNames = new Set(
      phase2ExpressionVisualFixtures
        .map((fixture) => fixture.presetName)
        .filter((name): name is string => Boolean(name)),
    )
    expect([...coveredPresetNames].sort()).toEqual(
      expressionPresets.map((preset) => preset.name).sort(),
    )
  })

  for (const fixture of phase2ExpressionVisualFixtures) {
    it(`matches ${fixture.id}`, () => {
      const model = modelForFixture(fixture)
      const previewSvg = renderFaceToSvg(model)
      const exportSvg = renderExportSvg(model)

      expect(previewSvg).toBe(renderFaceToSvg(model))
      expect(exportSvg).toBe(previewSvg)
      expect(previewSvg).toContain(
        `width="${fixture.canvas.width}" height="${fixture.canvas.height}" viewBox="0 0 ${fixture.canvas.width} ${fixture.canvas.height}"`,
      )
      expect(aperturePath(previewSvg, 'left')).toBe(fixture.expected.leftPath)
      expect(aperturePath(previewSvg, 'right')).toBe(fixture.expected.rightPath)
      expect(eyeTransform(previewSvg, 'left')).toBe(fixture.expected.leftTransform)
      expect(eyeTransform(previewSvg, 'right')).toBe(fixture.expected.rightTransform)
    })
  }

  it('locks RoboEyes-compatible tired and angry mirrored-lid orientation', () => {
    const tired = phase2ExpressionVisualFixtures.find((fixture) => fixture.id === 'tired-128x64')!
    const angry = phase2ExpressionVisualFixtures.find((fixture) => fixture.id === 'angry-128x64')!

    const tiredLeft = upperEdgeYs(tired.expected.leftPath)
    const tiredRight = upperEdgeYs(tired.expected.rightPath)
    const angryLeft = upperEdgeYs(angry.expected.leftPath)
    const angryRight = upperEdgeYs(angry.expected.rightPath)

    // Tired covers the physical outer corners more deeply.
    expect(tiredLeft[0]).toBeGreaterThan(tiredLeft[1])
    expect(tiredRight[1]).toBeGreaterThan(tiredRight[0])

    // Angry is the mirrored opposite: physical inner corners are covered more deeply.
    expect(angryLeft[1]).toBeGreaterThan(angryLeft[0])
    expect(angryRight[0]).toBeGreaterThan(angryRight[1])
  })

  it('locks the rounded lower cut used by Happy', () => {
    const happy = phase2ExpressionVisualFixtures.find((fixture) => fixture.id === 'happy-128x64')!
    const left = lowerCurveY(happy.expected.leftPath)
    const right = lowerCurveY(happy.expected.rightPath)

    expect(left.control).toBeLessThan(left.edge)
    expect(right.control).toBeLessThan(right.edge)
  })

  it('covers left, center, and right Curious deformation', () => {
    const left = phase2ExpressionVisualFixtures.find((fixture) => fixture.id === 'curious-left-128x64')!
    const center = phase2ExpressionVisualFixtures.find((fixture) => fixture.id === 'curious-center-128x64')!
    const right = phase2ExpressionVisualFixtures.find((fixture) => fixture.id === 'curious-right-128x64')!

    expect(left.expected.leftPath).not.toBe(center.expected.leftPath)
    expect(left.expected.rightPath).not.toBe(center.expected.rightPath)
    expect(right.expected.leftPath).not.toBe(center.expected.leftPath)
    expect(right.expected.rightPath).not.toBe(center.expected.rightPath)

    const leftActive = upperEdgeYs(left.expected.leftPath)
    const leftInactive = upperEdgeYs(left.expected.rightPath)
    const rightInactive = upperEdgeYs(right.expected.leftPath)
    const rightActive = upperEdgeYs(right.expected.rightPath)
    expect(leftActive[0]).toBeLessThan(leftInactive[0])
    expect(rightActive[0]).toBeLessThan(rightInactive[0])
  })

  it('keeps the independent custom expression visibly asymmetric', () => {
    const custom = phase2ExpressionVisualFixtures.find(
      (fixture) => fixture.id === 'asymmetric-custom-128x64',
    )!
    expect(custom.expected.leftPath).not.toBe(custom.expected.rightPath)
    expect(custom.expected.leftTransform).not.toBe(custom.expected.rightTransform)
  })

  it('includes a square-canvas visual reference', () => {
    const square = phase2ExpressionVisualFixtures.find((fixture) => fixture.id === 'happy-240x240')!
    expect(square.canvas).toEqual({ width: 240, height: 240 })
  })
})
