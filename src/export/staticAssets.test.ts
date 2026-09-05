import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../core/presets/roboeyes'
import { renderExportSvg } from './staticAssets'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

describe('static asset export', () => {
  it('keeps configured canvas dimensions by default', () => {
    const model = createModel()
    const svg = renderExportSvg(model)

    expect(svg).toContain('width="128"')
    expect(svg).toContain('height="64"')
    expect(svg).toContain('viewBox="0 0 128 64"')
  })

  it('supports explicit export dimensions while preserving the source viewBox', () => {
    const model = createModel()
    const svg = renderExportSvg(model, { dimensions: { width: 320, height: 160 } })

    expect(svg).toContain('width="320"')
    expect(svg).toContain('height="160"')
    expect(svg).toContain('viewBox="0 0 128 64"')
  })

  it('preserves transparent background selection', () => {
    const model = createModel()
    const svg = renderExportSvg(model, { transparentBackground: true })

    expect(svg).not.toContain('data-background="true"')
  })
})
