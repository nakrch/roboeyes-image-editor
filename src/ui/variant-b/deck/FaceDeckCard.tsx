import { useMemo, useState } from 'react'
import type { FaceModel } from '../../../core/model'
import { gazeLimits } from '../../../core/model'
import {
  centerRelativePositionRange,
  fromCenterRelativePosition,
  toCenterRelativePosition,
} from '../../editor/centerRelativePosition'
import {
  independentEyeDimensionRanges,
  linkedEyeDimensionRanges,
  setIndependentEyeDimensionSafely,
  setLinkedEyeDimensionSafely,
} from '../../editor/eyeDimensions'
import {
  independentEyePositionRange,
  rigidEyePositionRange,
  setIndependentEyePositionSafely,
} from '../../editor/eyePositionSafety'
import {
  independentEyeRotationRange,
  setIndependentEyeRotationSafely,
} from '../../editor/eyeRotationSafety'
import {
  anchoredPairSpacing,
  anchoredPairSpacingMin,
} from '../../editor/geometrySafety'
import { setGazeSafely } from '../../editor/gazeSafety'
import {
  movePair,
  moveSingleEye,
  pairCenterX,
  pairCenterY,
  pairRotation,
  pairRotationLimits,
  rotatePairSafely,
  updateEyeGeometry,
  type EyeSide,
  type GeometryKey,
} from '../../editor/modelEditing'
import {
  isSingleEyeLayout,
  preserveSingleEyeSpacing,
} from '../../editor/singleEyeLayout'
import {
  canvasSafeAnchoredPairSpacingMax,
  setCanvasSafeAnchoredPairSpacing,
} from '../../editor/spacingCanvasSafety'
import { ModeSwitch } from '../controls/ModeSwitch'
import { TactileSlider } from '../controls/TactileSlider'
import { XYPad } from '../controls/XYPad'

type FaceDeckCardProps = {
  model: FaceModel
  linkedEyes: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
  onLinkedEyesChange: (value: boolean) => void
  onSingleEyeLayoutChange: (enabled: boolean) => void
}

export function FaceDeckCard({
  model,
  linkedEyes,
  onChange,
  onLinkedEyesChange,
  onSingleEyeLayoutChange,
}: FaceDeckCardProps) {
  const [independentSide, setIndependentSide] = useState<EyeSide>('left')
  const singleEye = isSingleEyeLayout(model)

  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const safeGaze = gazeLimits(model)

  // Memoized safe bounds for linked mode
  const linkedDerived = useMemo(() => {
    const xAbsolutePositionRange = rigidEyePositionRange(model, 'x', pairCenterX(model))
    const yAbsolutePositionRange = rigidEyePositionRange(model, 'y', pairCenterY(model))
    return {
      rotationLimits: pairRotationLimits(model),
      dimensionRanges: linkedEyeDimensionRanges(model),
      positionRanges: {
        x: centerRelativePositionRange(
          model,
          'x',
          xAbsolutePositionRange.min,
          xAbsolutePositionRange.max,
        ),
        y: centerRelativePositionRange(
          model,
          'y',
          yAbsolutePositionRange.min,
          yAbsolutePositionRange.max,
        ),
      },
    }
  }, [model])

  // Memoized safe bounds for independent mode
  const independentDerived = useMemo(() => {
    if (linkedEyes && !singleEye) return undefined

    const deriveSide = (side: EyeSide) => {
      const geometry = side === 'left' ? model.leftEye.geometry : model.rightEye.geometry
      const xAbsolutePositionRange = singleEye && side === 'left'
        ? rigidEyePositionRange(model, 'x', geometry.x)
        : independentEyePositionRange(model, side, 'x')
      const yAbsolutePositionRange = singleEye && side === 'left'
        ? rigidEyePositionRange(model, 'y', geometry.y)
        : independentEyePositionRange(model, side, 'y')

      return {
        dimensionRanges: independentEyeDimensionRanges(model, side),
        rotationRange: independentEyeRotationRange(model, side),
        positionRanges: {
          x: centerRelativePositionRange(
            model,
            'x',
            xAbsolutePositionRange.min,
            xAbsolutePositionRange.max,
            geometry.width,
          ),
          y: centerRelativePositionRange(
            model,
            'y',
            yAbsolutePositionRange.min,
            yAbsolutePositionRange.max,
            geometry.height,
          ),
        },
      }
    }

    return {
      left: deriveSide('left'),
      right: deriveSide('right'),
    }
  }, [linkedEyes, model, singleEye])

  const centerRelativeX = toCenterRelativePosition(model, 'x', pairCenterX(model))
  const centerRelativeY = toCenterRelativePosition(model, 'y', pairCenterY(model))

  // Spacing limits
  const spacingMin = anchoredPairSpacingMin(model)
  const spacingMax = canvasSafeAnchoredPairSpacingMax(model)
  const currentSpacing = anchoredPairSpacing(model)

  // Layout mode switcher options
  const layoutMode = singleEye ? 'single' : linkedEyes ? 'linked' : 'independent'

  const handleLayoutModeChange = (mode: string) => {
    if (mode === 'single') {
      onSingleEyeLayoutChange(true)
    } else if (mode === 'linked') {
      if (singleEye) onSingleEyeLayoutChange(false)
      onLinkedEyesChange(true)
    } else {
      if (singleEye) onSingleEyeLayoutChange(false)
      onLinkedEyesChange(false)
    }
  }

  return (
    <div className="vb-deck-card vb-face-card" aria-label="Face & Geometry Controls">
      {/* Layout Mode Switch */}
      <div className="vb-card-section">
        <div className="vb-section-label">EYE CONFIGURATION</div>
        <ModeSwitch
          value={layoutMode}
          options={[
            { value: 'linked', label: 'Linked Pair' },
            { value: 'independent', label: 'Independent' },
            { value: 'single', label: 'Cyclops (Single)' },
          ]}
          onChange={handleLayoutModeChange}
          ariaLabel="Eye layout mode"
        />
      </div>

      {/* Position 2D Pad */}
      <div className="vb-card-section">
        <div className="vb-section-label">CENTER POSITION (2D)</div>
        <XYPad
          label="Face Position"
          valueX={centerRelativeX}
          valueY={centerRelativeY}
          minX={linkedDerived.positionRanges.x.min}
          maxX={linkedDerived.positionRanges.x.max}
          minY={linkedDerived.positionRanges.y.min}
          maxY={linkedDerived.positionRanges.y.max}
          step={1}
          unit="px"
          onChange={(relX, relY) => {
            const nextAbsX = fromCenterRelativePosition(model, 'x', relX)
            const nextAbsY = fromCenterRelativePosition(model, 'y', relY)
            onChange((current) => (singleEye ? moveSingleEye(current, nextAbsX, nextAbsY) : movePair(current, nextAbsX, nextAbsY)))
          }}
        />
      </div>

      {/* Gaze 2D Pad */}
      <div className="vb-card-section">
        <div className="vb-section-label">GAZE DIRECTION (2D)</div>
        <XYPad
          label="Gaze Vector"
          valueX={model.gaze.x}
          valueY={model.gaze.y}
          minX={safeGaze.x.min}
          maxX={safeGaze.x.max}
          minY={safeGaze.y.min}
          maxY={safeGaze.y.max}
          step={0.05}
          unit=""
          onChange={(gx, gy) => {
            onChange((current) => {
              const withX = setGazeSafely(current, 'x', gx)
              return setGazeSafely(withX, 'y', gy)
            })
          }}
        />
      </div>

      {/* Geometry Sliders */}
      <div className="vb-card-section">
        <div className="vb-section-label">
          {singleEye ? 'EYE DIMENSIONS' : linkedEyes ? 'LINKED GEOMETRY' : 'INDEPENDENT GEOMETRY'}
        </div>

        {!singleEye && !linkedEyes && independentDerived && (
          <div className="vb-submode-switch-wrap">
            <ModeSwitch
              size="sm"
              value={independentSide}
              options={[
                { value: 'left', label: 'Left Eye' },
                { value: 'right', label: 'Right Eye' },
              ]}
              onChange={(val) => setIndependentSide(val as EyeSide)}
            />
          </div>
        )}

        {linkedEyes || singleEye ? (
          <div className="vb-sliders-grid">
            <TactileSlider
              label="Width"
              value={left.width}
              min={linkedDerived.dimensionRanges.width.min}
              max={linkedDerived.dimensionRanges.width.max}
              unit="px"
              onChange={(val) => onChange((cur) => setLinkedEyeDimensionSafely(cur, 'width', val))}
            />
            <TactileSlider
              label="Height"
              value={left.height}
              min={linkedDerived.dimensionRanges.height.min}
              max={linkedDerived.dimensionRanges.height.max}
              unit="px"
              onChange={(val) => onChange((cur) => setLinkedEyeDimensionSafely(cur, 'height', val))}
            />
            <TactileSlider
              label="Corner Radius"
              value={left.radius}
              min={linkedDerived.dimensionRanges.radius.min}
              max={linkedDerived.dimensionRanges.radius.max}
              unit="px"
              onChange={(val) => onChange((cur) => setLinkedEyeDimensionSafely(cur, 'radius', val))}
            />
            {!singleEye && (
              <>
                <TactileSlider
                  label="Eye Spacing"
                  value={currentSpacing}
                  min={spacingMin}
                  max={spacingMax}
                  unit="px"
                  onChange={(val) => onChange((cur) => setCanvasSafeAnchoredPairSpacing(cur, val))}
                />
                <TactileSlider
                  label="Rotation"
                  value={pairRotation(model)}
                  min={linkedDerived.rotationLimits.min}
                  max={linkedDerived.rotationLimits.max}
                  unit="°"
                  onChange={(val) => onChange((cur) => rotatePairSafely(cur, val))}
                />
              </>
            )}
          </div>
        ) : independentDerived ? (
          <div className="vb-sliders-grid">
            {(() => {
              const activeSide = independentSide
              const geom = activeSide === 'left' ? left : right
              const ranges = independentDerived[activeSide]
              return (
                <>
                  <TactileSlider
                    label={`${activeSide === 'left' ? 'Left' : 'Right'} Width`}
                    value={geom.width}
                    min={ranges.dimensionRanges.width.min}
                    max={ranges.dimensionRanges.width.max}
                    unit="px"
                    onChange={(val) => onChange((cur) => setIndependentEyeDimensionSafely(cur, activeSide, 'width', val))}
                  />
                  <TactileSlider
                    label={`${activeSide === 'left' ? 'Left' : 'Right'} Height`}
                    value={geom.height}
                    min={ranges.dimensionRanges.height.min}
                    max={ranges.dimensionRanges.height.max}
                    unit="px"
                    onChange={(val) => onChange((cur) => setIndependentEyeDimensionSafely(cur, activeSide, 'height', val))}
                  />
                  <TactileSlider
                    label={`${activeSide === 'left' ? 'Left' : 'Right'} Radius`}
                    value={geom.radius}
                    min={ranges.dimensionRanges.radius.min}
                    max={ranges.dimensionRanges.radius.max}
                    unit="px"
                    onChange={(val) => onChange((cur) => setIndependentEyeDimensionSafely(cur, activeSide, 'radius', val))}
                  />
                  <TactileSlider
                    label={`${activeSide === 'left' ? 'Left' : 'Right'} Rotation`}
                    value={geom.rotation}
                    min={ranges.rotationRange.min}
                    max={ranges.rotationRange.max}
                    unit="°"
                    onChange={(val) => onChange((cur) => setIndependentEyeRotationSafely(cur, activeSide, val))}
                  />
                </>
              )
            })()}
          </div>
        ) : null}
      </div>

      {/* Color Swatches */}
      <div className="vb-card-section">
        <div className="vb-section-label">COLORS & SHADER</div>
        <div className="vb-colors-deck">
          <label className="vb-color-picker-item">
            <span className="vb-color-label">Eye Fill</span>
            <div className="vb-color-chip-wrap">
              <input
                type="color"
                className="vb-color-input"
                value={model.colors.eye}
                onChange={(e) => onChange((cur) => ({ ...cur, colors: { ...cur.colors, eye: e.target.value } }))}
              />
              <span className="vb-color-code">{model.colors.eye.toUpperCase()}</span>
            </div>
          </label>

          <label className="vb-color-picker-item">
            <span className="vb-color-label">Eye Stroke</span>
            <div className="vb-color-chip-wrap">
              <input
                type="color"
                className="vb-color-input"
                value={model.colors.stroke ?? model.colors.eye}
                onChange={(e) => onChange((cur) => ({ ...cur, colors: { ...cur.colors, stroke: e.target.value } }))}
              />
              <span className="vb-color-code">{(model.colors.stroke ?? model.colors.eye).toUpperCase()}</span>
            </div>
          </label>

          <label className="vb-color-picker-item">
            <span className="vb-color-label">Background</span>
            <div className="vb-color-chip-wrap">
              <input
                type="color"
                className="vb-color-input"
                value={model.colors.background}
                onChange={(e) => onChange((cur) => ({ ...cur, colors: { ...cur.colors, background: e.target.value } }))}
              />
              <span className="vb-color-code">{model.colors.background.toUpperCase()}</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
