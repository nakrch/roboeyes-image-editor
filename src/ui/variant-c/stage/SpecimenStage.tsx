import { useEffect, useMemo, useRef, useState } from 'react'
import { renderFaceToSvg } from '../../../renderers/svg'
import type { EditorController } from '../../editor/useEditorController'

type Props = { controller: EditorController }

function formatTime(positionMs: number): string {
  const centiseconds = Math.floor(Math.max(0, positionMs) / 10)
  const minutes = Math.floor(centiseconds / 6000)
  const seconds = Math.floor(centiseconds / 100) % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`
}

export function SpecimenStage({ controller }: Props) {
  const { displayedModel: model, displayedOverlays: overlays, transparentBackground } = controller
  const svg = useMemo(() => renderFaceToSvg(model, { transparentBackground, overlays }), [model, overlays, transparentBackground])
  const specimenRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  const { width, height } = model.canvas
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
    <div className="vc-stage" aria-label="Face specimen">
      <div className="vc-stage-heading"><span>SPECIMEN / LIVE VIEW</span></div>
      <div ref={specimenRef} className={`vc-specimen ${transparentBackground ? 'vc-checkerboard' : ''}`}>
        <div className="vc-specimen-frame" role="img" aria-label="Enlarged robot face preview" style={{ width: width * scale, height: height * scale }} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="vc-stage-foot">
        <div className="vc-native-view"><span className="vc-native-label">1× / ACTUAL SIZE</span><div className={`vc-native-frame ${transparentBackground ? 'vc-checkerboard' : ''}`} role="img" aria-label="Actual pixel size robot face preview" style={{ width, height }} dangerouslySetInnerHTML={{ __html: svg }} /></div>
        <div className="vc-stage-caption"><span>Canvas specimen</span><strong>{width} × {height} px · {transparentBackground ? 'transparent' : 'opaque'} · {Number(scale.toFixed(2))}×</strong><span>{controller.pixelPerfect ? 'Pixel perfect' : 'Scaled view'} / SVG</span></div>
      </div>
      <div className="vc-transport" aria-label="Animation playback">
        <span className={`vc-live-dot ${playing ? 'vc-live-dot--playing' : ''}`} aria-label={playing ? 'Playing' : 'Stopped'} />
        <button className="vc-button vc-button--quiet" type="button" onClick={playing ? controller.pause : controller.play} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button>
        <button className="vc-button vc-button--quiet" type="button" onClick={controller.stop} aria-label="Stop" title="Stop">■</button>
        <button className="vc-button vc-button--quiet" type="button" onClick={controller.restart} aria-label="Restart" title="Restart">↺</button>
        <output className="vc-time" aria-label="Playback position">{formatTime(controller.playback.clock.positionMs)}</output>
        <label className="vc-rate-label"><span className="vc-sr-only">Playback rate</span><select className="vc-field vc-rate" aria-label="Playback rate" value={controller.playback.clock.playbackRate} onChange={(event) => controller.setPlaybackRate(Number(event.target.value))}>{[0.25, 0.5, 1, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}×</option>)}</select></label>
      </div>
    </div>
  )
}
