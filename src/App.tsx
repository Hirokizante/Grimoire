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
import TitleBar from '@/components/TitleBar'
import { useCharacterStore } from '@/store/characterStore'
import { useEffect } from 'react'
import { useRollLogStore } from '@/store/rollLogStore'
import { NotificationProvider } from '@/context/NotificationContext'

function App() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const view = useCharacterStore((s) => s.view)
  const loadRollLog = useRollLogStore((s) => s.loadRollLog)

  useEffect(() => {
    void loadRollLog()
  }, [loadRollLog])

  const onSheet = currentCharacter !== null
  const onHome = !onSheet && view === 'home'

  return (
    <NotificationProvider>
      <div className="app">
        {!onHome && <TitleBar />}

        <main
          className={
            'app-main' +
            (onSheet ? '' : ' app-main--narrow') +
            (onHome ? ' app-main--home' : '')
          }
        >
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
