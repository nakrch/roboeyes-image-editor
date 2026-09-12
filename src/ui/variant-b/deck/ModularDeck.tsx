import { useState } from 'react'
import type { FaceModel } from '../../../core/model'
import type { PresetAnimationDefaults } from '../../../animation'
import type { AnimatedExportFrameResolver } from '../../../export/animatedAssets'
import { FaceDeckCard } from './FaceDeckCard'
import { ExpressionDeckCard } from './ExpressionDeckCard'
import { MotionDeckCard } from './MotionDeckCard'
import { ExportDeckCard } from './ExportDeckCard'

type DeckTabId = 'face' | 'expression' | 'motion' | 'export'

type ModularDeckProps = {
  model: FaceModel
  linkedEyes: boolean
  singleEye: boolean
  transparentBackground: boolean
  animationDefaults: PresetAnimationDefaults
  resolveAnimationFrame: AnimatedExportFrameResolver
  onChange: (updater: (current: FaceModel) => FaceModel) => void
  onLinkedEyesChange: (value: boolean) => void
  onSingleEyeLayoutChange: (enabled: boolean) => void
  onTransparentBackgroundChange: (value: boolean) => void
  onAnimationDefaultsChange: (next: PresetAnimationDefaults) => void
}

const DECK_TABS: Array<{ id: DeckTabId; label: string; icon: string }> = [
  { id: 'face', label: 'FACE', icon: '👁' },
  { id: 'expression', label: 'EXPRESSION', icon: '🎭' },
  { id: 'motion', label: 'MOTION', icon: '⚡' },
  { id: 'export', label: 'EXPORT', icon: '💾' },
]

export function ModularDeck({
  model,
  linkedEyes,
  singleEye,
  transparentBackground,
  animationDefaults,
  resolveAnimationFrame,
  onChange,
  onLinkedEyesChange,
  onSingleEyeLayoutChange,
  onTransparentBackgroundChange,
  onAnimationDefaultsChange,
}: ModularDeckProps) {
  const [activeTab, setActiveTab] = useState<DeckTabId>('face')

  return (
    <aside className="vb-modular-deck" aria-label="Modular Control Deck">
      {/* Top Deck Navigation Tabs */}
      <nav className="vb-deck-tabs-nav" role="tablist" aria-label="Control Deck Categories">
        {DECK_TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`deck-tabpanel-${tab.id}`}
              id={`deck-tab-${tab.id}`}
              className={`vb-deck-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="vb-deck-tab-icon">{tab.icon}</span>
              <span className="vb-deck-tab-label">{tab.label}</span>
              {isActive && <span className="vb-deck-tab-glow" />}
            </button>
          )
        })}
      </nav>

      {/* Tab Panels */}
      <div
        className="vb-deck-content-wrap"
        role="tabpanel"
        id={`deck-tabpanel-${activeTab}`}
        aria-labelledby={`deck-tab-${activeTab}`}
      >
        {activeTab === 'face' && (
          <FaceDeckCard
            model={model}
            linkedEyes={linkedEyes}
            onChange={onChange}
            onLinkedEyesChange={onLinkedEyesChange}
            onSingleEyeLayoutChange={onSingleEyeLayoutChange}
          />
        )}

        {activeTab === 'expression' && (
          <ExpressionDeckCard
            model={model}
            linkedEyes={linkedEyes}
            disabled={singleEye}
            onChange={onChange}
          />
        )}

        {activeTab === 'motion' && (
          <MotionDeckCard
            model={model}
            animationDefaults={animationDefaults}
            onAnimationDefaultsChange={onAnimationDefaultsChange}
          />
        )}

        {activeTab === 'export' && (
          <ExportDeckCard
            model={model}
            transparentBackground={transparentBackground}
            resolveAnimationFrame={resolveAnimationFrame}
            onChange={onChange}
            onTransparentBackgroundChange={onTransparentBackgroundChange}
          />
        )}
      </div>
    </aside>
  )
}
