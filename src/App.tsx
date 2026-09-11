/**
 * App.tsx — root component.
 */

import './App.css'
import '@/components/dice/dice.css'

import CharacterListPage from '@/pages/CharacterListPage'
import CharacterSheetPage from '@/pages/CharacterSheetPage'
import NPCListPage from '@/pages/NPCListPage'
import NPCSheetPage from '@/pages/NPCSheetPage'
import GMScreenPage from '@/pages/GMScreenPage'
import HomePage from '@/pages/HomePage'
import SettingsPage from '@/pages/SettingsPage'
import StatusCompendiumPage from '@/pages/StatusCompendiumPage'
import StatusModal from '@/components/status/StatusModal'
import DiceRollOverlay from '@/components/dice/DiceRollOverlay'
import RollLogDrawer from '@/components/dice/RollLogDrawer'
import TitleBar from '@/components/TitleBar'
import {
  installCharacterAutosaveFlush,
  useCharacterStore,
} from '@/store/characterStore'
import {
  installGMScreenAutosaveFlush,
  useGMScreenStore,
} from '@/store/gmScreenStore'
import { useEffect } from 'react'
import { useRollLogStore } from '@/store/rollLogStore'
import { useNotification, NotificationProvider } from '@/context/NotificationContext'
import { wasSchemaRepaired } from '@/lib/db'

/**
 * StorageRepairNotice — tells the user once when the local database had to be
 * repaired on open (a half-applied schema upgrade is fixed silently on disk,
 * but silently fixing things the user never hears about is not acceptable).
 *
 * Must live INSIDE NotificationProvider to reach the toast context.
 */
function StorageRepairNotice() {
  const { notify } = useNotification()
  useEffect(() => {
    if (!wasSchemaRepaired()) return
    notify(
      'Grimoire repaired its local database storage. Your sheets, NPCs, and screens are unchanged.',
      'info',
      8000,
    )
  }, [notify])
  return null
}

function App() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const view = useCharacterStore((s) => s.view)
  const loadRollLog = useRollLogStore((s) => s.loadRollLog)
  const loadScreens = useGMScreenStore((s) => s.loadScreens)

  useEffect(() => {
    void loadRollLog()
  }, [loadRollLog])

  useEffect(() => {
    void loadScreens()
  }, [loadScreens])

  // Autosave is debounced; make sure an unload (reload / tab close) inside the
  // debounce window can never drop the last edits.
  useEffect(() => {
    installCharacterAutosaveFlush()
    installGMScreenAutosaveFlush()
  }, [])

  const onSheet = currentCharacter !== null
  const onHome = !onSheet && view === 'home'
  const onNpcSheet = onSheet && currentCharacter?.kind === 'npc'
  /** Gallery list pages (characters / NPCs / statuses / GM screen) — full width. */
  const onGallery =
    !onSheet &&
    (view === 'characters' ||
      view === 'npcs' ||
      view === 'gmscreen' ||
      view === 'statuses')
  /** The GM Screen carries its own roll-log drawer (no single sheet context). */
  const onGmScreen = !onSheet && view === 'gmscreen'

  return (
    <NotificationProvider>
      <StorageRepairNotice />
      <div className="app">
        {!onHome && <TitleBar />}

        <main
          className={
            'app-main' +
            (!onSheet && !onGallery ? ' app-main--narrow' : '') +
            (onHome ? ' app-main--home' : '')
          }
        >
          {onSheet ? (
            onNpcSheet ? (
              <NPCSheetPage />
            ) : (
              <CharacterSheetPage />
            )
          ) : view === 'home' ? (
            <HomePage />
          ) : view === 'characters' ? (
            <CharacterListPage />
          ) : view === 'npcs' ? (
            <NPCListPage />
          ) : view === 'gmscreen' ? (
            <GMScreenPage />
          ) : view === 'statuses' ? (
            <StatusCompendiumPage />
          ) : view === 'settings' ? (
            <SettingsPage />
          ) : (
            <HomePage />
          )}
        </main>

        <DiceRollOverlay />
        <StatusModal />
        {onSheet && !onNpcSheet && <RollLogDrawer />}
        {onGmScreen && <RollLogDrawer />}
      </div>
    </NotificationProvider>
  )
}

export default App
