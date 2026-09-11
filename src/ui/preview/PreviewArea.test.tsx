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
  it('renders pixel-perfect canvas at authored size inside a separate fixed viewport', () => {
    const html = renderToStaticMarkup(
      <PreviewArea model={model} transparentBackground={false} pixelPerfect />,
    )

    expect(html).toContain('preview-stage pixel-perfect-stage')
    expect(html).toContain('preview-viewport pixel-perfect')
    expect(html).toContain('preview-viewport-content')
    expect(html).toContain('class="svg-preview"')
    expect(html).toContain('width:640px')
    expect(html).toContain('height:480px')
  })

  it('uses the same viewport wrapper in scaled mode without authored pixel dimensions', () => {
    const html = renderToStaticMarkup(
      <PreviewArea model={model} transparentBackground={false} pixelPerfect={false} />,
    )

    expect(html).toContain('preview-stage scaled-stage')
    expect(html).toContain('preview-viewport scaled')
    expect(html).toContain('preview-viewport-content')
    expect(html).toContain('class="svg-preview"')
    expect(html).not.toContain('width:640px')
    expect(html).not.toContain('height:480px')
  })
})
