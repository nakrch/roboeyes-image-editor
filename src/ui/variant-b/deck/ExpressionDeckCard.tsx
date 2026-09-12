import { useState } from 'react'
import type { EyeExpression, FaceModel } from '../../../core/model'
import {
  isDirectionalLidKey,
  setIndependentComposedLidSafely,
  setIndependentDirectionalLidSafely,
  setSharedComposedLidSafely,
  setSharedDirectionalLidSafely,
} from '../../editor/directionalLidSafety'
import {
  isGazeReactiveKey,
  setIndependentGazeReactiveSafely,
  setSharedGazeReactiveSafely,
} from '../../editor/gazeReactiveSafety'
import {
  isExpressionGeometryKey,
  isLidKey,
  setSharedExpressionGeometrySafely,
} from '../../editor/geometrySafety'
import {
  setIndependentExpressionGeometrySafely,
} from '../../editor/independentExpressionSafety'
import { ModeSwitch } from '../controls/ModeSwitch'
import { TactileSlider } from '../controls/TactileSlider'

type ExpressionDeckCardProps = {
  model: FaceModel
  linkedEyes: boolean
  disabled?: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
}

function getExpressionValue(expression: EyeExpression, key: keyof EyeExpression): number {
  if (key === 'heightScale') return expression.heightScale ?? 1
  if (key === 'upperLidInner') return expression.upperLidInner ?? 0
  if (key === 'upperLidOuter') return expression.upperLidOuter ?? 0
  if (key === 'lowerLidCurvature') return expression.lowerLidCurvature ?? 0
  if (key === 'gazeHeightExpansion') return expression.gazeHeightExpansion ?? 0
  if (key === 'gazeHeightThreshold') return expression.gazeHeightThreshold ?? 0.15
  return (expression[key] as number) ?? 0
}

export function ExpressionDeckCard({
  model,
  linkedEyes,
  disabled = false,
  onChange,
}: ExpressionDeckCardProps) {
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left')

  const updateShared = (key: keyof EyeExpression, value: number) => {
    if (disabled) return
    if (isExpressionGeometryKey(key)) {
      onChange((cur) => setSharedExpressionGeometrySafely(cur, key, value))
      return
    }
    if (isGazeReactiveKey(key)) {
      onChange((cur) => setSharedGazeReactiveSafely(cur, key, value))
      return
    }
    if (isDirectionalLidKey(key)) {
      onChange((cur) => setSharedDirectionalLidSafely(cur, key, value))
      return
    }
    if (isLidKey(key)) {
      onChange((cur) => setSharedComposedLidSafely(cur, key, value))
      return
    }
    onChange((cur) => ({
      ...cur,
      expression: { ...cur.expression, [key]: value, leftEye: undefined, rightEye: undefined },
    }))
  }

  const updateSide = (side: 'left' | 'right', key: keyof EyeExpression, value: number) => {
    if (disabled) return
    if (isExpressionGeometryKey(key)) {
      onChange((cur) => setIndependentExpressionGeometrySafely(cur, side, key, value))
      return
    }
    if (isGazeReactiveKey(key)) {
      onChange((cur) => setIndependentGazeReactiveSafely(cur, side, key, value))
      return
    }
    if (isDirectionalLidKey(key)) {
      onChange((cur) => setIndependentDirectionalLidSafely(cur, side, key, value))
      return
    }
    if (isLidKey(key)) {
      onChange((cur) => setIndependentComposedLidSafely(cur, side, key, value))
      return
    }
    onChange((cur) => {
      const currentSide = (cur.expression[side === 'left' ? 'leftEye' : 'rightEye'] ?? cur.expression) as EyeExpression
      return {
        ...cur,
        expression: {
          ...cur.expression,
          [side === 'left' ? 'leftEye' : 'rightEye']: {
            ...currentSide,
            [key]: value,
          },
        },
      }
    })
  }

  const currentExpr = linkedEyes
    ? model.expression
    : (model.expression[activeSide === 'left' ? 'leftEye' : 'rightEye'] ?? model.expression) as EyeExpression

  return (
    <div className={`vb-deck-card vb-expression-card ${disabled ? 'disabled' : ''}`}>
      {disabled && (
        <div className="vb-card-disabled-banner">
          Cyclops layout uses fixed neutral expression.
        </div>
      )}

      {!linkedEyes && !disabled && (
        <div className="vb-card-section">
          <div className="vb-section-label">ASYMMETRIC EXPRESSION TARGET</div>
          <ModeSwitch
            size="sm"
            value={activeSide}
            options={[
              { value: 'left', label: 'Left Eye Expression' },
              { value: 'right', label: 'Right Eye Expression' },
            ]}
            onChange={(val) => setActiveSide(val as 'left' | 'right')}
          />
        </div>
      )}

      {/* Upper Lid Controls */}
      <div className="vb-card-section">
        <div className="vb-section-label">UPPER EYELID</div>
        <div className="vb-sliders-grid">
          <TactileSlider
            label="Upper Lid Coverage"
            value={getExpressionValue(currentExpr, 'upperLid')}
            min={0}
            max={1}
            step={0.05}
            unit=""
            disabled={disabled}
            onChange={(val) =>
              linkedEyes ? updateShared('upperLid', val) : updateSide(activeSide, 'upperLid', val)
            }
          />
          <TactileSlider
            label="Inner Lid Offset"
            value={getExpressionValue(currentExpr, 'upperLidInner')}
            min={0}
            max={1}
            step={0.05}
            unit=""
            disabled={disabled}
            onChange={(val) =>
              linkedEyes ? updateShared('upperLidInner', val) : updateSide(activeSide, 'upperLidInner', val)
            }
          />
          <TactileSlider
            label="Outer Lid Offset"
            value={getExpressionValue(currentExpr, 'upperLidOuter')}
            min={0}
            max={1}
            step={0.05}
            unit=""
            disabled={disabled}
            onChange={(val) =>
              linkedEyes ? updateShared('upperLidOuter', val) : updateSide(activeSide, 'upperLidOuter', val)
            }
          />
        </div>
      </div>

      {/* Lower Lid Controls */}
      <div className="vb-card-section">
        <div className="vb-section-label">LOWER EYELID</div>
        <div className="vb-sliders-grid">
          <TactileSlider
            label="Lower Lid Coverage"
            value={getExpressionValue(currentExpr, 'lowerLid')}
            min={0}
            max={1}
            step={0.05}
            unit=""
            disabled={disabled}
            onChange={(val) =>
              linkedEyes ? updateShared('lowerLid', val) : updateSide(activeSide, 'lowerLid', val)
            }
          />
          <TactileSlider
            label="Lower Lid Curvature"
            value={getExpressionValue(currentExpr, 'lowerLidCurvature')}
            min={0}
            max={1}
            step={0.05}
            unit=""
            disabled={disabled}
            onChange={(val) =>
              linkedEyes
                ? updateShared('lowerLidCurvature', val)
                : updateSide(activeSide, 'lowerLidCurvature', val)
            }
          />
        </div>
      </div>

      {/* Pose & Reactive Expansion */}
      <div className="vb-card-section">
        <div className="vb-section-label">TILT & DYNAMIC REACTIVITY</div>
        <div className="vb-sliders-grid">
          <TactileSlider
            label="Expression Tilt"
            value={getExpressionValue(currentExpr, 'tilt')}
            min={-30}
            max={30}
            step={0.5}
            unit="°"
            disabled={disabled}
            onChange={(val) =>
              linkedEyes ? updateShared('tilt', val) : updateSide(activeSide, 'tilt', val)
            }
          />
          <TactileSlider
            label="Eye Height Scale"
            value={getExpressionValue(currentExpr, 'heightScale')}
            min={0.5}
            max={1.5}
            step={0.02}
            unit="x"
            disabled={disabled}
            onChange={(val) =>
              linkedEyes ? updateShared('heightScale', val) : updateSide(activeSide, 'heightScale', val)
            }
          />
          <TactileSlider
            label="Gaze Height Expansion"
            value={getExpressionValue(currentExpr, 'gazeHeightExpansion')}
            min={0}
            max={1}
            step={0.05}
            unit=""
            disabled={disabled}
            onChange={(val) =>
              linkedEyes
                ? updateShared('gazeHeightExpansion', val)
                : updateSide(activeSide, 'gazeHeightExpansion', val)
            }
          />
          <TactileSlider
            label="Expansion Threshold"
            value={getExpressionValue(currentExpr, 'gazeHeightThreshold')}
            min={0}
            max={1}
            step={0.05}
            unit=""
            disabled={disabled}
            onChange={(val) =>
              linkedEyes
                ? updateShared('gazeHeightThreshold', val)
                : updateSide(activeSide, 'gazeHeightThreshold', val)
            }
          />
        </div>
      </div>
    </div>
  )
}
