import { useMemo } from 'react'
import type { TransientOverlay } from '../../animation'
import type { FaceModel } from '../../core/model'
import { renderFaceToSvg } from '../../renderers/svg'

type PreviewAreaProps = {
  model: FaceModel
  overlays?: readonly TransientOverlay[]
  transparentBackground: boolean
  pixelPerfect: boolean
}

export function PreviewArea({
  model,
  overlays = [],
  transparentBackground,
  pixelPerfect,
}: PreviewAreaProps) {
  const svg = useMemo(
    () => renderFaceToSvg(model, { transparentBackground, overlays }),
    [model, overlays, transparentBackground],
  )

  return (
    <section className="panel preview-panel" aria-label="Preview">
      <div className="preview-title-row" aria-hidden="true">
        <p className="eyebrow">Preview</p>
      </div>

      <div className={`preview-stage ${pixelPerfect ? 'pixel-perfect-stage' : 'scaled-stage'}`}>
        <div className={`preview-viewport ${pixelPerfect ? 'pixel-perfect' : 'scaled'}`}>
          <div className="preview-viewport-content">
            <div
              className="svg-preview"
              role="img"
              aria-label="Robot face SVG preview"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      </div>

      <details className="svg-source">
        <summary>Standalone SVG source</summary>
        <textarea readOnly value={svg} aria-label="Standalone SVG source" />
      </details>
    </section>
  )
}
