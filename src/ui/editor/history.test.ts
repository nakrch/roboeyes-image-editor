import { describe, expect, it } from 'vitest'
import { commitHistory, redoHistory, undoHistory, type HistoryState } from './history'

describe('editor history', () => {
  it('coalesces intermediate continuous edits into one undo step', () => {
    let history: HistoryState<number> = { past: [], present: 10, future: [] }

    history = commitHistory(history, 11, 100)
    history = commitHistory(history, 12, 100, true)
    history = commitHistory(history, 13, 100, true)

    expect(history).toEqual({ past: [10], present: 13, future: [] })

    history = undoHistory(history)
    expect(history.present).toBe(10)
    expect(history.future).toEqual([13])

    history = redoHistory(history, 100)
    expect(history.present).toBe(13)
  })

  it('keeps separate gestures as separate undo steps', () => {
    let history: HistoryState<number> = { past: [], present: 10, future: [] }

    history = commitHistory(history, 20, 100)
    history = commitHistory(history, 30, 100)

    expect(undoHistory(history).present).toBe(20)
  })

  it('clears redo when a new edit is committed', () => {
    let history: HistoryState<number> = { past: [10], present: 20, future: [30] }
    history = commitHistory(history, 25, 100)
    expect(history.future).toEqual([])
  })
})
