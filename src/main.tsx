import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import './styles.css'
import './historyControls.css'
import './animationControls.css'
import './previewCompact.css'
import './ui/feedback/toast.css'
import './studio.css'
import './studioPresets.css'
import './studioPolish.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
