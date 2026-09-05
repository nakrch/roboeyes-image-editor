import { useMemo } from 'react'
import type { FaceModel } from '../../core/model'
import { renderFaceToSvg } from '../../renderers/svg'

type PreviewAreaProps = {
  model: FaceModel
  transparentBackground: boolean
  pixelPerfect: boolean
  onTransparentBackgroundChange: (value: boolean) => void
  onPixelPerfectChange: (value: boolean) => void
}

export function PreviewArea({
  model,
  transparentBackground,
  pixelPerfect,
  onTransparentBackgroundChange,
  onPixelPerfectChange,
}: PreviewAreaProps) {
  const svg = useMemo(
    () => renderFaceToSvg(model, { transparentBackground }),
    [model, transparentBackground],
  )

  return (
    <section className="panel preview-panel" aria-label="Preview">
      <div className="preview-header-row">
        <div className="panel-heading">
          <p className="eyebrow">Preview</p>
          <h2>
            {model.canvas.width} × {model.canvas.height}
          </h2>
        </div>

        <div className="preview-options" aria-label="Preview modes">
          <label>
            <input
              type="checkbox"
              checked={transparentBackground}
              onChange={(event) => onTransparentBackgroundChange(event.target.checked)}
            />
            Transparent
          </label>
          <label>
            <input
              type="checkbox"
              checked={pixelPerfect}
              onChange={(event) => onPixelPerfectChange(event.target.checked)}
            />
            Pixel perfect
          </label>
        </div>
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
