import { useEffect, useRef, useState } from 'react'
import { clampGaze, type FaceModel } from '../../core/model'
import {
  builtInPresets,
  clonePreset,
  createCustomPreset,
  createUserExpressionPreset,
  expressionPresets,
  loadCustomExpressionPresets,
  loadCustomPresets,
  matchExpressionPreset,
  parsePreset,
  removeCustomPreset,
  removeUserExpressionPreset,
  saveCustomExpressionPresets,
  saveCustomPresets,
  serializePreset,
  uniquePresetName,
  type ExpressionPreset,
  type FacePreset,
  type UserExpressionPreset,
} from '../../core/presets'
import {
  createFaceTransition,
  normalizePresetAnimationDefaults,
  sampleFaceTransition,
  type JsonObject,
  type PresetAnimationDefaults,
  type RuntimeAnimationEvent,
} from '../../animation'
import {
  advanceAnimationPlayback,
  createAnimationPlaybackSession,
  pauseAnimationPlayback,
  playAnimationPlayback,
  restartAnimationPlayback,
  setAnimationDocumentHidden,
  setAnimationPlaybackRate,
  stopAnimationPlayback,
} from '../editor/animationPlayback'
import { evaluateEditorAnimationPreviewFrame, nextRuntimeEvent } from '../editor/animationPreview'
import { ContinuousEditProvider } from '../editor/continuousEdit'
import { commitHistory, redoHistory, undoHistory, type HistoryState } from '../editor/history'
import {
  disableSingleEyeLayout,
  enableSingleEyeLayout,
  enforceSingleEyeNeutralExpression,
  isSingleEyeLayout,
  SINGLE_EYE_NEUTRAL_EXPRESSION,
} from '../editor/singleEyeLayout'
import { VisualRegressionGallery } from '../preview/VisualRegressionGallery'
import {
  applyGallerySelection,
  type GalleryExpressionSelection,
} from '../preview/visualRegressionGalleryModel'

// Variant B components
import { LiveTransportBar } from './transport/LiveTransportBar'
import { DeviceStage } from './stage/DeviceStage'
import { ExpressionCarousel } from './stage/ExpressionCarousel'
import { ModularDeck } from './deck/ModularDeck'
import { PresetsDeckModal } from './deck/PresetsDeckModal'
import './variant-b.css'

type EditorSnapshot = {
  model: FaceModel
  transparentBackground: boolean
  animationDefaults: PresetAnimationDefaults
}

type SelectableExpressionPreset = ExpressionPreset | UserExpressionPreset

type GalleryApplyPreview = {
  id: string
  baseModel: FaceModel
  selection: GalleryExpressionSelection
}

const HISTORY_LIMIT = 100
const GALLERY_APPLY_TRANSITION_MS = 280
const initialPreset = builtInPresets[0]

function snapshotFromPreset(preset: FacePreset): EditorSnapshot {
  return {
    model: clampGaze(enforceSingleEyeNeutralExpression(structuredClone(preset.model))),
    transparentBackground: preset.preview?.transparentBackground ?? false,
    animationDefaults: normalizePresetAnimationDefaults(preset.animationDefaults),
  }
}

export function VariantBShell() {
  const [history, setHistory] = useState<HistoryState<EditorSnapshot>>(() => ({
    past: [],
    present: snapshotFromPreset(initialPreset),
    future: [],
  }))

  const continuousEdit = useRef({ active: false, committed: false })
  const twoEyeExpression = useRef<FaceModel['expression']>(
    structuredClone(initialPreset.model.expression),
  )

  const [linkedEyes, setLinkedEyes] = useState(true)
  const [pixelPerfect, setPixelPerfect] = useState(false)
  const [activePresetId, setActivePresetId] = useState(initialPreset.id)
  const [activeExpressionPresetId, setActiveExpressionPresetId] = useState(() =>
    matchExpressionPreset(initialPreset.model.expression),
  )

  const [customPresets, setCustomPresets] = useState<FacePreset[]>(() =>
    loadCustomPresets(window.localStorage),
  )
  const [customExpressionPresets, setCustomExpressionPresets] = useState<UserExpressionPreset[]>(() =>
    loadCustomExpressionPresets(window.localStorage),
  )

  const [presetError, setPresetError] = useState('')
  const [presetStatus, setPresetStatus] = useState('')
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false)

  const [playback, setPlayback] = useState(createAnimationPlaybackSession)
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeAnimationEvent[]>([])
  const runtimeEventOrder = useRef(0)

  const [galleryApplyPreview, setGalleryApplyPreview] = useState<GalleryApplyPreview | null>(null)
  const [galleryApplyTimeMs, setGalleryApplyTimeMs] = useState(0)
  const galleryApplyOrder = useRef(0)

  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  const presets: FacePreset[] = [...builtInPresets.map(clonePreset), ...customPresets]
  const selectableExpressions: SelectableExpressionPreset[] = [
    ...expressionPresets,
    ...customExpressionPresets,
  ]

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (query === undefined) return
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => {
      setPlayback((current) => setAnimationDocumentHidden(current, document.hidden))
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (playback.clock.status !== 'playing') return
    let animationFrame = 0
    let previousTime = performance.now()
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - previousTime)
      previousTime = now
      setPlayback((current) => advanceAnimationPlayback(current, elapsed))
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [playback.clock.status])

  useEffect(() => {
    if (galleryApplyPreview === null) {
      setGalleryApplyTimeMs(0)
      return
    }

    let animationFrame = 0
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = Math.min(GALLERY_APPLY_TRANSITION_MS, Math.max(0, now - startTime))
      setGalleryApplyTimeMs(elapsed)
      if (elapsed < GALLERY_APPLY_TRANSITION_MS) {
        animationFrame = requestAnimationFrame(tick)
      } else {
        setGalleryApplyPreview(null)
      }
    }
    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [galleryApplyPreview?.id])

  useEffect(() => {
    if (!isSingleEyeLayout(history.present.model)) {
      twoEyeExpression.current = structuredClone(history.present.model.expression)
    }
  }, [history.present.model])

  const beginContinuousEdit = () => {
    if (continuousEdit.current.active) return
    continuousEdit.current = { active: true, committed: false }
  }

  const endContinuousEdit = () => {
    continuousEdit.current = { active: false, committed: false }
  }

  const commit = (updater: (current: EditorSnapshot) => EditorSnapshot) => {
    const replacePresent = continuousEdit.current.active && continuousEdit.current.committed
    if (continuousEdit.current.active) continuousEdit.current.committed = true
    setHistory((current) => commitHistory(current, updater(current.present), HISTORY_LIMIT, replacePresent))
  }

  const updateModel = (updater: (current: FaceModel) => FaceModel) => {
    commit((current) => ({
      ...current,
      model: clampGaze(enforceSingleEyeNeutralExpression(updater(current.model))),
    }))
  }

  const updateAnimationDefaults = (next: PresetAnimationDefaults) => {
    commit((current) => ({ ...current, animationDefaults: normalizePresetAnimationDefaults(next) }))
  }

  const resetPlaybackRuntime = () => {
    runtimeEventOrder.current = 0
    setRuntimeEvents([])
    setPlayback(createAnimationPlaybackSession())
    setGalleryApplyPreview(null)
  }

  const undo = () => {
    endContinuousEdit()
    setGalleryApplyPreview(null)
    setHistory(undoHistory)
  }

  const redo = () => {
    endContinuousEdit()
    setGalleryApplyPreview(null)
    setHistory((current) => redoHistory(current, HISTORY_LIMIT))
  }

  const applyPreset = (preset: FacePreset) => {
    endContinuousEdit()
    resetPlaybackRuntime()
    const snapshot = snapshotFromPreset(preset)
    twoEyeExpression.current = structuredClone(
      isSingleEyeLayout(snapshot.model) ? SINGLE_EYE_NEUTRAL_EXPRESSION : snapshot.model.expression,
    )
    setActivePresetId(preset.id)
    setActiveExpressionPresetId(matchExpressionPreset(snapshot.model.expression))
    setLinkedEyes(true)
    setPresetError('')
    setPresetStatus('')
    commit(() => snapshot)
  }

  const reset = () => {
    endContinuousEdit()
    resetPlaybackRuntime()
    const preset = presets.find((item) => item.id === activePresetId) ?? initialPreset
    const snapshot = snapshotFromPreset(preset)
    twoEyeExpression.current = structuredClone(
      isSingleEyeLayout(snapshot.model) ? SINGLE_EYE_NEUTRAL_EXPRESSION : snapshot.model.expression,
    )
    setActiveExpressionPresetId(matchExpressionPreset(snapshot.model.expression))
    setLinkedEyes(true)
    commit(() => snapshot)
  }

  const setSingleEyeLayout = (enabled: boolean) => {
    endContinuousEdit()
    setGalleryApplyPreview(null)
    const currentModel = history.present.model
    if (enabled) {
      if (isSingleEyeLayout(currentModel)) return
      twoEyeExpression.current = structuredClone(currentModel.expression)
      setActiveExpressionPresetId('expression:neutral')
      updateModel(enableSingleEyeLayout)
      return
    }

    if (!isSingleEyeLayout(currentModel)) return
    const restoredExpression = structuredClone(twoEyeExpression.current)
    setActiveExpressionPresetId(matchExpressionPreset(restoredExpression))
    updateModel((model) => disableSingleEyeLayout(model, restoredExpression))
  }

  const persistCustomPresets = (next: FacePreset[]) => {
    setCustomPresets(next)
    saveCustomPresets(window.localStorage, next)
  }

  const saveCurrentPreset = (name: string) => {
    const preset = createCustomPreset(
      name,
      history.present.model,
      history.present.transparentBackground,
      presets,
      history.present.animationDefaults,
    )
    persistCustomPresets([...customPresets, preset])
    setActivePresetId(preset.id)
    setPresetError('')
    setPresetStatus(`Saved “${preset.name}”.`)
  }

  const importPreset = (json: string) => {
    try {
      const imported = parsePreset(json)
      const preset: FacePreset = {
        ...clonePreset(imported),
        id: `custom:${crypto.randomUUID()}`,
        name: uniquePresetName(imported.name, presets),
      }
      persistCustomPresets([...customPresets, preset])
      applyPreset(preset)
      setPresetStatus(`Imported “${preset.name}”.`)
    } catch {
      setPresetStatus('')
      setPresetError('Could not import preset: invalid JSON.')
    }
  }

  const exportPreset = (preset: FacePreset) => {
    const blob = new Blob([serializePreset(preset)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'preset'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const deletePreset = (preset: FacePreset) => {
    persistCustomPresets(removeCustomPreset(customPresets, preset.id))
    if (activePresetId === preset.id) setActivePresetId('custom')
    setPresetError('')
    setPresetStatus(`Deleted “${preset.name}”.`)
  }

  const persistExpressionPresets = (next: UserExpressionPreset[]) => {
    setCustomExpressionPresets(next)
    saveCustomExpressionPresets(window.localStorage, next)
  }

  const saveCurrentExpressionPreset = (name: string) => {
    if (isSingleEyeLayout(history.present.model)) return
    const preset = createUserExpressionPreset(name, history.present.model.expression, selectableExpressions)
    persistExpressionPresets([...customExpressionPresets, preset])
    setActiveExpressionPresetId(preset.id)
  }

  const applyExpressionPreset = (preset: SelectableExpressionPreset) => {
    if (isSingleEyeLayout(history.present.model)) return
    endContinuousEdit()
    setGalleryApplyPreview(null)
    setActiveExpressionPresetId(preset.id)
    commit((current) => ({
      ...current,
      model: { ...current.model, expression: structuredClone(preset.expression) },
    }))
  }

  const deleteExpressionPreset = (preset: UserExpressionPreset) => {
    persistExpressionPresets(removeUserExpressionPreset(customExpressionPresets, preset.id))
    if (activeExpressionPresetId === preset.id) setActiveExpressionPresetId('custom')
  }

  const triggerAnimation = (
    action: string,
    channel: RuntimeAnimationEvent['channel'],
    payload?: JsonObject,
  ) => {
    const order = runtimeEventOrder.current++
    const event = nextRuntimeEvent(action, channel, playback.clock.positionMs, order, payload)
    setRuntimeEvents((current) => [...current, event])
    setPlayback((current) => (current.clock.status === 'playing' ? current : playAnimationPlayback(current)))
  }

  const { model, transparentBackground, animationDefaults } = history.present
  const singleEye = isSingleEyeLayout(model)

  const displayedFrame = evaluateEditorAnimationPreviewFrame(model, animationDefaults, {
    timeMs: playback.clock.positionMs,
    runtimeEvents,
    reducedMotion,
  })

  const resolveAnimationFrame = (timeMs: number) => {
    const frame = evaluateEditorAnimationPreviewFrame(model, animationDefaults, {
      timeMs,
      runtimeEvents: [],
      reducedMotion: false,
    })
    return { model: frame.model, overlays: frame.transientEffects.overlays }
  }

  const displayedModel =
    galleryApplyPreview === null
      ? displayedFrame.model
      : sampleFaceTransition(
          createFaceTransition(
            galleryApplyPreview.id,
            {
              expression: galleryApplyPreview.selection.expression,
              ...(galleryApplyPreview.selection.gaze === undefined
                ? {}
                : { gaze: galleryApplyPreview.selection.gaze }),
            },
            0,
            GALLERY_APPLY_TRANSITION_MS,
            'ease-in-out',
          ),
          galleryApplyPreview.baseModel,
          galleryApplyTimeMs,
        )

  const applyGallerySelectionToEditor = (selection: GalleryExpressionSelection) => {
    if (singleEye) return
    endContinuousEdit()
    const previewSelection = structuredClone(selection)
    setGalleryApplyTimeMs(0)
    setGalleryApplyPreview({
      id: `gallery-apply:${galleryApplyOrder.current++}`,
      baseModel: structuredClone(displayedFrame.model),
      selection: previewSelection,
    })
    setActiveExpressionPresetId(selection.presetId)
    commit((current) => ({
      ...current,
      model: applyGallerySelection(current.model, selection),
    }))
  }

  return (
    <div className="vb-studio-shell">
      {/* Top Live Transport */}
      <LiveTransportBar
        playback={playback}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        reducedMotion={reducedMotion}
        onPlay={() => setPlayback(playAnimationPlayback)}
        onPause={() => setPlayback(pauseAnimationPlayback)}
        onStop={() => {
          setRuntimeEvents([])
          runtimeEventOrder.current = 0
          setPlayback(stopAnimationPlayback)
        }}
        onRestart={() => {
          setRuntimeEvents([])
          runtimeEventOrder.current = 0
          setPlayback(restartAnimationPlayback)
        }}
        onPlaybackRateChange={(rate) => setPlayback((current) => setAnimationPlaybackRate(current, rate))}
        onTrigger={triggerAnimation}
        onUndo={undo}
        onRedo={redo}
        onReset={reset}
        onOpenPresets={() => setIsPresetsModalOpen(true)}
      />

      {/* Main Workspace (Stage + Modular Deck) */}
      <ContinuousEditProvider value={{ begin: beginContinuousEdit, end: endContinuousEdit }}>
        <main className="vb-workspace-layout" aria-label="Robot Face Studio Workspace">
          {/* Left Column: Device Stage + Expression Strip */}
          <div className="vb-stage-column">
            <DeviceStage
              model={displayedModel}
              overlays={displayedFrame.transientEffects.overlays}
              transparentBackground={transparentBackground}
              pixelPerfect={pixelPerfect}
              onTransparentBackgroundChange={(val) =>
                commit((cur) => ({ ...cur, transparentBackground: val }))
              }
              onPixelPerfectChange={setPixelPerfect}
            />

            <ExpressionCarousel
              presets={selectableExpressions}
              activePresetId={activeExpressionPresetId}
              disabled={singleEye}
              onApply={applyExpressionPreset}
              onSaveCurrent={saveCurrentExpressionPreset}
              onDelete={deleteExpressionPreset}
            />
          </div>

          {/* Right Column: Modular Control Deck */}
          <ModularDeck
            model={model}
            linkedEyes={linkedEyes}
            singleEye={singleEye}
            transparentBackground={transparentBackground}
            animationDefaults={animationDefaults}
            resolveAnimationFrame={resolveAnimationFrame}
            onChange={updateModel}
            onLinkedEyesChange={setLinkedEyes}
            onSingleEyeLayoutChange={setSingleEyeLayout}
            onTransparentBackgroundChange={(val) =>
              commit((cur) => ({ ...cur, transparentBackground: val }))
            }
            onAnimationDefaultsChange={updateAnimationDefaults}
          />
        </main>
      </ContinuousEditProvider>

      {/* Visual Regression Gallery */}
      <section className="vb-gallery-section" aria-label="Visual Regression Gallery">
        <VisualRegressionGallery
          activeExpressionId={activeExpressionPresetId}
          disabled={singleEye}
          onApplySelection={applyGallerySelectionToEditor}
        />
      </section>

      {/* Presets Modal */}
      <PresetsDeckModal
        isOpen={isPresetsModalOpen}
        presets={presets}
        activePresetId={activePresetId}
        statusMessage={presetStatus}
        errorMessage={presetError}
        onClose={() => setIsPresetsModalOpen(false)}
        onApply={applyPreset}
        onSaveCurrent={saveCurrentPreset}
        onImport={importPreset}
        onExport={exportPreset}
        onDelete={deletePreset}
      />
    </div>
  )
}
