import { useOverscrollProgress, type OverscrollProgressStore } from './useSectionOverscroll'

type SectionLabel = { name: string; number: string }

/** Sticky top overlay shown only while overscrolling upward toward the previous section. */
export function SectionPreviousOverlay({ store, section }: { store: OverscrollProgressStore; section: SectionLabel }) {
  const progress = useOverscrollProgress(store)
  if (progress.direction !== 'previous' || progress.value <= 0) return null
  return (
    <div className="re-section-previous" aria-hidden="true">
      <div className="re-section-previous-bar">
        <span>PREVIOUS&nbsp; {section.number} {section.name} ↑</span>
        <span className="re-section-progress" style={{ transform: `scaleX(${progress.value})` }} />
      </div>
    </div>
  )
}

/** Panel-end row that switches to the next section and shows downward overscroll progress. */
export function SectionNextButton({ store, section, onClick }: { store: OverscrollProgressStore; section: SectionLabel; onClick: () => void }) {
  const progress = useOverscrollProgress(store)
  return (
    <button type="button" className="re-section-next" aria-label={`Next section: ${section.name}`} onClick={onClick}>
      <span>NEXT&nbsp; {section.number} {section.name} ↓</span>
      <span className="re-section-progress" style={{ transform: `scaleX(${progress.direction === 'next' ? progress.value : 0})` }} />
    </button>
  )
}
