import './mobileViewportLock';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App.tsx'
import { logRuntimeDiagnostics } from './client/runtimeDiagnostics'
import { registerServiceWorker } from './pwa/registerSW'
import { installOverflowDetector } from './pwa/devOverflowDetector'

logRuntimeDiagnostics()
registerServiceWorker()
installOverflowDetector()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


