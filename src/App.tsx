/**
 * App.tsx — root component.
 */

import './App.css'
import '@/components/dice/dice.css'

import CharacterListPage from '@/pages/CharacterListPage'
import CharacterSheetPage from '@/pages/CharacterSheetPage'
import DiceRollOverlay from '@/components/dice/DiceRollOverlay'
import RollLogDrawer from '@/components/dice/RollLogDrawer'
import { useCharacterStore } from '@/store/characterStore'
import { useEffect } from 'react'
import { useRollLogStore } from '@/store/rollLogStore'
import { NotificationProvider } from '@/context/NotificationContext'

function App() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const loadRollLog = useRollLogStore((s) => s.loadRollLog)

  useEffect(() => {
    void loadRollLog()
  }, [loadRollLog])

  const onSheet = currentCharacter !== null

  return (
    <NotificationProvider>
      <div className="app">
        <header className="app-header">
          <span className="app-back-spacer" />
          <span className="app-title">Grimoire</span>
          <span className="app-back-spacer" />
        </header>

        <main className="app-main">
          {onSheet ? <CharacterSheetPage /> : <CharacterListPage />}
        </main>

        <DiceRollOverlay />
        {onSheet && <RollLogDrawer />}
      </div>
    </NotificationProvider>
  )
}

export default App
