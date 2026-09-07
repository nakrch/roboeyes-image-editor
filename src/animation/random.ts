export const MAX_ANIMATION_SEED = 0xffff_ffff
const UINT32_RANGE = 0x1_0000_0000

export function normalizeAnimationSeed(seed: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_ANIMATION_SEED) {
    throw new RangeError(`Animation seed must be an integer from 0 to ${MAX_ANIMATION_SEED}`)
  }
  return seed >>> 0
}

function assertStreamName(stream: string): void {
  if (stream.length === 0) {
    throw new RangeError('Random stream name must not be empty')
  }
}

function normalizeSampleIndex(index: number): number {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('Random sample index must be a non-negative safe integer')
  }
  return index
}

function hashString32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mix32(value: number): number {
  let mixed = value >>> 0
  mixed ^= mixed >>> 16
  mixed = Math.imul(mixed, 0x7feb352d)
  mixed ^= mixed >>> 15
  mixed = Math.imul(mixed, 0x846ca68b)
  mixed ^= mixed >>> 16
  return mixed >>> 0
}

/** Derive a stable 32-bit seed for one named random channel. */
export function deriveRandomStreamSeed(seed: number, stream: string): number {
  const normalizedSeed = normalizeAnimationSeed(seed)
  assertStreamName(stream)
  return mix32(normalizedSeed ^ hashString32(stream))
}

/**
 * Stateless indexed random sampling. The same seed/stream/index always returns
 * the same uint32 regardless of which other streams or indices were sampled.
 */
export function sampleRandomUint32(seed: number, stream: string, index: number): number {
  const streamSeed = deriveRandomStreamSeed(seed, stream)
  const normalizedIndex = normalizeSampleIndex(index)
  const low = normalizedIndex >>> 0
  const high = Math.floor(normalizedIndex / UINT32_RANGE) >>> 0
  const indexed = streamSeed ^ mix32(low ^ 0x9e3779b9) ^ mix32(high ^ 0x85ebca6b)
  return mix32(indexed)
}

/** Return a deterministic value in the half-open range [0, 1). */
export function sampleRandomUnit(seed: number, stream: string, index: number): number {
  return sampleRandomUint32(seed, stream, index) / UINT32_RANGE
}

/** Return a deterministic value in the half-open range [min, max). */
export function sampleRandomRange(
  seed: number,
  stream: string,
  index: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    throw new RangeError('Random range requires finite values with max >= min')
  }
  if (max === min) return min
  return min + sampleRandomUnit(seed, stream, index) * (max - min)
}
