/**
 * PanelHeader — shared header row for every GM Screen panel.
 *
 * Shows the 48px circular portrait, name (+ optional subtitle), the
 * compact/expanded density toggle, and the ⋯ panel menu. The drag handle
 * itself lives in {@link SortablePanel} so it sits outside the panel chrome
 * and stays reachable in every density.
 */

import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, MoreVertical } from 'lucide-react'

import type { ScreenPanelDensity } from '@/types'

/** One entry in a panel's ⋯ menu. */
export interface PanelMenuItem {
  label: string
  onSelect: () => void
  /** Renders the item in the danger color (removal). */
  danger?: boolean
}

export interface PanelHeaderProps {
  portrait: string | null
  name: string
  subtitle?: string | null
  density: ScreenPanelDensity
  onDensityChange: (density: ScreenPanelDensity) => void
  menuItems: PanelMenuItem[]
  /** Extra badge slot (e.g. an NPC condition badge). */
  badge?: React.ReactNode
  /** Marks a downed/dead instance: dims the label and strikes it through. */
  dimmed?: boolean
}

export default function PanelHeader({
  portrait,
  name,
  subtitle,
  density,
  onDensityChange,
  menuItems,
  badge,
  dimmed = false,
}: PanelHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the menu on outside click. The menu is deliberately click-to-toggle
  // only (never hover), matching the drawer conventions in .hermes.md.
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const expanded = density === 'expanded'

  return (
    <header className="gm-panel__header">
      {portrait ? (
        <img className="gm-panel__portrait" src={portrait} alt="" />
      ) : (
        <div className="gm-panel__portrait gm-panel__portrait--empty" aria-hidden="true" />
      )}

      <div className="gm-panel__identity">
        <span
          className={'gm-panel__name' + (dimmed ? ' gm-panel__name--dimmed' : '')}
          title={name}
        >
          {name}
        </span>
        {subtitle && <span className="gm-panel__subtitle">{subtitle}</span>}
      </div>

      {badge}

      <div className="gm-panel__controls">
        <button
          type="button"
          className="btn btn--icon gm-panel__density"
          onClick={() => onDensityChange(expanded ? 'compact' : 'expanded')}
          aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
          title={expanded ? 'Collapse panel' : 'Expand panel'}
        >
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        <div className="gm-panel__menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="btn btn--icon gm-panel__menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`${name} options`}
            title="Panel options"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="gm-panel__menu" role="menu">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={
                    'gm-panel__menu-item' + (item.danger ? ' gm-panel__menu-item--danger' : '')
                  }
                  onClick={() => {
                    setMenuOpen(false)
                    item.onSelect()
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
