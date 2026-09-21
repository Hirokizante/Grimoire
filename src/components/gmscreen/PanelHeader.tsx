/**
 * PanelHeader — shared header row for every GM Screen panel.
 *
 * Shows the portrait, name (+ optional subtitle), the compact/expanded density
 * toggle, and the ⋯ panel menu. The drag handle itself lives in
 * {@link SortablePanel} so it sits outside the panel chrome and stays
 * reachable in every density.
 *
 * The encounter view additionally passes `tokens` — its combat stat pills —
 * which sit in the header's lead block: the name and subtitle share the top
 * line, the tokens line up under them, both beside the portrait. The longer
 * layout reads "Name Player" on one line (no truncating the player name to
 * fit tokens beside it) and lets the tokens run the full width under the
 * names instead of wrapping onto two rows of their own.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minimize2, MoreVertical } from '@/components/ui/icons'

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
  /**
   * Inline stat pills (the encounter view's combat stat tokens), rendered
   * under the name/subtitle line, beside the portrait.
   */
  tokens?: React.ReactNode
  /** Marks a downed/dead instance: dims the label and strikes it through. */
  dimmed?: boolean
  /**
   * Hide the compact/expanded toggle. The encounter view always shows its
   * sheet body, so it has nothing for the toggle to do; grid panels keep it
   * (the default).
   */
  showDensityToggle?: boolean
}

/** Gap between the kebab and its menu, matching the old in-panel placement. */
const MENU_GAP = 4
/** Closest the menu may come to a viewport edge. */
const MENU_EDGE = 8

export default function PanelHeader({
  portrait,
  name,
  subtitle,
  density,
  onDensityChange,
  menuItems,
  badge,
  tokens,
  dimmed = false,
  showDensityToggle = true,
}: PanelHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPlacement, setMenuPlacement] = useState({ top: 0, left: 0 })
  const menuWrapRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the menu on outside click. The menu is deliberately click-to-toggle
  // only (never hover), matching the drawer conventions in .hermes.md. The menu
  // is portalled, so "inside" means either the wrap (the kebab) or the menu
  // itself — checking the wrap alone would close on every menu click.
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (menuWrapRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenuOpen(false)
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

  // The menu lives in `document.body`, not in the header. A panel dims itself
  // with ancestor `opacity` (0.55 at 0 AP, 0.75 dead, 0.4 mid-drag), and no
  // descendant can undo an inherited fade — so a menu left in the header went
  // translucent with the panel. Portalling keeps it at full strength in every
  // panel state (the same reason the pickers portal). Placement is measured
  // from the kebab's own rect; running in a layout effect means the first
  // painted frame is already positioned.
  useLayoutEffect(() => {
    if (!menuOpen) return
    const place = () => {
      const menu = menuRef.current
      const anchor = menuBtnRef.current
      if (!menu || !anchor) return
      const rect = anchor.getBoundingClientRect()
      const { offsetWidth: width, offsetHeight: height } = menu
      // Right edges line up (the old `right: 0`), clamped into the viewport.
      const left = Math.min(
        Math.max(MENU_EDGE, rect.right - width),
        Math.max(MENU_EDGE, window.innerWidth - MENU_EDGE - width),
      )
      const below = rect.bottom + MENU_GAP
      const above = rect.top - MENU_GAP - height
      // Below the kebab by default; above it when the panel sits too low in
      // the viewport. A menu taller than the viewport clamps to the top edge
      // and scrolls internally (see `.gm-panel__menu--portal`).
      const top =
        below + height > window.innerHeight - MENU_EDGE && above >= MENU_EDGE
          ? above
          : Math.min(
              below,
              Math.max(MENU_EDGE, window.innerHeight - MENU_EDGE - height),
            )
      setMenuPlacement({ top, left })
    }
    place()
    // The page scrolls under the menu; re-place it so it stays on its kebab.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [menuOpen])

  const expanded = density === 'expanded'

  return (
    <header className="gm-panel__header">
      <div className="gm-panel__lead">
        {portrait ? (
          <img className="gm-panel__portrait" src={portrait} alt="" />
        ) : (
          <div className="gm-panel__portrait gm-panel__portrait--empty" aria-hidden="true" />
        )}

        <div className="gm-panel__lead-text">
          <div className="gm-panel__identity">
            <span
              className={'gm-panel__name' + (dimmed ? ' gm-panel__name--dimmed' : '')}
              title={name}
            >
              {name}
            </span>
            {subtitle && <span className="gm-panel__subtitle">{subtitle}</span>}
          </div>

          {tokens}
        </div>
      </div>

      {badge}

      <div className="gm-panel__controls">
        {showDensityToggle && (
          <button
            type="button"
            className="btn btn--icon gm-panel__density"
            onClick={() => onDensityChange(expanded ? 'compact' : 'expanded')}
            aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
            title={expanded ? 'Collapse panel' : 'Expand panel'}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}

        <div className="gm-panel__menu-wrap" ref={menuWrapRef}>
          <button
            ref={menuBtnRef}
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
          {menuOpen &&
            createPortal(
              <div
                ref={menuRef}
                className="gm-panel__menu gm-panel__menu--portal"
                role="menu"
                style={{ top: menuPlacement.top, left: menuPlacement.left }}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className={
                      'gm-panel__menu-item' +
                      (item.danger ? ' gm-panel__menu-item--danger' : '')
                    }
                    onClick={() => {
                      setMenuOpen(false)
                      item.onSelect()
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </div>
      </div>
    </header>
  )
}
