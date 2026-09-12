import { useMemo, useState } from 'react'
import type { TransientOverlay } from '../../../animation'
import type { FaceModel } from '../../../core/model'
import { renderFaceToSvg } from '../../../renderers/svg'

type DeviceStageProps = {
  model: FaceModel
  overlays?: readonly TransientOverlay[]
  transparentBackground: boolean
  pixelPerfect: boolean
  onTransparentBackgroundChange: (transparent: boolean) => void
  onPixelPerfectChange: (pixelPerfect: boolean) => void
}

type ZoomMode = 'fit' | '1x' | '2x' | '3x' | '4x'

export function DeviceStage({
  model,
  overlays = [],
  transparentBackground,
  pixelPerfect,
  onTransparentBackgroundChange,
  onPixelPerfectChange,
}: DeviceStageProps) {
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit')
  const [showBezel, setShowBezel] = useState(true)
  const [showSvgSource, setShowSvgSource] = useState(false)

  const svg = useMemo(
    () => renderFaceToSvg(model, { transparentBackground, overlays }),
    [model, overlays, transparentBackground],
  )

  const zoomScale = useMemo(() => {
    switch (zoomMode) {
      case '1x':
        return 1
      case '2x':
        return 2
      case '3x':
        return 3
      case '4x':
        return 4
      case 'fit':
      default:
        return null
    }
  }, [zoomMode])

  const stageStyle = useMemo(() => {
    if (zoomScale !== null) {
      return {
        width: `${model.canvas.width * zoomScale}px`,
        height: `${model.canvas.height * zoomScale}px`,
      }
    }
    return {
      aspectRatio: `${model.canvas.width} / ${model.canvas.height}`,
      maxWidth: '100%',
      maxHeight: '100%',
    }
  }, [zoomScale, model.canvas.width, model.canvas.height])

  return (
    <section className="vb-device-stage-section" aria-label="Device Stage Preview">
      <header className="vb-stage-toolbar">
        <div className="vb-stage-meta">
          <span className="vb-stage-tag">STAGE</span>
          <span className="vb-stage-resolution">
            {model.canvas.width} × {model.canvas.height} px
          </span>
        </div>

        <div className="vb-stage-controls">
          <div className="vb-zoom-selector" role="radiogroup" aria-label="Zoom scale">
            {(['fit', '1x', '2x', '3x', '4x'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`vb-zoom-btn ${zoomMode === mode ? 'active' : ''}`}
                onClick={() => setZoomMode(mode)}
                aria-checked={zoomMode === mode}
                role="radio"
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="vb-stage-toggles">
            <button
              type="button"
              className={`vb-icon-toggle ${pixelPerfect ? 'active' : ''}`}
              onClick={() => onPixelPerfectChange(!pixelPerfect)}
              title={pixelPerfect ? 'Pixel Perfect: Enabled' : 'Pixel Perfect: Disabled'}
              aria-pressed={pixelPerfect}
            >
              ⊞ Crisp
            </button>
            <button
              type="button"
              className={`vb-icon-toggle ${transparentBackground ? 'active' : ''}`}
              onClick={() => onTransparentBackgroundChange(!transparentBackground)}
              title={transparentBackground ? 'Transparent Background' : 'Solid Background'}
              aria-pressed={transparentBackground}
            >
              ▦ Alpha
            </button>
            <button
              type="button"
              className={`vb-icon-toggle ${showBezel ? 'active' : ''}`}
              onClick={() => setShowBezel(!showBezel)}
              title={showBezel ? 'Hide Bezel' : 'Show Bezel'}
              aria-pressed={showBezel}
            >
              ▣ Bezel
            </button>
          </div>
        </div>
      </header>

      <div className="vb-stage-viewport">
        <div
          className={`vb-hardware-bezel ${showBezel ? 'has-bezel' : 'bezel-less'}`}
          style={{ aspectRatio: zoomScale === null ? `${model.canvas.width} / ${model.canvas.height}` : undefined }}
        >
          {showBezel && (
            <div className="vb-bezel-screws" aria-hidden="true">
              <span className="vb-screw top-left" />
              <span className="vb-screw top-right" />
              <span className="vb-screw bottom-left" />
              <span className="vb-screw bottom-right" />
            </div>
          )}

          <div
            className={`vb-display-glass ${transparentBackground ? 'checker-bg' : 'solid-bg'} ${
              pixelPerfect ? 'crisp-render' : ''
            }`}
          >
            <div
              className="vb-svg-canvas-container"
              style={stageStyle}
              role="img"
              aria-label="Robot face live canvas"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>

          {showBezel && (
            <div className="vb-bezel-footer">
              <span className="vb-display-spec">
                ROBOEYES DISP // {model.canvas.width}x{model.canvas.height}
              </span>
              <span className="vb-display-status-led active" />
            </div>
          )}
        </div>
      </div>

      <div className="vb-stage-drawer-footer">
        <button
          type="button"
          className="vb-code-toggle-btn"
          onClick={() => setShowSvgSource(!showSvgSource)}
          aria-expanded={showSvgSource}
        >
          {showSvgSource ? '▲ Hide SVG Source' : '▼ Standalone SVG Source'}
        </button>

        {showSvgSource && (
          <div className="vb-svg-source-box">
            <textarea
              readOnly
              value={svg}
              aria-label="Standalone SVG Source"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
        )}
      </div>
    </section>
  )
}
