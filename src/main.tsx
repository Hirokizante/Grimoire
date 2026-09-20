import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// The status icon pack's font + `.ra-*` glyph classes (SIL OFL 1.1 / MIT).
import 'rpg-awesome/css/rpg-awesome.min.css'
// Iosevka — the Terminal UI style's monospace voice (SIL OFL 1.1). The
// weights the chrome actually uses, plus italic for sheet helper text.
import '@fontsource/iosevka/400.css'
import '@fontsource/iosevka/400-italic.css'
import '@fontsource/iosevka/500.css'
import '@fontsource/iosevka/600.css'
import '@fontsource/iosevka/700.css'
import App from './App.tsx'
// The "Terminal" UI style override sheet — imported after App's whole
// component-stylesheet subtree so its scoped rules win the cascade ties.
import './terminal-ui.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
