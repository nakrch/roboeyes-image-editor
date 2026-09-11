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
  it('keeps pixel-perfect sizing on the SVG intrinsic dimensions instead of wrapper styles', () => {
    const html = renderToStaticMarkup(
      <PreviewArea model={model} transparentBackground={false} pixelPerfect />,
    )

    expect(html).toContain('preview-stage pixel-perfect-stage')
    expect(html).toContain('preview-viewport pixel-perfect')
    expect(html).toContain('preview-viewport-content')
    expect(html).toContain('class="svg-preview"')
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">')
    expect(html).not.toContain('style="width:640px')
    expect(html).not.toContain('height:480px')
  })

  it('uses the same fixed viewport wrapper in scaled mode', () => {
    const html = renderToStaticMarkup(
      <PreviewArea model={model} transparentBackground={false} pixelPerfect={false} />,
    )

    expect(html).toContain('preview-stage scaled-stage')
    expect(html).toContain('preview-viewport scaled')
    expect(html).toContain('preview-viewport-content')
    expect(html).toContain('class="svg-preview"')
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">')
  })
})
