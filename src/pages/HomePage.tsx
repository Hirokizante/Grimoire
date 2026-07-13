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
      <div className="home-page__particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="home-page__particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${8 + Math.random() * 10}s`,
              animationDelay: `${Math.random() * 8}s`,
              width: `${3 + Math.random() * 3}px`,
              height: `${3 + Math.random() * 3}px`,
            }}
          />
        ))}
      </div>

      <div className="home-page__content">
        <div>
          <h1 className="home-page__title">GRIMOIRE</h1>
          <span className="home-page__title-line" />
        </div>
        <p className="home-page__subtitle">
          A character sheet for the world of Divergence
        </p>

        <nav className="home-nav">
          <button
            type="button"
            className="home-nav__btn home-nav__btn--primary"
            onClick={() => setView('characters')}
          >
            <span className="home-nav__btn-inner">
              <Users size={48} className="home-nav__icon" />
              <span className="home-nav__label">Characters</span>
            </span>
          </button>

          <button
            type="button"
            className="home-nav__btn"
            onClick={() => setView('npcs')}
          >
            <span className="home-nav__btn-inner">
              <Ghost size={48} className="home-nav__icon" />
              <span className="home-nav__label">NPCs</span>
            </span>
          </button>

          <button
            type="button"
            className="home-nav__btn"
            onClick={() => setView('settings')}
          >
            <span className="home-nav__btn-inner">
              <Settings size={48} className="home-nav__icon" />
              <span className="home-nav__label">Settings</span>
            </span>
          </button>
        </nav>
      </div>
    </div>
  )
}
