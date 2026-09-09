import type { FaceModel } from '../core/model'

export type AnimationExportSamplingOptions = {
  durationMs: number
  fps: number
}

export type AnimationExportFrame = {
  index: number
  timeMs: number
  durationMs: number
  model: FaceModel
}

export type AnimationFrameResolver = (timeMs: number) => FaceModel

function finitePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`)
  }
  return value
}

/**
 * Build the logical timestamps used by animated-image export.
 *
 * The schedule is derived only from duration/FPS. It never observes
 * requestAnimationFrame, wall-clock time, playback state, or dropped frames.
 * The final frame duration is clipped so the encoded animation duration remains
 * exactly the authored export duration even when durationMs is not divisible by
 * the frame interval.
 */
export function animationExportSchedule(
  options: AnimationExportSamplingOptions,
): readonly { index: number; timeMs: number; durationMs: number }[] {
  const durationMs = finitePositive(options.durationMs, 'durationMs')
  const fps = finitePositive(options.fps, 'fps')
  const intervalMs = 1000 / fps
  const frameCount = Math.max(1, Math.ceil(durationMs / intervalMs))

  return Array.from({ length: frameCount }, (_, index) => {
    const timeMs = index * intervalMs
    return {
      index,
      timeMs,
      durationMs: Math.min(intervalMs, durationMs - timeMs),
    }
  })
}

/**
 * Resolve an export frame sequence by direct logical-time sampling.
 *
 * Keeping the resolver injected makes the export layer independent from the
 * editor/runtime implementation. The caller can resolve the same deterministic
 * animation definition + seed used by Preview without moving encoder concerns
 * into the animation model or renderer.
 */
export function sampleAnimationExportFrames(
  options: AnimationExportSamplingOptions,
  resolveFrame: AnimationFrameResolver,
): readonly AnimationExportFrame[] {
  return animationExportSchedule(options).map((sample) => ({
    ...sample,
    model: structuredClone(resolveFrame(sample.timeMs)),
  }))
}
