export const EASING_IDS = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'smoothstep',
] as const

export type EasingId = typeof EASING_IDS[number]

export function isEasingId(value: string): value is EasingId {
  return (EASING_IDS as readonly string[]).includes(value)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Easing progress must be finite')
  }
  return Math.min(1, Math.max(0, value))
}

/**
 * Resolve a stable serializable easing identifier to a deterministic value.
 * Executable easing functions never become authored/persisted animation data.
 */
export function applyEasing(easing: EasingId, progress: number): number {
  const t = clamp01(progress)

  switch (easing) {
    case 'linear':
      return t
    case 'ease-in':
      return t * t
    case 'ease-out':
      return 1 - (1 - t) * (1 - t)
    case 'ease-in-out':
      return t < 0.5
        ? 2 * t * t
        : 1 - ((-2 * t + 2) ** 2) / 2
    case 'smoothstep':
      return t * t * (3 - 2 * t)
  }
}
