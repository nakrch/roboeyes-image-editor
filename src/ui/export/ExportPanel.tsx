import { useEffect, useState } from 'react'
import type { FaceModel } from '../../core/model'
import {
  downloadBlob,
  renderExportPng,
  renderExportSvg,
  svgToBlob,
} from '../../export/staticAssets'

type ExportPanelProps = {
  model: FaceModel
  transparentBackground: boolean
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

function safeDimension(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}

export function ExportPanel({ model, transparentBackground }: ExportPanelProps) {
  const [sizeKey, setSizeKey] = useState('current')
  const [width, setWidth] = useState(model.canvas.width)
  const [height, setHeight] = useState(model.canvas.height)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
  const options = { dimensions, transparentBackground }

  const exportSvg = () => {
    setError('')
    const svg = renderExportSvg(model, options)
    downloadBlob(svgToBlob(svg), `${baseName}.svg`)
  }

  const exportPng = async () => {
    setBusy(true)
    setError('')
    try {
      const png = await renderExportPng(model, options)
      downloadBlob(png, `${baseName}.png`)
    } catch {
      setError('Could not export PNG in this browser.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel export-panel" aria-label="Static image export">
      <div className="panel-heading">
        <p className="eyebrow">Export</p>
        <h2>Static asset</h2>
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
            value={width}
            onChange={(event) => {
              setSizeKey('custom')
              setWidth(Number(event.target.value))
            }}
          />
        </label>
        <label className="control-field">
          <span>Height</span>
          <input
            className="number-input"
            type="number"
            min={1}
            value={height}
            onChange={(event) => {
              setSizeKey('custom')
              setHeight(Number(event.target.value))
            }}
          />
        </label>
      </div>

      <p className="export-note">
        {transparentBackground ? 'Transparent background' : 'Opaque background'} · exact {dimensions.width} × {dimensions.height}px output
      </p>

      <div className="export-actions">
        <button type="button" onClick={exportSvg}>Download SVG</button>
        <button type="button" onClick={exportPng} disabled={busy}>
          {busy ? 'Exporting…' : 'Download PNG'}
        </button>
      </div>

      {error && <p className="preset-error" role="alert">{error}</p>}
    </section>
  )
}
