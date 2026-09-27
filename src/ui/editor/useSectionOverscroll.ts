import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SECTION_OVERSCROLL_IDLE_MS, SectionOverscrollTracker } from './sectionOverscroll'
import type { OverscrollDirection } from './sectionOverscroll'
import type { EditorSectionId } from '../sections/sectionIds'

function nestedScrollConsumes(target: EventTarget | null, inspector: HTMLElement, deltaY: number): boolean {
  let node = target instanceof Node ? target : null
  while (node && node !== inspector) {
    if (node instanceof Element) {
      if (node.matches('select, textarea')) return true
      if (node instanceof HTMLElement) {
        const overflow = getComputedStyle(node).overflowY
        if ((overflow === 'auto' || overflow === 'scroll') &&
          (deltaY > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 1)) return true
      }
    }
    node = node.parentNode
  }
  return false
}

export function useSectionOverscroll(
  selected: EditorSectionId,
  neighbors: { next?: EditorSectionId; previous?: EditorSectionId },
  select: (section: EditorSectionId) => void,
) {
  const inspectorRef = useRef<HTMLElement>(null)
  const tracker = useRef(new SectionOverscrollTracker())
  const [progress, setProgressState] = useState<{ direction: OverscrollDirection | null; value: number }>({ direction: null, value: 0 })
  // Normal scrolling emits wheel events continuously; only re-render the shell when the indicator changes.
  const setProgress = (direction: OverscrollDirection | null, value: number) =>
    setProgressState((current) => (current.direction === direction && current.value === value ? current : { direction, value }))
  const pendingScroll = useRef<OverscrollDirection | null>(null)
  const timer = useRef<number | null>(null)
  const latest = useRef({ neighbors, select })
  latest.current = { neighbors, select }

  const clearProgress = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setProgress(null, 0)
  }

  const changeSection = (section: EditorSectionId, direction: OverscrollDirection | null = null) => {
    tracker.current.reset()
    clearProgress()
    pendingScroll.current = direction
    if (section === selected) {
      if (inspectorRef.current) inspectorRef.current.scrollTop = 0
      pendingScroll.current = null
    } else select(section)
  }

  useLayoutEffect(() => {
    if (inspectorRef.current) {
      inspectorRef.current.scrollTop = pendingScroll.current === 'previous' ? inspectorRef.current.scrollHeight : 0
    }
    pendingScroll.current = null
  }, [selected])

  useEffect(() => {
    const inspector = inspectorRef.current
    if (!inspector) return
    // Chromium applies passive wheel scrolling before dispatching the event, so the edge state read
    // in the handler may already include this event's own scroll. Any recent scroll, or a scrollTop
    // change within the current wheel stream, means the wheel is still moving content.
    let lastScrollAt = Number.NEGATIVE_INFINITY
    let lastWheel: { at: number; scrollTop: number } | null = null
    const onScroll = (event: Event) => { lastScrollAt = event.timeStamp }
    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || !['auto', 'scroll'].includes(getComputedStyle(inspector).overflowY)) return
      const scrollTop = inspector.scrollTop
      const moved = nestedScrollConsumes(event.target, inspector, event.deltaY)
        || event.timeStamp - lastScrollAt < SECTION_OVERSCROLL_IDLE_MS
        || (lastWheel !== null && event.timeStamp - lastWheel.at < SECTION_OVERSCROLL_IDLE_MS && lastWheel.scrollTop !== scrollTop)
      lastWheel = { at: event.timeStamp, scrollTop }
      const state = tracker.current.wheel({
        deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode,
        atTop: !moved && scrollTop <= 1,
        atBottom: !moved && scrollTop + inspector.clientHeight >= inspector.scrollHeight - 1,
        pageHeightPx: inspector.clientHeight, timeStamp: event.timeStamp,
      })
      const neighbor = state.direction ? latest.current.neighbors[state.direction] : undefined
      setProgress(neighbor ? state.direction : null, neighbor ? state.progress : 0)
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        tracker.current.reset()
        setProgress(null, 0)
        timer.current = null
      }, SECTION_OVERSCROLL_IDLE_MS)
      if (state.switchTo) {
        const destination = latest.current.neighbors[state.switchTo]
        if (destination) {
          pendingScroll.current = state.switchTo
          setProgress(null, 0)
          latest.current.select(destination)
        }
      }
    }
    inspector.addEventListener('scroll', onScroll, { passive: true })
    inspector.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      inspector.removeEventListener('scroll', onScroll)
      inspector.removeEventListener('wheel', onWheel)
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])

  return { inspectorRef, progress, changeSection }
}
