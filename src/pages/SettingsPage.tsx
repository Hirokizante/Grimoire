/**
 * SettingsPage — app-level preferences.
 *
 * Currently hosts the app color theme picker. This themes the app chrome
 * around the sheets (header, list pages, modals, dice UI, …) — it does NOT
 * touch per-sheet color themes, which live in each sheet's Customization
 * panel and are stored on the character.
 */

import { Check } from 'lucide-react'

import { useAppThemeStore } from '@/store/appThemeStore'
import type { AppTheme } from '@/store/appThemeStore'

interface ThemeOption {
  id: AppTheme
  name: string
  description: string
  /** Representative palette swatches, in paint order. */
  swatches: string[]
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'The default violet-dark palette.',
    swatches: ['#1a1a2e', '#9b7ed6', '#e8a0bf'],
  },
  {
    id: 'parchment',
    name: 'Parchment',
    description: 'For those who deal in the occult.',
    swatches: ['#262626', '#c5b8a0', '#c98f74'],
  },
  {
    id: 'mikami',
    name: 'Mikami',
    description: 'Professional detachment.',
    swatches: ['#141414', '#81a1c1', '#88c0d0'],
  },
  {
    id: 'pitch-black',
    name: 'Pitch Black',
    description: 'A glimpse into the shadow realm.',
    swatches: ['#000000', '#f3ecd4', '#eecc6c'],
  },
]

export default function SettingsPage() {
  const theme = useAppThemeStore((s) => s.theme)
  const setTheme = useAppThemeStore((s) => s.setTheme)

  return (
    <div className="page">
      <section
        className="settings-section"
        aria-labelledby="settings-appearance-heading"
      >
        <h2 className="settings-section__title" id="settings-appearance-heading">
          Appearance
        </h2>
        <p className="muted settings-section__hint">
          Colors for the app around your sheets. Character sheet themes are
          set per sheet in the Customization panel.
        </p>

        <div className="theme-picker" role="radiogroup" aria-label="App theme">
          {THEME_OPTIONS.map((option) => {
            const isActive = theme === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={
                  'theme-option' + (isActive ? ' theme-option--active' : '')
                }
                onClick={() => setTheme(option.id)}
              >
                <span className="theme-option__swatches" aria-hidden="true">
                  {option.swatches.map((color) => (
                    <span
                      key={color}
                      className="theme-option__swatch"
                      style={{ background: color }}
                    />
                  ))}
                </span>
                <span className="theme-option__label">
                  <span className="theme-option__name">{option.name}</span>
                  {isActive && (
                    <span className="theme-option__check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                  )}
                </span>
                <span className="theme-option__desc">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
