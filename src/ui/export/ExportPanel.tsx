import { useEffect, useState } from 'react'
import type { FaceModel } from '../../core/model'
import {
  animatedExportLimitations,
  encodeAnimatedGif,
  encodeAnimatedWebp,
  rasterizeAnimationExportFrames,
  type AnimatedExportFrameResolver,
} from '../../export/animatedAssets'
import {
  downloadBlob,
  renderExportPng,
  renderExportSvg,
  svgToBlob,
} from '../../export/staticAssets'
import { useToast } from '../feedback/ToastProvider'
import {
  firstGifValidationError,
  firstStaticValidationError,
  firstWebpValidationError,
  parseNumberDraft,
  validateExportNumericDrafts,
  type NumberDraft,
} from './exportNumericValidation'

type ExportPanelProps = {
  model: FaceModel
  transparentBackground: boolean
  resolveAnimationFrame: AnimatedExportFrameResolver
}

const sizePresets = [
  { key: 'current', label: 'Current canvas' },
  { key: '128x64', label: '128 × 64', width: 128, height: 64 },
  { key: '128x128', label: '128 × 128', width: 128, height: 128 },
  { key: '240x240', label: '240 × 240', width: 240, height: 240 },
  { key: '320x240', label: '320 × 240', width: 320, height: 240 },
  { key: '320x320', label: '320 × 320', width: 320, height: 320 },
  { key: 'custom', label: 'Custom' },
] as const

function fieldError(id: string, message: string | undefined) {
  if (message === undefined) return null
  return <small className="export-field-error" id={id}>{message}</small>
}

export function ExportPanel({ model, transparentBackground, resolveAnimationFrame }: ExportPanelProps) {
  const [sizeKey, setSizeKey] = useState('current')
  const [width, setWidth] = useState<NumberDraft>(model.canvas.width)
  const [height, setHeight] = useState<NumberDraft>(model.canvas.height)
  const [durationMs, setDurationMs] = useState<NumberDraft>(2000)
  const [fps, setFps] = useState<NumberDraft>(20)
  const [loopCount, setLoopCount] = useState<NumberDraft>(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useToast()

  useEffect(() => {
    if (sizeKey === 'current') {
      setWidth(model.canvas.width)
      setHeight(model.canvas.height)
    }
  }, [model.canvas.width, model.canvas.height, sizeKey])

  const selectSize = (key: string) => {
    setError('')
    setSizeKey(key)
    if (key === 'current') {
      setWidth(model.canvas.width)
      setHeight(model.canvas.height)
      return
    }

    const preset = sizePresets.find((candidate) => candidate.key === key)
    if (preset && 'width' in preset && 'height' in preset) {
      setWidth(preset.width)
      setHeight(preset.height)
    }
  }

  const validation = validateExportNumericDrafts({ width, height, durationMs, fps, loopCount })
  const dimensions = validation.staticValues
  const staticDisabled = busy || dimensions === null
  const webpDisabled = busy || validation.webpValues === null
  const gifDisabled = busy || validation.gifValues === null

  const reportValidationFailure = (message: string) => {
    setError(message)
    notify('error', message)
  }

  const exportSvg = () => {
    setError('')
    const values = validation.staticValues
    if (values === null) {
      reportValidationFailure(firstStaticValidationError(validation))
      return
    }

    const staticOptions = { dimensions: values, transparentBackground }
    const baseName = `roboeyes-${values.width}x${values.height}`
    try {
      const svg = renderExportSvg(model, staticOptions)
      downloadBlob(svgToBlob(svg), `${baseName}.svg`)
      notify('success', 'Downloading SVG…')
    } catch {
      const message = 'Could not export SVG in this browser.'
      setError(message)
      notify('error', message)
    }
  }

  const exportPng = async () => {
    setError('')
    const values = validation.staticValues
    if (values === null) {
      reportValidationFailure(firstStaticValidationError(validation))
      return
    }

    setBusy(true)
    const staticOptions = { dimensions: values, transparentBackground }
    const baseName = `roboeyes-${values.width}x${values.height}`
    try {
      const png = await renderExportPng(model, staticOptions)
      downloadBlob(png, `${baseName}.png`)
      notify('success', 'Downloading PNG…')
    } catch {
      const message = 'Could not export PNG in this browser.'
      setError(message)
      notify('error', message)
    } finally {
      setBusy(false)
    }
  }

  const exportAnimation = async (format: 'gif' | 'webp') => {
    setError('')
    const values = format === 'gif' ? validation.gifValues : validation.webpValues
    if (values === null) {
      reportValidationFailure(format === 'gif'
        ? firstGifValidationError(validation)
        : firstWebpValidationError(validation))
      return
    }

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
      const message = `Could not export animated ${format.toUpperCase()} in this browser.`
      setError(message)
      notify('error', message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel export-panel" aria-label="Image export">
      <div className="panel-heading">
        <p className="eyebrow">Export</p>
        <h2>Image assets</h2>
      </div>

      <label className="control-field">
        <span>Output size</span>
        <select value={sizeKey} onChange={(event) => selectSize(event.target.value)}>
          {sizePresets.map((preset) => (
            <option key={preset.key} value={preset.key}>{preset.label}</option>
          ))}
        </select>
      </label>

      <div className="export-dimensions">
        <label className="control-field">
          <span>Width</span>
          <input
            className="number-input"
            type="number"
            min={1}
            step={1}
            value={width}
            aria-invalid={validation.errors.width !== undefined}
            aria-describedby={validation.errors.width === undefined ? undefined : 'export-width-error'}
            onChange={(event) => {
              setError('')
              setSizeKey('custom')
              setWidth(parseNumberDraft(event.target.value))
            }}
          />
          {fieldError('export-width-error', validation.errors.width)}
        </label>
        <label className="control-field">
          <span>Height</span>
          <input
            className="number-input"
            type="number"
            min={1}
            step={1}
            value={height}
            aria-invalid={validation.errors.height !== undefined}
            aria-describedby={validation.errors.height === undefined ? undefined : 'export-height-error'}
            onChange={(event) => {
              setError('')
              setSizeKey('custom')
              setHeight(parseNumberDraft(event.target.value))
            }}
          />
          {fieldError('export-height-error', validation.errors.height)}
        </label>
      </div>

      <p className="export-note">
        {dimensions === null
          ? 'Enter valid Width and Height to enable image export.'
          : `${transparentBackground ? 'Transparent background' : 'Opaque background'} · exact ${dimensions.width} × ${dimensions.height}px output`}
      </p>

      <div className="export-actions">
        <button type="button" onClick={exportSvg} disabled={staticDisabled}>Download SVG</button>
        <button type="button" onClick={exportPng} disabled={staticDisabled}>Download PNG</button>
      </div>

      <div className="panel-heading export-animation-heading">
        <p className="eyebrow">Animation</p>
        <h3>Deterministic frames</h3>
      </div>
      <div className="export-dimensions">
        <label className="control-field">
          <span>Duration (ms)</span>
          <input
            className="number-input"
            type="number"
            min={1}
            step={100}
            value={durationMs}
            aria-invalid={validation.errors.durationMs !== undefined}
            aria-describedby={validation.errors.durationMs === undefined ? undefined : 'export-duration-error'}
            onChange={(event) => {
              setError('')
              setDurationMs(parseNumberDraft(event.target.value))
            }}
          />
          {fieldError('export-duration-error', validation.errors.durationMs)}
        </label>
        <label className="control-field">
          <span>FPS</span>
          <input
            className="number-input"
            type="number"
            min={1}
            max={60}
            step={1}
            value={fps}
            aria-invalid={validation.errors.fps !== undefined}
            aria-describedby={validation.errors.fps === undefined ? undefined : 'export-fps-error'}
            onChange={(event) => {
              setError('')
              setFps(parseNumberDraft(event.target.value))
            }}
          />
          {fieldError('export-fps-error', validation.errors.fps)}
        </label>
      </div>
      <label className="control-field">
        <span>GIF loop count <small>(0 = forever)</small></span>
        <input
          className="number-input"
          type="number"
          min={0}
          max={65535}
          step={1}
          value={loopCount}
          aria-invalid={validation.errors.loopCount !== undefined}
          aria-describedby={validation.errors.loopCount === undefined ? undefined : 'export-loop-count-error'}
          onChange={(event) => {
            setError('')
            setLoopCount(parseNumberDraft(event.target.value))
          }}
        />
        {fieldError('export-loop-count-error', validation.errors.loopCount)}
      </label>
      <p className="export-note">Frames are sampled from authored animation time, not screen refresh timing.</p>
      <div className="export-actions">
        <button type="button" onClick={() => exportAnimation('webp')} disabled={webpDisabled}>{busy ? 'Exporting…' : 'Download WebP'}</button>
        <button type="button" onClick={() => exportAnimation('gif')} disabled={gifDisabled}>{busy ? 'Exporting…' : 'Download GIF'}</button>
      </div>
      <details className="export-limitations">
        <summary>Animated format notes</summary>
        <p>{animatedExportLimitations.webp}</p>
        <p>{animatedExportLimitations.gif}</p>
      </details>

      {error && <p className="preset-error" role="alert">{error}</p>}
    </section>
  )
}
