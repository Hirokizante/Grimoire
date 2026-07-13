/**
 * TitleBar — persistent top navigation for Grimoire.
 *
 * Provides quick access to Home, Character List, NPC List, and Settings.
 * The active view is highlighted; the Home button also closes an open
 * character sheet when on the sheet view.
 */

import { Home, Users, Ghost, Settings } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import type { AppView } from '@/store/characterStore'

interface NavButton {
  view: AppView
  label: string
  icon: React.ReactNode
}

export default function TitleBar() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const view = useCharacterStore((s) => s.view)
  const closeCharacter = useCharacterStore((s) => s.closeCharacter)
  const setView = useCharacterStore((s) => s.setView)

  const onSheet = currentCharacter !== null

  const navButtons: NavButton[] = [
    {
      view: 'home',
      label: 'Home',
      icon: <Home size={18} />,
    },
    {
      view: 'characters',
      label: 'Characters',
      icon: <Users size={18} />,
    },
    {
      view: 'npcs',
      label: 'NPCs',
      icon: <Ghost size={18} />,
    },
    {
      view: 'settings',
      label: 'Settings',
      icon: <Settings size={18} />,
    },
  ]

  function handleNav(target: AppView) {
    if (onSheet) {
      closeCharacter()
    }
    setView(target)
  }

  return (
    <header className="app-header">
      <span className="app-title">Grimoire</span>
      <span className="app-header__divider" />
      <nav className="app-header__nav" aria-label="Main navigation">
        {navButtons.map((btn) => {
          const isActive = !onSheet && view === btn.view
          return (
            <button
              key={btn.label}
              type="button"
              className={`app-header__nav-btn${isActive ? ' app-header__nav-btn--active' : ''}`}
              onClick={() => handleNav(btn.view)}
              aria-current={isActive ? 'page' : undefined}
              title={btn.label}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          )
        })}
      </nav>
    </header>
  )
}
