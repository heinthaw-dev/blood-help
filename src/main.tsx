import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Side-effect import: arms the beforeinstallprompt capture at launch so the
// Android install nudge works (the event fires once, early). See src/lib/pwa.ts.
import './lib/pwa'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
