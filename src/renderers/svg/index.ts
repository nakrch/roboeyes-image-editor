import type { EyeGeometry, FaceModel } from '../../core/model'

export type SvgRenderOptions = {
  transparentBackground?: boolean
}

type RenderedEye = {
  clipPath: string
  shape: string
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

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

function renderEye(
  id: 'left' | 'right',
  geometry: EyeGeometry,
  model: FaceModel,
): RenderedEye {
  const centerX = geometry.position.x + model.gaze.x
  const centerY = geometry.position.y + model.gaze.y
  const x = centerX - geometry.width / 2
  const y = centerY - geometry.height / 2
  const radius = Math.max(
    0,
    Math.min(geometry.cornerRadius, geometry.width / 2, geometry.height / 2),
  )
  const upper = clamp01(model.expression.upperLid)
  const lower = clamp01(model.expression.lowerLid)
  const visibleY = y + geometry.height * upper
  const visibleHeight = Math.max(0, geometry.height * (1 - upper - lower))
  const expressionRotation = id === 'left' ? -model.expression.tilt : model.expression.tilt
  const rotation = geometry.rotation + expressionRotation
  const clipId = `eye-clip-${id}`
  const stroke = model.colors.stroke ?? model.colors.eye

  return {
    clipPath: `<clipPath id="${clipId}"><rect x="${number(x)}" y="${number(visibleY)}" width="${number(geometry.width)}" height="${number(visibleHeight)}" /></clipPath>`,
    shape: `<rect data-eye="${id}" x="${number(x)}" y="${number(y)}" width="${number(geometry.width)}" height="${number(geometry.height)}" rx="${number(radius)}" ry="${number(radius)}" fill="${escapeAttribute(model.colors.eye)}" stroke="${escapeAttribute(stroke)}" stroke-width="1" clip-path="url(#${clipId})" transform="rotate(${number(rotation)} ${number(centerX)} ${number(centerY)})" />`,
  }
}

export function renderFaceToSvg(
  model: FaceModel,
  options: SvgRenderOptions = {},
): string {
  const width = Math.max(0, model.canvas.width)
  const height = Math.max(0, model.canvas.height)
  const left = renderEye('left', model.leftEye.geometry, model)
  const right = renderEye('right', model.rightEye.geometry, model)
  const background = options.transparentBackground
    ? ''
    : `<rect data-background="true" x="0" y="0" width="${number(width)}" height="${number(height)}" fill="${escapeAttribute(model.colors.background)}" />`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="0 0 ${number(width)} ${number(height)}">`,
    background,
    `<defs>${left.clipPath}${right.clipPath}</defs>`,
    left.shape,
    right.shape,
    '</svg>',
  ].join('')
}
