import {
  resolveEyeExpression,
  resolveEyeLidAperture,
  resolveGazeReactiveHeightScale,
  type EyeGeometry,
  type FaceModel,
} from '../../core/model'
import type { TransientOverlay, TransientOverlayPaint } from '../../animation/transientEffects'

export type SvgRenderOptions = {
  transparentBackground?: boolean
  /** Optional stable prefix for inline-SVG definition IDs to avoid document-level collisions. */
  idPrefix?: string
  /** Optional renderer-independent overlays resolved by the animation/effect layer. */
  overlays?: readonly TransientOverlay[]
}

type RenderedEye = {
  clipPath: string
  shape: string
}

function number(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number(value.toFixed(4)).toString()
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function sanitizeIdPrefix(value: string | undefined): string {
  return value?.trim().replace(/[^A-Za-z0-9_-]+/g, '-') ?? ''
}

function renderEye(
  id: 'left' | 'right',
  geometry: EyeGeometry,
  model: FaceModel,
  idPrefix: string,
): RenderedEye {
  const centerX = geometry.position.x + model.gaze.x
  const centerY = geometry.position.y + model.gaze.y
  const expression = resolveEyeExpression(model.expression, id)
  const aperture = resolveEyeLidAperture(model.expression, id)
  const effectiveHeightScale = resolveGazeReactiveHeightScale(
    model.expression,
    id,
    model.gaze.x,
    model.canvas.width,
  )
  const scaledHeight = geometry.height * effectiveHeightScale
  const x = centerX - geometry.width / 2
  const y = centerY - scaledHeight / 2
  const radius = Math.max(
    0,
    Math.min(geometry.cornerRadius, geometry.width / 2, scaledHeight / 2),
  )
  const upperLeftY = y + scaledHeight * aperture.upperLeft
  const upperRightY = y + scaledHeight * aperture.upperRight
  const lowerY = y + scaledHeight * aperture.lower
  const lowerMidY = y + scaledHeight * aperture.lowerMid
  const expressionRotation = id === 'left' ? -expression.tilt : expression.tilt
  const rotation = geometry.rotation + expressionRotation
  const clipId = `${idPrefix ? `${idPrefix}-` : ''}eye-clip-${id}`
  const stroke = model.colors.stroke ?? model.colors.eye
  const aperturePath = [
    `M ${number(x)} ${number(upperLeftY)}`,
    `L ${number(x + geometry.width)} ${number(upperRightY)}`,
    `L ${number(x + geometry.width)} ${number(lowerY)}`,
    `Q ${number(centerX)} ${number(lowerMidY)} ${number(x)} ${number(lowerY)}`,
    'Z',
  ].join(' ')

  return {
    clipPath: `<clipPath id="${clipId}"><path data-eye-aperture="${id}" d="${aperturePath}" /></clipPath>`,
    shape: `<rect data-eye="${id}" x="${number(x)}" y="${number(y)}" width="${number(geometry.width)}" height="${number(scaledHeight)}" rx="${number(radius)}" ry="${number(radius)}" fill="${escapeAttribute(model.colors.eye)}" stroke="${escapeAttribute(stroke)}" stroke-width="1" clip-path="url(#${clipId})" transform="rotate(${number(rotation)} ${number(centerX)} ${number(centerY)})" />`,
  }
}

function overlayPaint(paint: TransientOverlayPaint, model: FaceModel): string {
  if ('value' in paint) return paint.value
  switch (paint.role) {
    case 'eye': return model.colors.eye
    case 'stroke': return model.colors.stroke ?? model.colors.eye
    case 'background': return model.colors.background
  }
}

function renderOverlay(overlay: TransientOverlay, model: FaceModel): string {
  const opacity = overlay.opacity === undefined ? 1 : Math.min(1, Math.max(0, overlay.opacity))
  return `<rect data-transient-overlay="${escapeAttribute(overlay.id)}" data-overlay-kind="${overlay.kind}" x="${number(overlay.x)}" y="${number(overlay.y)}" width="${number(overlay.width)}" height="${number(overlay.height)}" rx="${number(overlay.radius)}" ry="${number(overlay.radius)}" fill="${escapeAttribute(overlayPaint(overlay.paint, model))}" opacity="${number(opacity)}" />`
}

export function renderFaceToSvg(
  model: FaceModel,
  options: SvgRenderOptions = {},
): string {
  const width = Math.max(0, model.canvas.width)
  const height = Math.max(0, model.canvas.height)
  const idPrefix = sanitizeIdPrefix(options.idPrefix)
  const left = renderEye('left', model.leftEye.geometry, model, idPrefix)
  const right = renderEye('right', model.rightEye.geometry, model, idPrefix)
  const background = options.transparentBackground
    ? ''
    : `<rect data-background="true" x="0" y="0" width="${number(width)}" height="${number(height)}" fill="${escapeAttribute(model.colors.background)}" />`
  const overlays = (options.overlays ?? []).map((overlay) => renderOverlay(overlay, model)).join('')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="0 0 ${number(width)} ${number(height)}">`,
    background,
    `<defs>${left.clipPath}${right.clipPath}</defs>`,
    left.shape,
    right.shape,
    overlays,
    '</svg>',
  ].join('')
}
