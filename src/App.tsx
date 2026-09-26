import { VariantCShell } from './ui/variant-c/VariantCShell'
import { EditorShell } from './ui/editor/EditorShell'
import { ToastProvider } from './ui/feedback/ToastProvider'

export function App() {
  // Variant C is the default; retain the original editor for direct comparison.
  const classic = new URLSearchParams(window.location.search).get('variant') === 'classic'
  return (
    <ToastProvider>
      {classic ? <EditorShell /> : <VariantCShell />}
    </ToastProvider>
  )
}
