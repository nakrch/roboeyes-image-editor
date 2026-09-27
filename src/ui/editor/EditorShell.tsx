import { useEffect, useState } from 'react'
import { ContinuousEditProvider } from './continuousEdit'
import { useEditorController } from './useEditorController'
import { DisplaySection, EyesSection, ExpressionSection } from '../sections/FaceSections'
import { MotionSection } from '../sections/MotionSection'
import { LibrarySection } from '../sections/LibrarySection'
import { ExportSection } from '../sections/ExportSection'
import type { EditorSectionId } from '../sections/sectionIds'
import { SpecimenStage } from '../stage/SpecimenStage'
import { useSectionOverscroll } from './useSectionOverscroll'
import { SectionNextButton, SectionPreviousOverlay } from './SectionOverscrollIndicators'

type NavigationGroup = { label: string; sections: { id: EditorSectionId; name: string; number: string }[] }

const navigation: NavigationGroup[] = [
  { label: 'FACE', sections: [{ id: 'display', name: 'Display', number: '01' }, { id: 'eyes', name: 'Eyes', number: '02' }, { id: 'expression', name: 'Expression', number: '03' }] },
  { label: 'MOTION', sections: [{ id: 'motion', name: 'Motion', number: '04' }] },
  { label: 'LIBRARY', sections: [{ id: 'library', name: 'Presets', number: '05' }] },
  { label: 'OUTPUT', sections: [{ id: 'export', name: 'Export', number: '06' }] },
]
const sections = navigation.flatMap((group) => group.sections)

export function EditorShell() {
  const controller = useEditorController()
  const [selected, setSelected] = useState<EditorSectionId>('eyes')
  const sectionIndex = sections.findIndex((item) => item.id === selected)
  const previous = sections[sectionIndex - 1]
  const next = sections[sectionIndex + 1]
  const { inspectorRef, progress, changeSection } = useSectionOverscroll(
    selected,
    { previous: previous?.id, next: next?.id },
    setSelected,
  )
  const preset = controller.presets.find((item) => item.id === controller.displayedPresetId)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('textarea, select, [contenteditable="true"]') || (target instanceof HTMLInputElement && !['range', 'checkbox', 'color', 'radio'].includes(target.type)))) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      if (key === 'y' && event.shiftKey) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) controller.redo()
      else controller.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller.undo, controller.redo])

  const content = (() => {
    switch (selected) {
      case 'display': return <DisplaySection controller={controller} />
      case 'eyes': return <EyesSection controller={controller} />
      case 'expression': return <ExpressionSection controller={controller} />
      case 'motion': return <MotionSection controller={controller} />
      case 'library': return <LibrarySection controller={controller} />
      case 'export': return <ExportSection controller={controller} />
    }
  })()

  return (
    <div className="re-app">
      <ContinuousEditProvider value={controller.continuousEdit}>
        <header className="re-header">
          <div className="re-brand"><svg width="30" height="22" viewBox="0 0 30 22" fill="none" aria-hidden="true"><rect x="2" y="5" width="11" height="12" rx="4" fill="currentColor" /><rect x="17" y="5" width="11" height="12" rx="4" fill="currentColor" /></svg><strong>RoboEyes</strong><span className="re-brand-edition">/ EDITOR</span></div>
          <div className="re-document"><span>{preset?.name ?? 'Custom'}</span><span className="re-document-dims">{controller.model.canvas.width} × {controller.model.canvas.height}</span></div>
          <div className="re-header-actions"><button type="button" className="re-button re-button--quiet" onClick={controller.undo} disabled={!controller.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5 3 9l4 4M3 9h9a5 5 0 0 1 5 5v1" /></svg></button><button type="button" className="re-button re-button--quiet" onClick={controller.redo} disabled={!controller.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m13 5 4 4-4 4m4-4H8a5 5 0 0 0-5 5v1" /></svg></button><button type="button" className="re-button re-button--quiet re-reset" onClick={controller.reset} aria-label="Reset" title="Reset to preset">Reset</button><button type="button" className="re-button re-button--primary" onClick={() => setSelected('export')}>Export <span aria-hidden="true">↗</span></button></div>
        </header>
        <main className="re-workspace">
          <nav className="re-outline" aria-label="Editor sections">{navigation.map((group) => <div className="re-outline-group" key={group.label}><span className="re-outline-label">{group.label}</span>{group.sections.map((item) => <button type="button" key={item.id} className="re-outline-link" aria-current={selected === item.id ? 'page' : undefined} onClick={() => changeSection(item.id)}><span>{item.name}</span><span className="re-outline-number">{item.number}</span></button>)}</div>)}</nav>
          <SpecimenStage controller={controller} />
          <aside ref={inspectorRef} className="re-inspector" aria-label="Selected editor section">
            {previous && <SectionPreviousOverlay store={progress} section={previous} />}
            {content}
            {next && <SectionNextButton store={progress} section={next} onClick={() => changeSection(next.id, 'next')} />}
          </aside>
        </main>
      </ContinuousEditProvider>
    </div>
  )
}
