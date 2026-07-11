import './App.css'

import CharacterListPage from '@/pages/CharacterListPage'
import CharacterSheetPage from '@/pages/CharacterSheetPage'
import { useCharacterStore } from '@/store/characterStore'

function App() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const closeCharacter = useCharacterStore((s) => s.closeCharacter)

  const onSheet = currentCharacter !== null

  return (
    <div className="app">
      <header className="app-header">
        {onSheet ? (
          <button
            className="btn btn--ghost app-back"
            type="button"
            onClick={closeCharacter}
          >
            ‹ Back
          </button>
        ) : (
          <span className="app-back-spacer" />
        )}
        <span className="app-title">Grimoire</span>
        <span className="app-back-spacer" />
      </header>

      <main className="app-main">
        {onSheet ? <CharacterSheetPage /> : <CharacterListPage />}
      </main>
    </div>
  )
}

export default App