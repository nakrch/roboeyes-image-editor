import { useEffect, useRef, useState } from 'react'
import type { AnimatedExportFrameResolver } from '../../export/animatedAssets'
import type { TransientOverlay } from '../../animation'
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
  parseExpressionPreset,
  parsePreset,
  removeCustomPreset,
  removeUserExpressionPreset,
  saveCustomExpressionPresets,
  saveCustomPresets,
  serializeExpressionPreset,
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
  type AnimationProgram,
  type JsonObject,
  type PresetAnimationDefaults,
  type RuntimeAnimationEvent,
} from '../../animation'
import {
  applyGallerySelection,
  type GalleryExpressionSelection,
} from '../preview/visualRegressionGalleryModel'
import {
  advanceAnimationPlayback,
  createAnimationPlaybackSession,
  pauseAnimationPlayback,
  playAnimationPlayback,
  previewAnimationProgramStep,
  restartAnimationPlayback,
  setAnimationDocumentHidden,
  setAnimationPlaybackRate,
  stopAnimationPlayback,
  type AnimationPlaybackSession,
} from './animationPlayback'
import { evaluateEditorAnimationPreviewFrame, nextRuntimeEvent } from './animationPreview'
import { ContinuousEditProvider } from './continuousEdit'
import { commitHistory, redoHistory, undoHistory, type HistoryState } from './history'
import {
  disableSingleEyeLayout,
  enableSingleEyeLayout,
  enforceSingleEyeNeutralExpression,
  isSingleEyeLayout,
  SINGLE_EYE_NEUTRAL_EXPRESSION,
} from './singleEyeLayout'

export type EditorSnapshot = {
  model: FaceModel
  transparentBackground: boolean
  animationDefaults: PresetAnimationDefaults
}

export type SelectableExpressionPreset = ExpressionPreset | UserExpressionPreset

export type EditorController = {
  model: FaceModel
  transparentBackground: boolean
  animationDefaults: PresetAnimationDefaults
  singleEye: boolean
  displayedModel: FaceModel
  displayedOverlays: readonly TransientOverlay[]
  resolveAnimationFrame: AnimatedExportFrameResolver
  reducedMotion: boolean
  linkedEyes: boolean
  setLinkedEyes: (value: boolean) => void
  pixelPerfect: boolean
  setPixelPerfect: (value: boolean) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  reset: () => void
  continuousEdit: { begin: () => void; end: () => void }
  updateModel: (updater: (current: FaceModel) => FaceModel) => void
  setTransparentBackground: (value: boolean) => void
  setSingleEyeLayout: (enabled: boolean) => void
  updateAnimationDefaults: (next: PresetAnimationDefaults) => void
  presets: FacePreset[]
  displayedPresetId: string
  presetStatus: string
  presetError: string
  applyPreset: (preset: FacePreset) => void
  saveCurrentPreset: (name: string) => void
  importPreset: (json: string) => void
  exportPreset: (preset: FacePreset) => void
  deletePreset: (preset: FacePreset) => void
  selectableExpressions: SelectableExpressionPreset[]
  activeExpressionId: string
  expressionPresetStatus: string
  expressionPresetError: string
  applyExpressionPreset: (preset: SelectableExpressionPreset) => void
  saveCurrentExpressionPreset: (name: string) => void
  importExpressionPreset: (json: string) => void
  exportExpressionPreset: (preset: UserExpressionPreset) => void
  deleteExpressionPreset: (preset: UserExpressionPreset) => void
  applyGallerySelection: (selection: GalleryExpressionSelection) => void
  playback: AnimationPlaybackSession
  play: () => void
  pause: () => void
  stop: () => void
  restart: () => void
  setPlaybackRate: (rate: number) => void
  triggerAnimation: (action: string, channel: RuntimeAnimationEvent['channel'], payload?: JsonObject) => void
  previewSequenceStep: (program: AnimationProgram, stepId: string) => void
}

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

function expressionEqual(a: FaceModel['expression'], b: FaceModel['expression']): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function snapshotEqual(a: EditorSnapshot, b: EditorSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useEditorController(): EditorController {
  const [history, setHistory] = useState<HistoryState<EditorSnapshot>>(() => ({
    past: [],
    present: snapshotFromPreset(initialPreset),
    future: [],
  }))
  const continuousEdit = useRef({ active: false, committed: false })
  const twoEyeExpression = useRef<FaceModel['expression']>(structuredClone(initialPreset.model.expression))
  const [linkedEyes, setLinkedEyes] = useState(true)
  const [pixelPerfect, setPixelPerfect] = useState(false)
  const [activePresetId, setActivePresetId] = useState(initialPreset.id)
  const [activeExpressionPresetId, setActiveExpressionPresetId] = useState(() =>
    matchExpressionPreset(initialPreset.model.expression),
  )
  const [customPresets, setCustomPresets] = useState<FacePreset[]>(() => loadCustomPresets(window.localStorage))
  const [customExpressionPresets, setCustomExpressionPresets] = useState<UserExpressionPreset[]>(() =>
    loadCustomExpressionPresets(window.localStorage),
  )
  const [presetError, setPresetError] = useState('')
  const [presetStatus, setPresetStatus] = useState('')
  const [expressionPresetError, setExpressionPresetError] = useState('')
  const [expressionPresetStatus, setExpressionPresetStatus] = useState('')
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
  const selectableExpressions: SelectableExpressionPreset[] = [...expressionPresets, ...customExpressionPresets]

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
      setExpressionPresetError('')
      setExpressionPresetStatus('')
      updateModel(enableSingleEyeLayout)
      return
    }

    if (!isSingleEyeLayout(currentModel)) return
    const restoredExpression = structuredClone(twoEyeExpression.current)
    setActiveExpressionPresetId(matchExpressionPreset(restoredExpression))
    setExpressionPresetError('')
    setExpressionPresetStatus('')
    updateModel((model) => disableSingleEyeLayout(model, restoredExpression))
  }

  const persistCustomPresets = (next: FacePreset[]) => {
    setCustomPresets(next)
    saveCustomPresets(window.localStorage, next)
  }

  const saveCurrentPreset = (name: string) => {
    const preset = createCustomPreset(name, history.present.model, history.present.transparentBackground, presets, history.present.animationDefaults)
    persistCustomPresets([...customPresets, preset])
    setActivePresetId(preset.id)
    setPresetError('')
    setPresetStatus(`Saved “${preset.name}”.`)
  }

  const importPreset = (json: string) => {
    try {
      const imported = parsePreset(json)
      const preset: FacePreset = { ...clonePreset(imported), id: `custom:${crypto.randomUUID()}`, name: uniquePresetName(imported.name, presets) }
      persistCustomPresets([...customPresets, preset])
      applyPreset(preset)
      setPresetStatus(`Imported “${preset.name}”.`)
    } catch {
      setPresetStatus('')
      setPresetError('Could not import preset: invalid or unsupported JSON.')
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
    setExpressionPresetError('')
    setExpressionPresetStatus(`Saved “${preset.name}”.`)
  }

  const applyExpressionPreset = (preset: SelectableExpressionPreset) => {
    if (isSingleEyeLayout(history.present.model)) return
    endContinuousEdit()
    setGalleryApplyPreview(null)
    setActiveExpressionPresetId(preset.id)
    setExpressionPresetError('')
    setExpressionPresetStatus('')
    commit((current) => ({ ...current, model: { ...current.model, expression: structuredClone(preset.expression) } }))
  }

  const importExpressionPreset = (json: string) => {
    if (isSingleEyeLayout(history.present.model)) return
    try {
      const imported = parseExpressionPreset(json)
      const preset = createUserExpressionPreset(imported.name, imported.expression, selectableExpressions)
      persistExpressionPresets([...customExpressionPresets, preset])
      applyExpressionPreset(preset)
      setExpressionPresetStatus(`Imported “${preset.name}”.`)
    } catch {
      setExpressionPresetStatus('')
      setExpressionPresetError('Could not import expression preset: invalid or unsupported JSON.')
    }
  }

  const exportExpressionPreset = (preset: UserExpressionPreset) => {
    const blob = new Blob([serializeExpressionPreset(preset)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'expression'}.expression.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const deleteExpressionPreset = (preset: UserExpressionPreset) => {
    persistExpressionPresets(removeUserExpressionPreset(customExpressionPresets, preset.id))
    if (activeExpressionPresetId === preset.id) setActiveExpressionPresetId('custom')
    setExpressionPresetError('')
    setExpressionPresetStatus(`Deleted “${preset.name}”.`)
  }

  const triggerAnimation = (action: string, channel: RuntimeAnimationEvent['channel'], payload?: JsonObject) => {
    const order = runtimeEventOrder.current++
    const event = nextRuntimeEvent(action, channel, playback.clock.positionMs, order, payload)
    setRuntimeEvents((current) => [...current, event])
    setPlayback((current) => current.clock.status === 'playing' ? current : playAnimationPlayback(current))
  }

  const previewSequenceStep = (program: AnimationProgram, stepId: string) => {
    runtimeEventOrder.current = 0
    setRuntimeEvents([])
    setPlayback((current) => previewAnimationProgramStep(current, program, stepId))
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
  const displayedModel = galleryApplyPreview === null
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
  const activePreset = presets.find((preset) => preset.id === activePresetId)
  const displayedPresetId = activePreset && snapshotEqual(snapshotFromPreset(activePreset), history.present) ? activePreset.id : 'custom'
  const activeExpressionPreset = selectableExpressions.find((preset) => preset.id === activeExpressionPresetId)
  const activeExpressionId = singleEye
    ? 'expression:neutral'
    : activeExpressionPreset && expressionEqual(activeExpressionPreset.expression, model.expression)
      ? activeExpressionPreset.id
      : matchExpressionPreset(model.expression)

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
    setExpressionPresetError('')
    setExpressionPresetStatus('')
    commit((current) => ({
      ...current,
      model: applyGallerySelection(current.model, selection),
    }))
  }

  const setTransparentBackground = (value: boolean) => commit((current) => ({ ...current, transparentBackground: value }))
  const play = () => setPlayback(playAnimationPlayback)
  const pause = () => setPlayback(pauseAnimationPlayback)
  const stop = () => { setRuntimeEvents([]); runtimeEventOrder.current = 0; setPlayback(stopAnimationPlayback) }
  const restart = () => { setRuntimeEvents([]); runtimeEventOrder.current = 0; setPlayback(restartAnimationPlayback) }
  const setPlaybackRate = (rate: number) => setPlayback((current) => setAnimationPlaybackRate(current, rate))

  return { model, transparentBackground, animationDefaults, singleEye, displayedModel,
    displayedOverlays: displayedFrame.transientEffects.overlays, resolveAnimationFrame, reducedMotion,
    linkedEyes, setLinkedEyes, pixelPerfect, setPixelPerfect,
    canUndo: history.past.length !== 0, canRedo: history.future.length !== 0, undo, redo, reset,
    continuousEdit: { begin: beginContinuousEdit, end: endContinuousEdit },
    updateModel, setTransparentBackground, setSingleEyeLayout, updateAnimationDefaults,
    presets, displayedPresetId, presetStatus, presetError, applyPreset, saveCurrentPreset,
    importPreset, exportPreset, deletePreset, selectableExpressions, activeExpressionId,
    expressionPresetStatus, expressionPresetError, applyExpressionPreset,
    saveCurrentExpressionPreset, importExpressionPreset, exportExpressionPreset,
    deleteExpressionPreset, applyGallerySelection: applyGallerySelectionToEditor, playback,
    play, pause, stop, restart, setPlaybackRate, triggerAnimation, previewSequenceStep,
  }
}
