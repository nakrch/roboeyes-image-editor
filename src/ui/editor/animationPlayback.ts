import {
  advancePlaybackClock,
  createPlaybackClock,
  pausePlaybackClock,
  playPlaybackClock,
  seekPlaybackClock,
  setPlaybackRate,
  stopPlaybackClock,
  type AnimationProgram,
  type PlaybackClockState,
} from '../../animation'

export type AnimationPlaybackSession = {
  clock: PlaybackClockState
  resumeAfterVisibility: boolean
}

export function createAnimationPlaybackSession(): AnimationPlaybackSession {
  return { clock: createPlaybackClock(), resumeAfterVisibility: false }
}

export function playAnimationPlayback(session: AnimationPlaybackSession): AnimationPlaybackSession {
  return { ...session, clock: playPlaybackClock(session.clock), resumeAfterVisibility: false }
}

export function pauseAnimationPlayback(session: AnimationPlaybackSession): AnimationPlaybackSession {
  return { ...session, clock: pausePlaybackClock(session.clock), resumeAfterVisibility: false }
}

export function stopAnimationPlayback(session: AnimationPlaybackSession): AnimationPlaybackSession {
  return { clock: stopPlaybackClock(session.clock), resumeAfterVisibility: false }
}

export function restartAnimationPlayback(session: AnimationPlaybackSession): AnimationPlaybackSession {
  return {
    clock: playPlaybackClock(seekPlaybackClock(session.clock, 0)),
    resumeAfterVisibility: false,
  }
}

export function setAnimationPlaybackRate(
  session: AnimationPlaybackSession,
  playbackRate: number,
): AnimationPlaybackSession {
  return { ...session, clock: setPlaybackRate(session.clock, playbackRate) }
}

export function advanceAnimationPlayback(
  session: AnimationPlaybackSession,
  elapsedRealMs: number,
): AnimationPlaybackSession {
  return { ...session, clock: advancePlaybackClock(session.clock, elapsedRealMs) }
}

/** Pause and seek to the selected step's first forward hold frame. */
export function previewAnimationProgramStep(
  session: AnimationPlaybackSession,
  program: AnimationProgram,
  stepId: string,
): AnimationPlaybackSession {
  const index = program.steps.findIndex((step) => step.id === stepId)
  if (index < 0) return pauseAnimationPlayback(session)
  let positionMs = 0
  for (let cursor = 0; cursor < index; cursor += 1) {
    const step = program.steps[cursor]
    positionMs += step.transitionDurationMs + step.holdDurationMs
  }
  positionMs += program.steps[index].transitionDurationMs
  return {
    clock: pausePlaybackClock(seekPlaybackClock(session.clock, positionMs)),
    resumeAfterVisibility: false,
  }
}

/** Hidden browser time never contributes to logical animation time. */
export function setAnimationDocumentHidden(
  session: AnimationPlaybackSession,
  hidden: boolean,
): AnimationPlaybackSession {
  if (hidden) {
    if (session.clock.status !== 'playing') return session
    return {
      clock: pausePlaybackClock(session.clock),
      resumeAfterVisibility: true,
    }
  }
  if (!session.resumeAfterVisibility) return session
  return {
    clock: playPlaybackClock(session.clock),
    resumeAfterVisibility: false,
  }
}
