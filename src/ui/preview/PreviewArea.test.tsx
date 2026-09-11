import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../../core/presets'
import { PreviewArea } from './PreviewArea'

const model = {
  ...roboEyesPreset.model,
  canvas: {
    width: 640,
    height: 480,
  },
}

describe('PreviewArea', () => {
  it('renders pixel-perfect mode at the authored canvas size inside a scrollable stage', () => {
    const html = renderToStaticMarkup(
      <PreviewArea model={model} transparentBackground={false} pixelPerfect />,
    )

    expect(html).toContain('preview-stage pixel-perfect-stage')
    expect(html).toContain('svg-preview pixel-perfect')
    expect(html).toContain('width:640px')
    expect(html).toContain('height:480px')
  })

  it('leaves scaled preview sizing to the viewport CSS', () => {
    const html = renderToStaticMarkup(
      <PreviewArea model={model} transparentBackground={false} pixelPerfect={false} />,
    )

    expect(html).toContain('preview-stage scaled-stage')
    expect(html).toContain('svg-preview scaled')
    expect(html).not.toContain('width:640px')
    expect(html).not.toContain('height:480px')
  })
})
