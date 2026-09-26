import { useEffect, useMemo, useRef, useState } from 'react'
import { displayMaskCircle } from '../../core/model'
import { renderFaceToSvg } from '../../renderers/svg'
import type { EditorController } from '../editor/useEditorController'

type Props = { controller: EditorController }

function formatTime(positionMs: number): string {
  const centiseconds = Math.floor(Math.max(0, positionMs) / 10)
  const minutes = Math.floor(centiseconds / 6000)
  const seconds = Math.floor(centiseconds / 100) % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`
}

function MaskOverlay({ width, height, cx, cy, r }: { width: number; height: number; cx: number; cy: number; r: number }) {
  return <svg className="re-mask-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={`M0 0H${width}V${height}H0Z M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`} fillRule="evenodd" className="re-mask-outside" /><circle cx={cx} cy={cy} r={r} className="re-mask-outline" /></svg>
}
export function SpecimenStage({ controller }: Props) {
  const { displayedModel: model, displayedOverlays: overlays, transparentBackground, displayMask } = controller
  const svg = useMemo(() => renderFaceToSvg(model, { transparentBackground, overlays }), [model, overlays, transparentBackground])
  const specimenRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  const { width, height } = model.canvas
  const circle = displayMask === 'circle' ? displayMaskCircle(model.canvas) : null
  const playing = controller.playback.clock.status === 'playing'

  useEffect(() => {
    const specimen = specimenRef.current
    if (!specimen) return
    const observer = new ResizeObserver(() => {
      setAvailable({ width: specimen.clientWidth - 2, height: specimen.clientHeight - 2 })
    })
    observer.observe(specimen)
    return () => observer.disconnect()
  }, [])

  const fit = Math.min(available.width / width, available.height / height, 8)
  const scale = controller.pixelPerfect ? 1 : fit >= 1 ? Math.floor(fit) : fit > 0 ? fit : 1

  return (
    <div className="re-stage" aria-label="Face specimen">
      <div className="re-stage-heading"><span>SPECIMEN / LIVE VIEW</span></div>
      <div ref={specimenRef} className={`re-specimen ${transparentBackground ? 're-checkerboard' : ''}`}>
        <div className="re-specimen-frame" role="img" aria-label="Enlarged robot face preview" style={{ width: width * scale, height: height * scale }}><div dangerouslySetInnerHTML={{ __html: svg }} />{circle && <MaskOverlay width={width} height={height} {...circle} />}</div>
      </div>
      <div className="re-stage-foot">
        <div className="re-native-view"><span className="re-native-label">1× / ACTUAL SIZE</span><div className={`re-native-frame ${transparentBackground ? 're-checkerboard' : ''}`} role="img" aria-label="Actual pixel size robot face preview" style={{ width, height }}><div dangerouslySetInnerHTML={{ __html: svg }} />{circle && <MaskOverlay width={width} height={height} {...circle} />}</div></div>
        <div className="re-stage-caption"><span>Canvas specimen</span><strong>{width} × {height} px · {transparentBackground ? 'transparent' : 'opaque'} · {Number(scale.toFixed(2))}×{circle ? ' · circle mask' : ''}</strong><span>{controller.pixelPerfect ? 'Pixel perfect' : 'Scaled view'} / SVG</span></div>
      </div>
      <div className="re-transport" aria-label="Animation playback">
        <span className={`re-live-dot ${playing ? 're-live-dot--playing' : ''}`} aria-label={playing ? 'Playing' : 'Stopped'} />
        <button className="re-button re-button--quiet" type="button" onClick={playing ? controller.pause : controller.play} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button>
        <button className="re-button re-button--quiet" type="button" onClick={controller.stop} aria-label="Stop" title="Stop">■</button>
        <button className="re-button re-button--quiet" type="button" onClick={controller.restart} aria-label="Restart" title="Restart">↺</button>
        <output className="re-time" aria-label="Playback position">{formatTime(controller.playback.clock.positionMs)}</output>
        <label className="re-rate-label"><span className="re-sr-only">Playback rate</span><select className="re-field re-rate" aria-label="Playback rate" value={controller.playback.clock.playbackRate} onChange={(event) => controller.setPlaybackRate(Number(event.target.value))}>{[0.25, 0.5, 1, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}×</option>)}</select></label>
      </div>
    </div>
  )
}
