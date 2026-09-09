import { describe, expect, it } from 'vitest'
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
} from './animationPlayback'

describe('animation playback session', () => {
  it('supports play, pause, stop, restart, and playback rate without wall-clock reads', () => {
    let session = createAnimationPlaybackSession()
    session = setAnimationPlaybackRate(session, 2)
    session = playAnimationPlayback(session)
    session = advanceAnimationPlayback(session, 125)
    expect(session.clock.positionMs).toBe(250)

    session = pauseAnimationPlayback(session)
    session = advanceAnimationPlayback(session, 500)
    expect(session.clock.positionMs).toBe(250)

    session = restartAnimationPlayback(session)
    expect(session.clock.status).toBe('playing')
    expect(session.clock.positionMs).toBe(0)

    session = advanceAnimationPlayback(session, 50)
    session = stopAnimationPlayback(session)
    expect(session.clock.status).toBe('stopped')
    expect(session.clock.positionMs).toBe(0)
  })

  it('does not count hidden browser time and resumes only when playback was active', () => {
    let session = playAnimationPlayback(createAnimationPlaybackSession())
    session = advanceAnimationPlayback(session, 100)
    session = setAnimationDocumentHidden(session, true)
    expect(session.clock.status).toBe('paused')
    expect(session.resumeAfterVisibility).toBe(true)

    session = advanceAnimationPlayback(session, 20_000)
    expect(session.clock.positionMs).toBe(100)

    session = setAnimationDocumentHidden(session, false)
    expect(session.clock.status).toBe('playing')
    expect(session.resumeAfterVisibility).toBe(false)

    const deliberatelyPaused = setAnimationDocumentHidden(
      pauseAnimationPlayback(session),
      true,
    )
    expect(setAnimationDocumentHidden(deliberatelyPaused, false).clock.status).toBe('paused')
  })

  it('pauses and seeks to the selected sequence step hold frame', () => {
    const program = {
      version: 1 as const,
      id: 'animation:preview',
      playbackMode: 'loop' as const,
      steps: [
        {
          id: 'step:one',
          target: {},
          transitionDurationMs: 0,
          easing: 'linear' as const,
          holdDurationMs: 800,
        },
        {
          id: 'step:two',
          target: {},
          transitionDurationMs: 200,
          easing: 'ease-in-out' as const,
          holdDurationMs: 600,
        },
      ],
    }
    const session = previewAnimationProgramStep(
      playAnimationPlayback(createAnimationPlaybackSession()),
      program,
      'step:two',
    )
    expect(session.clock.status).toBe('paused')
    expect(session.clock.positionMs).toBe(1_000)
    expect(session.resumeAfterVisibility).toBe(false)
  })
})
