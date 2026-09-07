export type PlaybackClockStatus = 'stopped' | 'playing' | 'paused'

export type PlaybackClockState = {
  status: PlaybackClockStatus
  positionMs: number
  playbackRate: number
}

function normalizeTimeMs(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function normalizePlaybackRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('Playback rate must be a finite number greater than zero')
  }
  return value
}

export function createPlaybackClock(
  positionMs = 0,
  playbackRate = 1,
): PlaybackClockState {
  return {
    status: 'stopped',
    positionMs: normalizeTimeMs(positionMs, 'Playback position'),
    playbackRate: normalizePlaybackRate(playbackRate),
  }
}

export function playPlaybackClock(clock: PlaybackClockState): PlaybackClockState {
  return { ...clock, status: 'playing' }
}

export function pausePlaybackClock(clock: PlaybackClockState): PlaybackClockState {
  return { ...clock, status: 'paused' }
}

export function stopPlaybackClock(clock: PlaybackClockState): PlaybackClockState {
  return { ...clock, status: 'stopped', positionMs: 0 }
}

export function seekPlaybackClock(clock: PlaybackClockState, positionMs: number): PlaybackClockState {
  return { ...clock, positionMs: normalizeTimeMs(positionMs, 'Playback position') }
}

export function setPlaybackRate(clock: PlaybackClockState, playbackRate: number): PlaybackClockState {
  return { ...clock, playbackRate: normalizePlaybackRate(playbackRate) }
}

/**
 * Advance the logical clock by an externally supplied elapsed duration.
 * This module never reads Date/performance/requestAnimationFrame itself.
 */
export function advancePlaybackClock(
  clock: PlaybackClockState,
  elapsedRealMs: number,
): PlaybackClockState {
  const elapsed = normalizeTimeMs(elapsedRealMs, 'Elapsed realtime')
  if (clock.status !== 'playing' || elapsed === 0) return { ...clock }
  return {
    ...clock,
    positionMs: clock.positionMs + elapsed * clock.playbackRate,
  }
}
