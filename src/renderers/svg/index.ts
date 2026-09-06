import {
  resolveEyeExpression,
  resolveGazeReactiveHeightScale,
  type EyeGeometry,
  type FaceModel,
} from '../../core/model'

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
  const expression = resolveEyeExpression(model.expression, id)
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
  const inner = clamp01(expression.upperLidInner)
  const outer = clamp01(expression.upperLidOuter)
  const upperLeft = id === 'left' ? outer : inner
  const upperRight = id === 'left' ? inner : outer
  const lower = clamp01(expression.lowerLid)
  const curvature = clamp01(expression.lowerLidCurvature)
  const upperLeftY = y + scaledHeight * upperLeft
  const upperRightY = y + scaledHeight * upperRight
  const lowerY = y + scaledHeight * (1 - lower)
  const upperMidY = (upperLeftY + upperRightY) / 2
  const lowerMidY = Math.max(upperMidY, lowerY - scaledHeight * 0.5 * curvature)
  const expressionRotation = id === 'left' ? -expression.tilt : expression.tilt
  const rotation = geometry.rotation + expressionRotation
  const clipId = `eye-clip-${id}`
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
