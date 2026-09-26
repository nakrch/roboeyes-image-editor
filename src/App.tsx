import { EditorShell } from './ui/editor/EditorShell'
import { ToastProvider } from './ui/feedback/ToastProvider'

export function App() {
  return (
    <ToastProvider>
      <EditorShell />
    </ToastProvider>
  )
}
