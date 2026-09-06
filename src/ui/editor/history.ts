export type HistoryState<T> = {
  past: T[]
  present: T
  future: T[]
}

export function commitHistory<T>(
  current: HistoryState<T>,
  next: T,
  limit: number,
  replacePresent = false,
): HistoryState<T> {
  if (next === current.present) return current

  if (replacePresent) {
    return {
      ...current,
      present: next,
      future: [],
    }
  }

  return {
    past: [...current.past, current.present].slice(-limit),
    present: next,
    future: [],
  }
}

export function undoHistory<T>(current: HistoryState<T>): HistoryState<T> {
  const previous = current.past.at(-1)
  if (!previous) return current
  return {
    past: current.past.slice(0, -1),
    present: previous,
    future: [current.present, ...current.future],
  }
}

export function redoHistory<T>(current: HistoryState<T>, limit: number): HistoryState<T> {
  const next = current.future[0]
  if (!next) return current
  return {
    past: [...current.past, current.present].slice(-limit),
    present: next,
    future: current.future.slice(1),
  }
}
