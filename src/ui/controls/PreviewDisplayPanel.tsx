import type { FaceModel } from '../../core/model'

type PreviewDisplayPanelProps = {
  model: FaceModel
  transparentBackground: boolean
  pixelPerfect: boolean
  onTransparentBackgroundChange: (value: boolean) => void
  onPixelPerfectChange: (value: boolean) => void
}

export function PreviewDisplayPanel({
  model,
  transparentBackground,
  pixelPerfect,
  onTransparentBackgroundChange,
  onPixelPerfectChange,
}: PreviewDisplayPanelProps) {
  return (
    <aside className="panel preview-display-panel" aria-label="Preview display settings">
      <div className="panel-heading preview-display-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Display</h2>
        </div>
        <div className="preview-display-size" aria-label={`Canvas size ${model.canvas.width} by ${model.canvas.height}`}>
          <span>Size</span>
          <strong>{model.canvas.width} × {model.canvas.height}</strong>
        </div>
      </div>

      <div className="preview-display-options">
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
    </aside>
  )
}
