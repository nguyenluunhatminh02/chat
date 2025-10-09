import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TooltipProvider } from '@radix-ui/react-tooltip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
     <TooltipProvider delayDuration={150} skipDelayDuration={200}>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
