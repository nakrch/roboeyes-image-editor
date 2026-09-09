import { useMemo } from 'react'
import type { FaceModel } from '../../core/model'
import { renderFaceToSvg } from '../../renderers/svg'

type PreviewAreaProps = {
  model: FaceModel
  transparentBackground: boolean
  pixelPerfect: boolean
}

export function PreviewArea({
  model,
  transparentBackground,
  pixelPerfect,
}: PreviewAreaProps) {
  const svg = useMemo(
    () => renderFaceToSvg(model, { transparentBackground }),
    [model, transparentBackground],
  )

  return (
    <section className="panel preview-panel" aria-label="Preview">
      <div className="preview-title-row" aria-hidden="true">
        <p className="eyebrow">Preview</p>
      </div>

      <div className="preview-stage">
        <div
          className={`svg-preview ${pixelPerfect ? 'pixel-perfect' : 'scaled'}`}
          style={
            pixelPerfect
              ? { width: model.canvas.width, height: model.canvas.height }
              : { aspectRatio: `${model.canvas.width} / ${model.canvas.height}` }
          }
          role="img"
          aria-label="Robot face SVG preview"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <details className="svg-source">
        <summary>Standalone SVG source</summary>
        <textarea readOnly value={svg} aria-label="Standalone SVG source" />
      </details>
    </section>
  )
}
