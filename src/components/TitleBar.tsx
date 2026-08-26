/**
 * TitleBar — persistent top navigation for Grimoire.
 *
 * Provides quick access to Home, Character List, NPC List, and Settings.
 * The active view is highlighted; the Home button also closes an open
 * character sheet when on the sheet view.
 */

import { useEffect, useRef } from 'react'
import { Users, Swords, Sparkles, Settings } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import type { AppView } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { colorVars } from '@/lib/themeUtils'
import faviconUrl from '/favicon.svg'
import faviconAltUrl from '/favicon_alt.svg'

interface NavButton {
  view: AppView
  label: string
  icon: React.ReactNode
}

export default function TitleBar() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const view = useCharacterStore((s) => s.view)
  const closeCharacter = useCharacterStore((s) => s.closeCharacter)
  const closeNPC = useCharacterStore((s) => s.closeNPC)
  const setView = useCharacterStore((s) => s.setView)
  const appTheme = useAppThemeStore((s) => s.theme)

  // Publish the bar's live height as --app-header-h on <html> so fixed
  // panels that dock beneath it (customize drawer, char-selector, modal
  // content boxes) sit flush under it with no gap and nothing covered.
  // The header's height depends on viewport breakpoints and the user's
  // font stack, so measuring beats any hardcoded rem value. Measured via
  // getBoundingClientRect() (float — offsetHeight rounds to whole pixels
  // and leaves a hairline seam at the bar's bottom edge). ResizeObserver +
  // window resize + font-load re-measures keep the value fresh across
  // breakpoint changes, resizes, and font swaps.
  const headerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => {
      document.documentElement.style.setProperty(
        '--app-header-h',
        `${el.getBoundingClientRect().height}px`,
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)
    // Re-measure once fonts settle (web-font swaps can change line boxes).
    document.fonts?.ready.then(update).catch(() => {})
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const onSheet = currentCharacter !== null
  const onNpcSheet = onSheet && currentCharacter?.kind === 'npc'

  // While a player character sheet is open, the title bar inherits the
  // sheet's own color scheme: injecting the sheet's palette as inline CSS
  // custom properties shadows the app-theme root vars for this subtree.
  // NPC sheets have no per-sheet customization and stay on the app theme.
  const headerStyle =
    onSheet && !onNpcSheet ? (colorVars(currentCharacter.config.colors) as React.CSSProperties) : undefined

  const navButtons: NavButton[] = [
    {
      view: 'characters',
      label: 'Characters',
      icon: <Users size={18} />,
    },
    {
      view: 'npcs',
      label: 'NPCs',
      icon: <Swords size={18} />,
    },
    {
      view: 'statuses',
      label: 'Statuses',
      icon: <Sparkles size={18} />,
    },
    {
      view: 'settings',
      label: 'Settings',
      icon: <Settings size={18} />,
    },
  ]

  function handleNav(target: AppView) {
    if (onSheet) {
      if (onNpcSheet) {
        closeNPC()
      } else {
        closeCharacter()
      }
    }
    setView(target)
  }

  return (
    <header ref={headerRef} className="app-header" style={headerStyle}>
      <button
        type="button"
        className={
          'app-title' +
          (!onSheet && view === 'home' ? ' app-title--active' : '')
        }
        onClick={() => handleNav('home')}
        aria-label="Go to home screen"
        aria-current={!onSheet && view === 'home' ? 'page' : undefined}
      >
        <img
          src={appTheme === 'parchment' ? faviconAltUrl : faviconUrl}
          alt=""
          aria-hidden="true"
          className="app-title__icon"
        />
        Grimoire
      </button>
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
              aria-label={btn.label}
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
