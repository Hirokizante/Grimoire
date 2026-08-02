/**
 * CharacterSelector — a slide-out panel on the left side of the screen that
 * lists all characters (or NPCs) with their portrait and name.
 *
 * Open behavior:
 *   - Closed by default.
 *   - Clicking the toggle tab (chevron on the left edge) opens or closes
 *     the panel. The state is controlled by the parent page.
 *
 * When open, the parent page shifts its content rightward (via a
 * `sheet-page--selector-open` class on the page wrapper) so the sheet
 * remains fully visible and interactive. The shift is animated in sync
 * with the panel's slide-in via CSS transitions.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'

export interface CharacterSelectorProps {
  /** Filter the store list to this kind. */
  kind: 'character' | 'npc'
  /** Whether the panel is open. */
  open: boolean
  /** Toggle the open state. */
  onToggle: () => void
}

export default function CharacterSelector({
  kind,
  open,
  onToggle,
}: CharacterSelectorProps) {
  const characters = useCharacterStore((s) => s.characters)
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const selectCharacter = useCharacterStore((s) => s.selectCharacter)

  const list: Character[] =
    kind === 'npc'
      ? characters.filter((c) => c.kind === 'npc')
      : characters.filter((c) => c.kind !== 'npc')

  return (
    <>
      {/* The panel itself */}
      <aside
        className={
          'char-selector' + (open ? ' char-selector--open' : '')
        }
        aria-label={kind === 'npc' ? 'NPC selector' : 'Character selector'}
      >
        <div className="char-selector__header">
          <span className="char-selector__title">
            {kind === 'npc' ? 'NPCs' : 'Characters'}
          </span>
        </div>

        <ul className="char-selector__list" role="list">
          {list.map((c) => {
            const isActive = currentCharacter?.id === c.id
            return (
              <li key={c.id} className="char-selector__item">
                <button
                  type="button"
                  className={
                    'char-selector__btn' +
                    (isActive ? ' char-selector__btn--active' : '')
                  }
                  onClick={() => selectCharacter(c.id)}
                  title={c.name}
                >
                  {c.portrait ? (
                    <img
                      className="char-selector__portrait"
                      src={c.portrait}
                      alt={c.name}
                    />
                  ) : (
                    <div
                      className="char-selector__portrait char-selector__portrait--empty"
                      aria-hidden
                    />
                  )}
                  <span className="char-selector__name">{c.name}</span>
                </button>
              </li>
            )
          })}
          {list.length === 0 && (
            <li className="char-selector__empty muted">
              No {kind === 'npc' ? 'NPCs' : 'characters'} yet.
            </li>
          )}
        </ul>
      </aside>

      {/* Toggle tab — pinned to the panel's right edge, always visible */}
      <button
        type="button"
        className={
          'char-selector__toggle' +
          (open ? ' char-selector__toggle--open' : '')
        }
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Collapse selector' : 'Expand selector'}
        title={open ? 'Click to collapse' : 'Click to expand'}
      >
        {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>
    </>
  )
}