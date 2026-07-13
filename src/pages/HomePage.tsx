/**
 * HomePage — the landing screen for Grimoire.
 *
 * Displays the app title "GRIMOIRE" in Camiro font, with three navigation
 * buttons: Characters, NPCs, and Settings.
 */

import { Users, Ghost, Settings } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'

export default function HomePage() {
  const setView = useCharacterStore((s) => s.setView)

  return (
    <div className="home-page">
      <div className="home-page__content">
        <h1 className="home-page__title">GRIMOIRE</h1>
        <p className="home-page__subtitle">
          A character sheet for the world of Divergence
        </p>

        <nav className="home-nav">
          <button
            type="button"
            className="home-nav__btn home-nav__btn--primary"
            onClick={() => setView('characters')}
          >
            <Users size={36} className="home-nav__icon" />
            <span className="home-nav__label">Characters</span>
          </button>

          <button
            type="button"
            className="home-nav__btn"
            onClick={() => setView('npcs')}
          >
            <Ghost size={36} className="home-nav__icon" />
            <span className="home-nav__label">NPCs</span>
          </button>

          <button
            type="button"
            className="home-nav__btn"
            onClick={() => setView('settings')}
          >
            <Settings size={36} className="home-nav__icon" />
            <span className="home-nav__label">Settings</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
