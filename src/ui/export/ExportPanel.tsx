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

type ExportPanelProps = {
  model: FaceModel
  transparentBackground: boolean
  resolveAnimationFrame: AnimatedExportFrameResolver
}

type NumberDraft = number | ''

const sizePresets = [
  { key: 'current', label: 'Current canvas' },
  { key: '128x64', label: '128 × 64', width: 128, height: 64 },
  { key: '128x128', label: '128 × 128', width: 128, height: 128 },
  { key: '240x240', label: '240 × 240', width: 240, height: 240 },
  { key: '320x240', label: '320 × 240', width: 320, height: 240 },
  { key: '320x320', label: '320 × 320', width: 320, height: 320 },
  { key: 'custom', label: 'Custom' },
] as const

function parseNumberDraft(value: string): NumberDraft {
  return value === '' ? '' : Number(value)
}

function safeDimension(value: NumberDraft): number {
  const numericValue = value === '' ? Number.NaN : value
  if (!Number.isFinite(numericValue)) return 1
  return Math.max(1, Math.round(numericValue))
}

function safePositive(value: NumberDraft, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
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

  const dimensions = {
    width: safeDimension(width),
    height: safeDimension(height),
  }
  const baseName = `roboeyes-${dimensions.width}x${dimensions.height}`
  const staticOptions = { dimensions, transparentBackground }
  const animationOptions = {
    dimensions,
    transparentBackground,
    durationMs: safePositive(durationMs, 2000),
    fps: safePositive(fps, 20),
    loopCount: Math.max(0, Math.round(typeof loopCount === 'number' && Number.isFinite(loopCount) ? loopCount : 0)),
  }

  const exportSvg = () => {
    setError('')
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
    setBusy(true)
    setError('')
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
    setBusy(true)
    setError('')
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
          <input className="number-input" type="number" min={1} value={width} onChange={(event) => {
            setSizeKey('custom')
            setWidth(parseNumberDraft(event.target.value))
          }} />
        </label>
        <label className="control-field">
          <span>Height</span>
          <input className="number-input" type="number" min={1} value={height} onChange={(event) => {
            setSizeKey('custom')
            setHeight(parseNumberDraft(event.target.value))
          }} />
        </label>
      </div>

      <p className="export-note">
        {transparentBackground ? 'Transparent background' : 'Opaque background'} · exact {dimensions.width} × {dimensions.height}px output
      </p>

      <div className="export-actions">
        <button type="button" onClick={exportSvg} disabled={busy}>Download SVG</button>
        <button type="button" onClick={exportPng} disabled={busy}>Download PNG</button>
      </div>

      <div className="panel-heading export-animation-heading">
        <p className="eyebrow">Animation</p>
        <h3>Deterministic frames</h3>
      </div>
      <div className="export-dimensions">
        <label className="control-field">
          <span>Duration (ms)</span>
          <input className="number-input" type="number" min={1} step={100} value={durationMs} onChange={(event) => setDurationMs(parseNumberDraft(event.target.value))} />
        </label>
        <label className="control-field">
          <span>FPS</span>
          <input className="number-input" type="number" min={1} max={60} step={1} value={fps} onChange={(event) => setFps(parseNumberDraft(event.target.value))} />
        </label>
      </div>
      <label className="control-field">
        <span>GIF loop count <small>(0 = forever)</small></span>
        <input className="number-input" type="number" min={0} max={65535} step={1} value={loopCount} onChange={(event) => setLoopCount(parseNumberDraft(event.target.value))} />
      </label>
      <p className="export-note">Frames are sampled from authored animation time, not screen refresh timing.</p>
      <div className="export-actions">
        <button type="button" onClick={() => exportAnimation('webp')} disabled={busy}>{busy ? 'Exporting…' : 'Download WebP'}</button>
        <button type="button" onClick={() => exportAnimation('gif')} disabled={busy}>{busy ? 'Exporting…' : 'Download GIF'}</button>
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
