import {
  displayMaskCircle,
  isEyeVisible,
  resolveEyeExpression,
  resolveEyeLidAperture,
  resolveGazeReactiveHeightScale,
  resolveLensStrength,
  warpPointThroughLens,
  type EyeGeometry,
  type DisplayMask,
  type FaceModel,
  type Point,
} from '../../core/model'
import type { TransientOverlay, TransientOverlayPaint } from '../../animation/transientEffects'

export type SvgRenderOptions = {
  transparentBackground?: boolean
  clipToDisplayMask?: DisplayMask
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

function sampledEyePath(points: Point[], centerX: number, centerY: number, rotation: number, model: FaceModel, strength: number): string {
  const angle = rotation * Math.PI / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return points.map((point, index) => {
    const dx = point.x - centerX
    const dy = point.y - centerY
    const warped = warpPointThroughLens({
      x: centerX + dx * cosine - dy * sine,
      y: centerY + dx * sine + dy * cosine,
    }, model.canvas, strength)
    return `${index === 0 ? 'M' : 'L'} ${number(warped.x)} ${number(warped.y)}`
  }).join(' ') + ' Z'
}

function pushSampledLine(points: Point[], start: Point, end: Point): void {
  const segments = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2))
  for (let i = 0; i < segments; i += 1) {
    const t = i / segments
    points.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
  }
}

function sampledRoundedRect(x: number, y: number, width: number, height: number, radius: number): Point[] {
  const points: Point[] = []
  const arc = (cx: number, cy: number, start: number) => {
    for (let i = 0; i < 8; i += 1) {
      const angle = start + i * Math.PI / 16
      points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
    }
  }
  if (radius === 0) {
    pushSampledLine(points, { x, y }, { x: x + width, y })
    pushSampledLine(points, { x: x + width, y }, { x: x + width, y: y + height })
    pushSampledLine(points, { x: x + width, y: y + height }, { x, y: y + height })
    pushSampledLine(points, { x, y: y + height }, { x, y })
  } else {
    pushSampledLine(points, { x: x + radius, y }, { x: x + width - radius, y })
    arc(x + width - radius, y + radius, -Math.PI / 2)
    pushSampledLine(points, { x: x + width, y: y + radius }, { x: x + width, y: y + height - radius })
    arc(x + width - radius, y + height - radius, 0)
    pushSampledLine(points, { x: x + width - radius, y: y + height }, { x: x + radius, y: y + height })
    arc(x + radius, y + height - radius, Math.PI / 2)
    pushSampledLine(points, { x, y: y + height - radius }, { x, y: y + radius })
    arc(x + radius, y + radius, Math.PI)
  }
  return points
}

function sampledAperture(x: number, right: number, upperLeftY: number, upperRightY: number, lowerY: number, centerX: number, lowerMidY: number): Point[] {
  const points: Point[] = []
  pushSampledLine(points, { x, y: upperLeftY }, { x: right, y: upperRightY })
  pushSampledLine(points, { x: right, y: upperRightY }, { x: right, y: lowerY })
  for (let i = 0; i < 16; i += 1) {
    const t = i / 16
    points.push({
      x: (1 - t) ** 2 * right + 2 * (1 - t) * t * centerX + t ** 2 * x,
      y: (1 - t) ** 2 * lowerY + 2 * (1 - t) * t * lowerMidY + t ** 2 * lowerY,
    })
  }
  pushSampledLine(points, { x, y: lowerY }, { x, y: upperLeftY })
  return points
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
  const lensStrength = resolveLensStrength(model)
  if (lensStrength > 0 && model.canvas.width > 0 && model.canvas.height > 0) {
    const outline = sampledEyePath(sampledRoundedRect(x, y, geometry.width, scaledHeight, radius), centerX, centerY, rotation, model, lensStrength)
    const opening = sampledEyePath(sampledAperture(x, x + geometry.width, upperLeftY, upperRightY, lowerY, centerX, lowerMidY), centerX, centerY, rotation, model, lensStrength)
    return {
      clipPath: `<clipPath id="${clipId}"><path data-eye-aperture="${id}" d="${opening}" /></clipPath>`,
      shape: `<path data-eye="${id}" d="${outline}" fill="${escapeAttribute(model.colors.eye)}" stroke="${escapeAttribute(stroke)}" stroke-width="1" clip-path="url(#${clipId})" />`,
    }
  }
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

function renderTeardropPath(overlay: Extract<TransientOverlay, { kind: 'teardrop' }>): string {
  const x = overlay.x
  const y = overlay.y
  const width = overlay.width
  const height = overlay.height
  const centerX = x + width / 2
  const bottomY = y + height
  const roundness = Math.min(1, Math.max(0, overlay.roundness))
  const shoulderY = y + height * (0.32 + 0.08 * roundness)
  const sideY = y + height * (0.62 - 0.08 * roundness)
  const lowerControlY = y + height * (0.92 + 0.04 * roundness)
  const innerX = width * (0.2 + 0.05 * roundness)

  return [
    `M ${number(centerX)} ${number(y)}`,
    `C ${number(centerX - width * 0.05)} ${number(y + height * 0.14)} ${number(x)} ${number(shoulderY)} ${number(x)} ${number(sideY)}`,
    `C ${number(x)} ${number(lowerControlY)} ${number(centerX - innerX)} ${number(bottomY)} ${number(centerX)} ${number(bottomY)}`,
    `C ${number(centerX + innerX)} ${number(bottomY)} ${number(x + width)} ${number(lowerControlY)} ${number(x + width)} ${number(sideY)}`,
    `C ${number(x + width)} ${number(shoulderY)} ${number(centerX + width * 0.05)} ${number(y + height * 0.14)} ${number(centerX)} ${number(y)}`,
    'Z',
  ].join(' ')
}

function renderOverlay(overlay: TransientOverlay, model: FaceModel): string {
  const opacity = overlay.opacity === undefined ? 1 : Math.min(1, Math.max(0, overlay.opacity))
  const common = `data-transient-overlay="${escapeAttribute(overlay.id)}" data-overlay-kind="${overlay.kind}" fill="${escapeAttribute(overlayPaint(overlay.paint, model))}" opacity="${number(opacity)}"`

  switch (overlay.kind) {
    case 'rounded-rect':
      return `<rect ${common} x="${number(overlay.x)}" y="${number(overlay.y)}" width="${number(overlay.width)}" height="${number(overlay.height)}" rx="${number(overlay.radius)}" ry="${number(overlay.radius)}" />`
    case 'teardrop':
      return `<path ${common} d="${renderTeardropPath(overlay)}" />`
  }
}

export function renderFaceToSvg(
  model: FaceModel,
  options: SvgRenderOptions = {},
): string {
  const width = Math.max(0, model.canvas.width)
  const height = Math.max(0, model.canvas.height)
  const idPrefix = sanitizeIdPrefix(options.idPrefix)
  const left = isEyeVisible(model, 'left')
    ? renderEye('left', model.leftEye.geometry, model, idPrefix)
    : undefined
  const right = isEyeVisible(model, 'right')
    ? renderEye('right', model.rightEye.geometry, model, idPrefix)
    : undefined
  const background = options.transparentBackground
    ? ''
    : `<rect data-background="true" x="0" y="0" width="${number(width)}" height="${number(height)}" fill="${escapeAttribute(model.colors.background)}" />`
  const overlays = (options.overlays ?? []).map((overlay) => renderOverlay(overlay, model)).join('')

  const clipCircle = options.clipToDisplayMask === 'circle' ? displayMaskCircle(model.canvas) : undefined
  const clipId = `${idPrefix}display-mask`
  const maskDefinition = clipCircle
    ? `<clipPath id="${clipId}"><circle cx="${number(clipCircle.cx)}" cy="${number(clipCircle.cy)}" r="${number(clipCircle.r)}" /></clipPath>`
    : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="0 0 ${number(width)} ${number(height)}">`,
    clipCircle ? '' : background,
    `<defs>${left?.clipPath ?? ''}${right?.clipPath ?? ''}${maskDefinition}</defs>`,
    clipCircle ? `<g clip-path="url(#${clipId})">${background}${left?.shape ?? ''}${right?.shape ?? ''}${overlays}</g>` : `${left?.shape ?? ''}${right?.shape ?? ''}${overlays}`,
    '</svg>',
  ].join('')
}
