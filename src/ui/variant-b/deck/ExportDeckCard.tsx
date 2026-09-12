import { useEffect, useState } from 'react'
import { minimumCanvasSize, type FaceModel } from '../../../core/model'
import {
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
    const values = validation.staticValues
    if (values === null) {
      const err = firstStaticValidationError(validation)
      setError(err)
      notify('error', err)
      return
    }

    setError('')
    const staticOptions = { dimensions: values, transparentBackground }
    const baseName = `roboeyes-${values.width}x${values.height}`
    try {
      const svg = renderExportSvg(model, staticOptions)
      downloadBlob(svgToBlob(svg), `${baseName}.svg`)
      notify('success', 'Downloading SVG…')
    } catch {
      const msg = 'Could not export SVG in this browser.'
      setError(msg)
      notify('error', msg)
    }
  }

  const exportPng = async () => {
    const validation = validateExportNumericDrafts({
      width: exportWidth,
      height: exportHeight,
      durationMs,
      fps,
      loopCount,
    })
    const values = validation.staticValues
    if (values === null) {
      const err = firstStaticValidationError(validation)
      setError(err)
      notify('error', err)
      return
    }

    setError('')
    setBusy(true)
    const staticOptions = { dimensions: values, transparentBackground }
    const baseName = `roboeyes-${values.width}x${values.height}`
    try {
      const png = await renderExportPng(model, staticOptions)
      downloadBlob(png, `${baseName}.png`)
      notify('success', 'Downloading PNG…')
    } catch {
      const msg = 'Could not export PNG in this browser.'
      setError(msg)
      notify('error', msg)
    } finally {
      setBusy(false)
    }
  }

  const exportAnimation = async (format: 'gif' | 'webp') => {
    const validation = validateExportNumericDrafts({
      width: exportWidth,
      height: exportHeight,
      durationMs,
      fps,
      loopCount,
    })
    const values = format === 'gif' ? validation.gifValues : validation.webpValues
    if (values === null) {
      const err = format === 'gif'
        ? firstGifValidationError(validation)
        : firstWebpValidationError(validation)
      setError(err)
      notify('error', err)
      return
    }

    setError('')
    setBusy(true)
    const dimensions = { width: values.width, height: values.height }
    const baseName = `roboeyes-${dimensions.width}x${dimensions.height}`
    const animationOptions = {
      dimensions,
      transparentBackground,
      durationMs: values.durationMs,
      fps: values.fps,
      ...(format === 'gif' ? { loopCount: validation.gifValues!.loopCount } : {}),
    }

    try {
      const frames = await rasterizeAnimationExportFrames(animationOptions, resolveAnimationFrame)
      const blob = format === 'gif'
        ? await encodeAnimatedGif(frames, animationOptions)
        : await encodeAnimatedWebp(frames, animationOptions)
      downloadBlob(blob, `${baseName}.${format}`)
      notify('success', `Downloading ${format.toUpperCase()}…`)
    } catch {
      const msg = `Could not export animated ${format.toUpperCase()} in this browser.`
      setError(msg)
      notify('error', msg)
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
            max={10000}
            step={100}
            unit="ms"
            onChange={(val) => setDurationMs(val)}
          />
          <TactileSlider
            label="Framerate"
            value={Number(fps)}
            min={5}
            max={60}
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
            onClick={() => exportAnimation('webp')}
          >
            {busy ? 'Encoding WebP...' : '🎬 Export Animated WebP'}
          </button>
          <button
            type="button"
            className="vb-export-action-btn vb-btn-accent"
            disabled={busy}
            onClick={() => exportAnimation('gif')}
          >
            {busy ? 'Encoding GIF...' : '🎞 Export Animated GIF'}
          </button>
        </div>
      </div>
    </div>
  )
}
