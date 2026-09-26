import { AnimationPanel } from '../../controls/AnimationPanel'
import type { EditorController } from '../../editor/useEditorController'
import '../variant-c-sections.css'

export function MotionSection({ controller }: { controller: EditorController }) {
  return (
    <section className="vc-section vc-motion" aria-labelledby="vc-motion-title">
      <header className="vc-section-header">
        <h2 id="vc-motion-title">Motion</h2>
        <p>Time, behavior, and authored sequences.</p>
      </header>
      <AnimationPanel
        model={controller.model}
        animationDefaults={controller.animationDefaults}
        playback={controller.playback}
        reducedMotion={controller.reducedMotion}
        onAnimationDefaultsChange={controller.updateAnimationDefaults}
        onPlay={controller.play}
        onPause={controller.pause}
        onStop={controller.stop}
        onRestart={controller.restart}
        onPlaybackRateChange={controller.setPlaybackRate}
        onTrigger={controller.triggerAnimation}
        onPreviewSequenceStep={controller.previewSequenceStep}
      />
    </section>
  )
}
