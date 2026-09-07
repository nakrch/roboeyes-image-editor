import type { ExpressionModel } from '../../../core/model'

export type Phase2ExpressionVisualFixture = {
  id: string
  presetName?: string
  expression?: ExpressionModel
  canvas: { width: number; height: number }
  gaze: { x: number; y: number }
  expected: {
    leftPath: string
    rightPath: string
    leftTransform: string
    rightTransform: string
  }
}

const canvas128x64 = { width: 128, height: 64 } as const
const centeredGaze = { x: 0, y: 0 } as const

/**
 * Textual visual-reference fixtures for deterministic Phase 2 expression geometry.
 *
 * These signatures intentionally lock the SVG aperture path plus eye transform rather
 * than raster pixels. That keeps diffs reviewable while still covering the visible lid
 * cuts, gaze-reactive height, asymmetry, and expression tilt produced by the renderer.
 */
export const phase2ExpressionVisualFixtures: readonly Phase2ExpressionVisualFixture[] = [
  {
    id: 'neutral-128x64',
    presetName: 'Neutral',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 14 L 58 14 L 58 50 Q 40 50 22 50 Z',
      rightPath: 'M 70 14 L 106 14 L 106 50 Q 88 50 70 50 Z',
      leftTransform: 'rotate(0 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'happy-128x64',
    presetName: 'Happy',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 14 L 58 14 L 58 39.92 Q 40 32 22 39.92 Z',
      rightPath: 'M 70 14 L 106 14 L 106 39.92 Q 88 32 70 39.92 Z',
      leftTransform: 'rotate(0 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'tired-128x64',
    presetName: 'Tired',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 32 L 58 14 L 58 50 Q 40 50 22 50 Z',
      rightPath: 'M 70 14 L 106 32 L 106 50 Q 88 50 70 50 Z',
      leftTransform: 'rotate(0 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'angry-128x64',
    presetName: 'Angry',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 14 L 58 32 L 58 50 Q 40 50 22 50 Z',
      rightPath: 'M 70 32 L 106 14 L 106 50 Q 88 50 70 50 Z',
      leftTransform: 'rotate(0 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'curious-left-128x64',
    presetName: 'Curious',
    canvas: canvas128x64,
    gaze: { x: -20, y: 0 },
    expected: {
      leftPath: 'M 2 13.2275 L 38 13.2275 L 38 50.7725 Q 20 50.7725 2 50.7725 Z',
      rightPath: 'M 50 14 L 86 14 L 86 50 Q 68 50 50 50 Z',
      leftTransform: 'rotate(0 20 32)',
      rightTransform: 'rotate(0 68 32)',
    },
  },
  {
    id: 'curious-center-128x64',
    presetName: 'Curious',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 14 L 58 14 L 58 50 Q 40 50 22 50 Z',
      rightPath: 'M 70 14 L 106 14 L 106 50 Q 88 50 70 50 Z',
      leftTransform: 'rotate(0 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'curious-right-128x64',
    presetName: 'Curious',
    canvas: canvas128x64,
    gaze: { x: 20, y: 0 },
    expected: {
      leftPath: 'M 42 14 L 78 14 L 78 50 Q 60 50 42 50 Z',
      rightPath: 'M 90 13.2275 L 126 13.2275 L 126 50.7725 Q 108 50.7725 90 50.7725 Z',
      leftTransform: 'rotate(0 60 32)',
      rightTransform: 'rotate(0 108 32)',
    },
  },
  {
    id: 'surprised-128x64',
    presetName: 'Surprised',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 10.04 L 58 10.04 L 58 53.96 Q 40 53.96 22 53.96 Z',
      rightPath: 'M 70 10.04 L 106 10.04 L 106 53.96 Q 88 53.96 70 53.96 Z',
      leftTransform: 'rotate(0 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'sad-128x64',
    presetName: 'Sad',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 24.3824 L 58 17.096 L 58 46.5728 Q 40 44.5856 22 46.5728 Z',
      rightPath: 'M 70 17.096 L 106 24.3824 L 106 46.5728 Q 88 44.5856 70 46.5728 Z',
      leftTransform: 'rotate(-6 40 32)',
      rightTransform: 'rotate(6 88 32)',
    },
  },
  {
    id: 'suspicious-128x64',
    presetName: 'Suspicious',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 26.9456 L 58 24.6992 L 58 44.9168 Q 40 44.9168 22 44.9168 Z',
      rightPath: 'M 70 19.76 L 106 16.16 L 106 48.56 Q 88 48.56 70 48.56 Z',
      leftTransform: 'rotate(-2 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'serious-128x64',
    presetName: 'Serious',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 21.632 L 58 21.632 L 58 45.608 Q 40 45.608 22 45.608 Z',
      rightPath: 'M 70 21.632 L 106 21.632 L 106 45.608 Q 88 45.608 70 45.608 Z',
      leftTransform: 'rotate(0 40 32)',
      rightTransform: 'rotate(0 88 32)',
    },
  },
  {
    id: 'irritated-128x64',
    presetName: 'Irritated',
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 20.2352 L 58 28.2848 L 58 45.0032 Q 40 45.0032 22 45.0032 Z',
      rightPath: 'M 70 28.2848 L 106 20.2352 L 106 45.0032 Q 88 45.0032 70 45.0032 Z',
      leftTransform: 'rotate(2 40 32)',
      rightTransform: 'rotate(-2 88 32)',
    },
  },
  {
    id: 'asymmetric-custom-128x64',
    expression: {
      upperLid: 0.1,
      lowerLid: 0.08,
      lowerLidCurvature: 0.2,
      tilt: 0,
      leftEye: { upperLidInner: 0.35, tilt: -4 },
      rightEye: { upperLidOuter: 0.25, lowerLid: 0.22, heightScale: 0.9, tilt: 5 },
    },
    canvas: canvas128x64,
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 22 17.6 L 58 30.2 L 58 47.12 Q 40 43.52 22 47.12 Z',
      rightPath: 'M 70 19.04 L 106 27.14 L 106 41.072 Q 88 37.832 70 41.072 Z',
      leftTransform: 'rotate(4 40 32)',
      rightTransform: 'rotate(5 88 32)',
    },
  },
  {
    id: 'happy-240x240',
    presetName: 'Happy',
    canvas: { width: 240, height: 240 },
    gaze: centeredGaze,
    expected: {
      leftPath: 'M 78 102 L 114 102 L 114 127.92 Q 96 120 78 127.92 Z',
      rightPath: 'M 126 102 L 162 102 L 162 127.92 Q 144 120 126 127.92 Z',
      leftTransform: 'rotate(0 96 120)',
      rightTransform: 'rotate(0 144 120)',
    },
  },
]
