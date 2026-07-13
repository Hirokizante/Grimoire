/**
 * App.tsx — root component.
 */

import './App.css'
import '@/components/dice/dice.css'

import CharacterListPage from '@/pages/CharacterListPage'
import CharacterSheetPage from '@/pages/CharacterSheetPage'
import HomePage from '@/pages/HomePage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import DiceRollOverlay from '@/components/dice/DiceRollOverlay'
import RollLogDrawer from '@/components/dice/RollLogDrawer'
import { useCharacterStore } from '@/store/characterStore'
import { useEffect } from 'react'
import { Home } from 'lucide-react'
import { useRollLogStore } from '@/store/rollLogStore'
import { NotificationProvider } from '@/context/NotificationContext'

function App() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const closeCharacter = useCharacterStore((s) => s.closeCharacter)
  const view = useCharacterStore((s) => s.view)
  const setView = useCharacterStore((s) => s.setView)
  const loadRollLog = useRollLogStore((s) => s.loadRollLog)

  useEffect(() => {
    void loadRollLog()
  }, [loadRollLog])

  const onSheet = currentCharacter !== null

  return (
    <NotificationProvider>
      <div className="app">
        <header className="app-header">
          <button
            type="button"
            className="app-menu-btn"
            onClick={() => {
              if (onSheet) {
                closeCharacter()
              } else {
                setView('home')
              }
            }}
            title="Main Menu"
            aria-label="Main Menu"
          >
            <Home size={18} />
          </button>
          <span className="app-header__divider" />
          <span className="app-title">Grimoire</span>
        </header>

        <main className={'app-main' + (onSheet ? '' : ' app-main--narrow')}>
          {onSheet ? (
            <CharacterSheetPage />
          ) : view === 'home' ? (
            <HomePage />
          ) : view === 'characters' ? (
            <CharacterListPage />
          ) : view === 'npcs' ? (
            <PlaceholderPage title="NPCs" />
          ) : view === 'settings' ? (
            <PlaceholderPage title="Settings" />
          ) : (
            <HomePage />
          )}
        </main>

        <DiceRollOverlay />
        {onSheet && <RollLogDrawer />}
      </div>
    </NotificationProvider>
  )
}

export default App
