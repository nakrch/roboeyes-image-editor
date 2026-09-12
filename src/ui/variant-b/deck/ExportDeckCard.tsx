import { useEffect, useState } from 'react'
import { minimumCanvasSize, type FaceModel } from '../../../core/model'
import {
  animatedExportLimitations,
  encodeAnimatedGif,
  encodeAnimatedWebp,
  rasterizeAnimationExportFrames,
  type AnimatedExportFrameResolver,
} from '../../../export/animatedAssets'
import {
  downloadBlob,
  renderExportPng,
  renderExportSvg,
  svgToBlob,
} from '../../../export/staticAssets'
import { resizeCanvasFromCenter } from '../../editor/modelEditing'
import { useToast } from '../../feedback/ToastProvider'
import {
  firstGifValidationError,
  firstStaticValidationError,
  firstWebpValidationError,
  parseNumberDraft,
  validateExportNumericDrafts,
  type NumberDraft,
} from '../../export/exportNumericValidation'
import { TactileSlider } from '../controls/TactileSlider'

type ExportDeckCardProps = {
  model: FaceModel
  transparentBackground: boolean
  resolveAnimationFrame: AnimatedExportFrameResolver
  onChange: (updater: (current: FaceModel) => FaceModel) => void
  onTransparentBackgroundChange: (value: boolean) => void
}

const resolutionPresets = [
  { key: '128x64', label: '128 × 64 (OLED)', width: 128, height: 64 },
  { key: '128x128', label: '128 × 128 (Square)', width: 128, height: 128 },
  { key: '240x240', label: '240 × 240 (Round/LCD)', width: 240, height: 240 },
  { key: '320x240', label: '320 × 240 (QVGA)', width: 320, height: 240 },
  { key: '320x320', label: '320 × 320 (Square HD)', width: 320, height: 320 },
  { key: 'custom', label: 'Custom Dimension', width: 0, height: 0 },
] as const

const CANVAS_MIN = 16
const CANVAS_MAX = 640

export function ExportDeckCard({
  model,
  transparentBackground,
  resolveAnimationFrame,
  onChange,
  onTransparentBackgroundChange,
}: ExportDeckCardProps) {
  const currentResolutionKey =
    resolutionPresets.find(
      (preset) => preset.width === model.canvas.width && preset.height === model.canvas.height,
    )?.key ?? 'custom'

  const [exportWidth, setExportWidth] = useState<NumberDraft>(model.canvas.width)
  const [exportHeight, setExportHeight] = useState<NumberDraft>(model.canvas.height)
  const [durationMs, setDurationMs] = useState<NumberDraft>(2000)
  const [fps, setFps] = useState<NumberDraft>(20)
  const [loopCount, setLoopCount] = useState<NumberDraft>(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useToast()

  const requiredCanvas = minimumCanvasSize(model)
  const minCanvasWidth = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(requiredCanvas.width)))
  const minCanvasHeight = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(requiredCanvas.height)))

  useEffect(() => {
    setExportWidth(model.canvas.width)
    setExportHeight(model.canvas.height)
  }, [model.canvas.width, model.canvas.height])

  const applyResolution = (key: string) => {
    const preset = resolutionPresets.find((candidate) => candidate.key === key)
    if (preset && preset.key !== 'custom') {
      onChange((current) => {
        const minimum = minimumCanvasSize(current)
        return resizeCanvasFromCenter(
          current,
          Math.max(preset.width, Math.ceil(minimum.width)),
          Math.max(preset.height, Math.ceil(minimum.height)),
        )
      })
    }
  }

  const exportSvg = () => {
    const validation = validateExportNumericDrafts({
      width: exportWidth,
      height: exportHeight,
      durationMs,
      fps,
      loopCount,
    })
    const validationError = firstStaticValidationError(validation)
    if (validationError) {
      setError(validationError)
      return
    }

    const targetWidth = parseNumberDraft(exportWidth, model.canvas.width)
    const targetHeight = parseNumberDraft(exportHeight, model.canvas.height)
    setError('')
    const svg = renderExportSvg(model, {
      transparentBackground,
      targetWidth,
      targetHeight,
    })
    downloadBlob(svgToBlob(svg), 'roboeyes-face.svg')
    notify({
      title: 'SVG Handed Off',
      message: `Exported ${targetWidth}×${targetHeight} SVG.`,
      variant: 'info',
    })
  }

  const exportPng = async () => {
    const validation = validateExportNumericDrafts({
      width: exportWidth,
      height: exportHeight,
      durationMs,
      fps,
      loopCount,
    })
    const validationError = firstStaticValidationError(validation)
    if (validationError) {
      setError(validationError)
      return
    }

    const targetWidth = parseNumberDraft(exportWidth, model.canvas.width)
    const targetHeight = parseNumberDraft(exportHeight, model.canvas.height)
    setError('')
    setBusy(true)
    try {
      const blob = await renderExportPng(model, {
        transparentBackground,
        targetWidth,
        targetHeight,
      })
      downloadBlob(blob, 'roboeyes-face.png')
      notify({
        title: 'PNG Handed Off',
        message: `Exported ${targetWidth}×${targetHeight} PNG.`,
        variant: 'info',
      })
    } catch {
      setError('Failed to export PNG.')
    } finally {
      setBusy(false)
    }
  }

  const exportWebp = async () => {
    const validation = validateExportNumericDrafts({
      width: exportWidth,
      height: exportHeight,
      durationMs,
      fps,
      loopCount,
    })
    const validationError = firstWebpValidationError(validation)
    if (validationError) {
      setError(validationError)
      return
    }

    const targetWidth = parseNumberDraft(exportWidth, model.canvas.width)
    const targetHeight = parseNumberDraft(exportHeight, model.canvas.height)
    const targetDuration = parseNumberDraft(durationMs, 2000)
    const targetFps = parseNumberDraft(fps, 20)
    const targetLoop = parseNumberDraft(loopCount, 0)

    setError('')
    setBusy(true)
    try {
      const frames = await rasterizeAnimationExportFrames(model, {
        targetWidth,
        targetHeight,
        durationMs: targetDuration,
        fps: targetFps,
        transparentBackground,
        resolveAnimationFrame,
      })
      const webpBlob = await encodeAnimatedWebp(frames, {
        loopCount: targetLoop,
      })
      downloadBlob(webpBlob, 'roboeyes-animation.webp')
      notify({
        title: 'WebP Handed Off',
        message: `Exported animated WebP (${targetWidth}×${targetHeight}, ${targetFps}fps).`,
        variant: 'info',
      })
    } catch {
      setError('Failed to encode animated WebP.')
    } finally {
      setBusy(false)
    }
  }

  const exportGif = async () => {
    const validation = validateExportNumericDrafts({
      width: exportWidth,
      height: exportHeight,
      durationMs,
      fps,
      loopCount,
    })
    const validationError = firstGifValidationError(validation)
    if (validationError) {
      setError(validationError)
      return
    }

    const targetWidth = parseNumberDraft(exportWidth, model.canvas.width)
    const targetHeight = parseNumberDraft(exportHeight, model.canvas.height)
    const targetDuration = parseNumberDraft(durationMs, 2000)
    const targetFps = parseNumberDraft(fps, 20)
    const targetLoop = parseNumberDraft(loopCount, 0)

    setError('')
    setBusy(true)
    try {
      const frames = await rasterizeAnimationExportFrames(model, {
        targetWidth,
        targetHeight,
        durationMs: targetDuration,
        fps: targetFps,
        transparentBackground,
        resolveAnimationFrame,
      })
      const gifBlob = await encodeAnimatedGif(frames, {
        loopCount: targetLoop,
      })
      downloadBlob(gifBlob, 'roboeyes-animation.gif')
      notify({
        title: 'GIF Handed Off',
        message: `Exported animated GIF (${targetWidth}×${targetHeight}, ${targetFps}fps).`,
        variant: 'info',
      })
    } catch {
      setError('Failed to encode animated GIF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vb-deck-card vb-export-card" aria-label="Export & Display Settings">
      {/* Canvas Display Setup */}
      <div className="vb-card-section">
        <div className="vb-section-label">CANVAS DISPLAY RESOLUTION</div>
        <div className="vb-res-grid">
          {resolutionPresets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`vb-res-preset-btn ${currentResolutionKey === preset.key ? 'active' : ''}`}
              onClick={() => applyResolution(preset.key)}
            >
              <span className="vb-res-label">{preset.label}</span>
            </button>
          ))}
        </div>

        <div className="vb-sliders-grid" style={{ marginTop: '12px' }}>
          <TactileSlider
            label="Canvas Width"
            value={model.canvas.width}
            min={minCanvasWidth}
            max={CANVAS_MAX}
            unit="px"
            onChange={(val) =>
              onChange((cur) => {
                const minimum = Math.max(CANVAS_MIN, Math.ceil(minimumCanvasSize(cur).width))
                return resizeCanvasFromCenter(cur, Math.max(val, minimum), cur.canvas.height)
              })
            }
          />
          <TactileSlider
            label="Canvas Height"
            value={model.canvas.height}
            min={minCanvasHeight}
            max={CANVAS_MAX}
            unit="px"
            onChange={(val) =>
              onChange((cur) => {
                const minimum = Math.max(CANVAS_MIN, Math.ceil(minimumCanvasSize(cur).height))
                return resizeCanvasFromCenter(cur, cur.canvas.width, Math.max(val, minimum))
              })
            }
          />
        </div>

        <div className="vb-checkbox-row" style={{ marginTop: '10px' }}>
          <label className="vb-checkbox-label">
            <input
              type="checkbox"
              checked={transparentBackground}
              onChange={(e) => onTransparentBackgroundChange(e.target.checked)}
            />
            <span>Transparent Canvas Background</span>
          </label>
        </div>
      </div>

      {/* Static Export */}
      <div className="vb-card-section">
        <div className="vb-section-label">STATIC IMAGE EXPORT</div>
        <div className="vb-export-btn-row">
          <button
            type="button"
            className="vb-export-action-btn"
            disabled={busy}
            onClick={exportSvg}
          >
            ⚡ Export SVG (Vector)
          </button>
          <button
            type="button"
            className="vb-export-action-btn"
            disabled={busy}
            onClick={exportPng}
          >
            🖼 Export PNG (Raster)
          </button>
        </div>
      </div>

      {/* Animated Export */}
      <div className="vb-card-section">
        <div className="vb-section-label">ANIMATED ASSET EXPORT</div>
        <div className="vb-sliders-grid">
          <TactileSlider
            label="Duration"
            value={Number(durationMs)}
            min={200}
            max={animatedExportLimitations.maxDurationMs}
            step={100}
            unit="ms"
            onChange={(val) => setDurationMs(val)}
          />
          <TactileSlider
            label="Framerate"
            value={Number(fps)}
            min={5}
            max={animatedExportLimitations.maxFps}
            step={1}
            unit="fps"
            onChange={(val) => setFps(val)}
          />
          <TactileSlider
            label="Loop Count (0 = infinite)"
            value={Number(loopCount)}
            min={0}
            max={50}
            step={1}
            unit=""
            onChange={(val) => setLoopCount(val)}
          />
        </div>

        {error && <div className="vb-error-banner" role="alert">{error}</div>}

        <div className="vb-export-btn-row" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="vb-export-action-btn vb-btn-accent"
            disabled={busy}
            onClick={exportWebp}
          >
            {busy ? 'Encoding WebP...' : '🎬 Export Animated WebP'}
          </button>
          <button
            type="button"
            className="vb-export-action-btn vb-btn-accent"
            disabled={busy}
            onClick={exportGif}
          >
            {busy ? 'Encoding GIF...' : '🎞 Export Animated GIF'}
          </button>
        </div>
      </div>
    </div>
  )
}
