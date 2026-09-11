/**
 * HomePage — the landing screen for Grimoire.
 *
 * Displays the app title "GRIMOIRE" in Camiro font, with three navigation
 * buttons: Characters, NPCs, and Settings. The ambient background effect
 * (arcane glow, terminal boot, or none) is chosen in Settings and read from
 * homeAnimationStore.
 */

import { Users, Swords, Sparkles, Settings, LayoutDashboard } from 'lucide-react'

import ArcaneGlowAnimation from '@/components/home/ArcaneGlowAnimation'
import TerminalBootAnimation from '@/components/home/TerminalBootAnimation'
import { useCharacterStore } from '@/store/characterStore'
import { useHomeAnimationStore } from '@/store/homeAnimationStore'

export default function HomePage() {
  const setView = useCharacterStore((s) => s.setView)
  const animation = useHomeAnimationStore((s) => s.animation)
  const animationsEnabled = useHomeAnimationStore((s) => s.enabled)

  return (
    <div
      className={
        'home-page' +
        (animationsEnabled && animation === 'arcane'
          ? ' home-page--arcane'
          : '')
      }
    >
      {animationsEnabled && animation === 'terminal' && (
        <TerminalBootAnimation />
      )}
      {animationsEnabled && animation === 'arcane' && <ArcaneGlowAnimation />}

      <div className="home-page__content">
        <div>
          <h1 className="home-page__title">GRIMOIRE</h1>
          <span className="home-page__title-line" />
        </div>
        <p className="home-page__subtitle">
          A companion for the Divergence TTRPG.
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
              <Swords size={48} className="home-nav__icon" />
              <span className="home-nav__label">NPCs</span>
            </span>
          </button>

          <button
            type="button"
            className="home-nav__btn"
            onClick={() => setView('gmscreen')}
          >
            <span className="home-nav__btn-inner">
              <LayoutDashboard size={48} className="home-nav__icon" />
              <span className="home-nav__label">GM Screen</span>
            </span>
          </button>

          <button
            type="button"
            className="home-nav__btn"
            onClick={() => setView('statuses')}
          >
            <span className="home-nav__btn-inner">
              <Sparkles size={48} className="home-nav__icon" />
              <span className="home-nav__label">Statuses</span>
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
