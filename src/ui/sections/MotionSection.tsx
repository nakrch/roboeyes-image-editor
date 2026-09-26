import { AnimationPanel } from '../controls/AnimationPanel'
import type { EditorController } from '../editor/useEditorController'

export function MotionSection({ controller }: { controller: EditorController }) {
  return (
    <section className="re-section re-motion" aria-labelledby="re-motion-title">
      <header className="re-section-header">
        <h2 id="re-motion-title">Motion</h2>
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
