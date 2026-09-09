import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../../core/presets'
import {
  resolveTransientEffectFrame,
  type TransientEffectLayerDefinition,
  type TransientOverlay,
} from '../../animation'
import { renderFaceToSvg } from './index'

const sweat: TransientEffectLayerDefinition = {
  kind: 'transient-effect-layer',
  effects: [{
    kind: 'sweat',
    id: 'sweat:svg',
    enabled: true,
    dropCount: 3,
    minTargetY: 12,
    maxTargetY: 12,
  }],
}

describe('generic transient overlay svg rendering', () => {
  it('keeps byte-identical static output when no overlays are supplied', () => {
    const base = renderFaceToSvg(roboEyesPreset.model)
    expect(renderFaceToSvg(roboEyesPreset.model, { overlays: [] })).toBe(base)
  })

  it('renders resolved teardrops without sweat-specific renderer branches', () => {
    const frame = resolveTransientEffectFrame(sweat, [], roboEyesPreset.model, 60, 17)
    const svg = renderFaceToSvg(roboEyesPreset.model, { overlays: frame.overlays })

    expect(frame.overlays).toHaveLength(3)
    expect(svg.match(/data-transient-overlay=/g)).toHaveLength(3)
    expect(svg.match(/data-overlay-kind="teardrop"/g)).toHaveLength(3)
    expect(svg.match(/<path data-transient-overlay=/g)).toHaveLength(3)
    expect(svg).not.toContain('data-sweat')
  })

  it('still supports generic rounded-rect overlays independently of sweat', () => {
    const overlays: TransientOverlay[] = [{
      id: 'generic:flash',
      kind: 'rounded-rect',
      x: 2,
      y: 3,
      width: 8,
      height: 5,
      radius: 2,
      paint: { role: 'eye' },
    }]
    const svg = renderFaceToSvg(roboEyesPreset.model, { overlays })
    expect(svg).toContain('data-overlay-kind="rounded-rect"')
    expect(svg).toContain('<rect data-transient-overlay="generic:flash"')
  })
})
