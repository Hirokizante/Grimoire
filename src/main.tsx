import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// The status icon pack's font + `.ra-*` glyph classes (SIL OFL 1.1 / MIT).
import 'rpg-awesome/css/rpg-awesome.min.css'
import App from './App.tsx'
// The "Terminal" UI style override sheet — imported after App's whole
// component-stylesheet subtree so its scoped rules win the cascade ties.
import './terminal-ui.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
