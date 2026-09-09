import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { builtInPresets } from '../../core/presets'
import { ParameterPanel } from './ParameterPanel'

function renderPanel(): string {
  return renderToStaticMarkup(
    <ParameterPanel
      model={structuredClone(builtInPresets[0].model)}
      linkedEyes
      transparentBackground={false}
      pixelPerfect={false}
      onChange={vi.fn()}
      onLinkedEyesChange={vi.fn()}
      onSingleEyeLayoutChange={vi.fn()}
      onTransparentBackgroundChange={vi.fn()}
      onPixelPerfectChange={vi.fn()}
    />,
  )
}

describe('ParameterPanel display organization', () => {
  it('places Display first and includes all former Canvas and Display controls', () => {
    const html = renderPanel()
    const displayIndex = html.indexOf('>Display<')
    const eyesIndex = html.indexOf('>Eyes<')

    expect(displayIndex).toBeGreaterThan(-1)
    expect(eyesIndex).toBeGreaterThan(displayIndex)
    expect(html).not.toContain('>Canvas<')
    expect(html).toContain('Preview resolution preset')
    expect(html).toContain('Canvas width')
    expect(html).toContain('Canvas height')
    expect(html).toContain('Transparent')
    expect(html).toContain('Pixel perfect')
  })
})
