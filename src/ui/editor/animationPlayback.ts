import {
  advancePlaybackClock,
  createPlaybackClock,
  pausePlaybackClock,
  playPlaybackClock,
  seekPlaybackClock,
  setPlaybackRate,
  stopPlaybackClock,
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
