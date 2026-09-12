import { EditorShell } from './ui/editor/EditorShell'
import { VariantBShell } from './ui/variant-b/VariantBShell'
import { ToastProvider } from './ui/feedback/ToastProvider'

export function App() {
  // On branch ui/variant-b-gemini-exploration, Variant B is the default exploration UI.
  // URL param ?variant=classic allows instant side-by-side comparison with the baseline.
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isClassic = searchParams?.get('variant') === 'classic'

  return (
    <ToastProvider>
      {isClassic ? <EditorShell /> : <VariantBShell />}
    </ToastProvider>
  )
}
