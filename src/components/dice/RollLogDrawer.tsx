/**
 * RollLogDrawer — a small drawer in the bottom-right of the screen.
 */

import { useRef, useEffect, useState } from 'react'
import { Dices, Trash2 } from 'lucide-react'
import { useRollLogStore } from '@/store/rollLogStore'
import { useCharacterStore } from '@/store/characterStore'
import type { RollLogEntry, SheetColors } from '@/types'

/**
 * Map a SheetColors object onto the CSS custom properties used by the
 * roll-log drawer. Mirrors the mapping in CharacterSheet so the drawer
 * inherits the active character's theme.
 */
function colorVars(colors: SheetColors): Record<string, string> {
  return {
    '--bg-base': colors.bgBase,
    '--bg-surface': colors.bgSurface,
    '--bg-surface-raised': colors.bgSurfaceRaised,
    '--bg-surface-hover': colors.bgSurfaceHover,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-muted': colors.textMuted,
    '--border': colors.border,
    '--border-soft': colors.borderSoft,
    '--accent-violet': colors.accent,
    '--accent-violet-soft': colors.accentSoft,
    '--accent-blush': colors.hpBar,
    '--danger': colors.danger,
    '--color-minor-ability': colors.minorAbility,
    '--color-success': colors.success,
    '--hp-bar-color': colors.hpBar,
    '--fp-bar-color': colors.fpBar,
    '--ap-bar-color': colors.apBar,
    '--end-bar-color': colors.endBar,
  }
}

/** Friendly label for a roll source. */
function srcLabel(entry: RollLogEntry): string {
  switch (entry.source.type) {
    case 'ability-damage':
      return entry.source.abilityName
    case 'skill-check':
      return `Check: ${entry.source.skillName}`
    case 'attribute-check':
      return `Check: ${entry.source.attributeName}`
    case 'manual':
      return entry.source.note ?? 'Manual'
    case 'attack':
      return entry.source.abilityName ?? 'Attack'
    case 'saving-throw':
      return 'Save'
  }
}

export default function RollLogDrawer() {
  const entries = useRollLogStore((s) => s.entries)
  const drawerOpen = useRollLogStore((s) => s.drawerOpen)
  const toggleDrawer = useRollLogStore((s) => s.toggleDrawer)
  const closeDrawer = useRollLogStore((s) => s.closeDrawer)
  const deleteEntry = useRollLogStore((s) => s.deleteEntry)
  const clearAll = useRollLogStore((s) => s.clearAll)
  const character = useCharacterStore((s) => s.currentCharacter)

  const drawerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)

  const themeStyle = character ? colorVars(character.config.colors) : undefined

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (clearConfirm) setClearConfirm(false)
        else if (drawerOpen) closeDrawer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, closeDrawer, clearConfirm])

  return (
    <>
      <button
        type="button"
        className="roll-log-tab"
        style={themeStyle}
        onClick={toggleDrawer}
        aria-expanded={drawerOpen}
        title="Roll history"
      >
        <Dices className="roll-log-tab__icon" size={18} />
        <span className="roll-log-tab__count">{entries.length}</span>
      </button>

      {drawerOpen && (
        <div
          className="roll-log-drawer"
          ref={drawerRef}
          role="region"
          aria-label="Dice roll history"
          style={themeStyle}
        >
          <header className="roll-log-drawer__header">
            <h3 className="roll-log-drawer__title">Rolls</h3>
            <div className="roll-log-drawer__controls">
              <button
                type="button"
                className="roll-log-drawer__clear roll-log-drawer__clear--header"
                onClick={() => setClearConfirm(true)}
                disabled={entries.length === 0}
                title="Clear all rolls"
                style={{ border: '0', background: 'transparent', outline: 'none', boxShadow: 'none' }}
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                className="roll-log-drawer__close"
                onClick={closeDrawer}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {clearConfirm && (
              <div
                className="roll-log-drawer__confirm-popover"
                role="dialog"
                aria-live="polite"
              >
                <span className="roll-log-drawer__confirm-text">
                  Clear all rolls?
                </span>
                <div className="roll-log-drawer__confirm-actions">
                  <button
                    type="button"
                    className="roll-log-drawer__confirm-btn roll-log-drawer__confirm-btn--danger"
                    onClick={() => {
                      void clearAll()
                      setClearConfirm(false)
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="roll-log-drawer__confirm-btn"
                    onClick={() => setClearConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </header>

          <div className="roll-log-drawer__body">
            {entries.length === 0 ? (
              <p className="roll-log-drawer__empty">
                No dice rolled yet.
              </p>
            ) : (
              <ul className="roll-log-list" role="list">
                {entries.slice(0, 30).map((entry) => (
                  <RollLogItem
                    key={entry.id}
                    entry={entry}
                    expanded={expanded === entry.id}
                    onToggle={() =>
                      setExpanded((prev) =>
                        prev === entry.id ? null : entry.id,
                      )
                    }
                    onDelete={() => {
                      void deleteEntry(entry.id)
                      setExpanded(null)
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function RollLogItem({
  entry,
  expanded,
  onToggle,
  onDelete,
}: {
  entry: RollLogEntry
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const time = new Date(entry.rolledAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li
      className={`roll-log-item${
        entry.isNaturalTwenty ? ' roll-log-item--crit' : ''
      }${entry.isNaturalOne ? ' roll-log-item--fumble' : ''}`}
    >
      <button
        type="button"
        className="roll-log-item__head"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="roll-log-item__info">
          <span className="roll-log-item__notation">{entry.notation}</span>
          <span className="roll-log-item__src">{srcLabel(entry)}</span>
          <span className="roll-log-item__character" title={entry.characterName}>
            {entry.characterName}
          </span>
        </div>
        <div className="roll-log-item__right">
          <span className="roll-log-item__total">{entry.result.total}</span>
          <span className="roll-log-item__time">{time}</span>
        </div>
      </button>

      {expanded && (
        <div className="roll-log-item__detail">
          <p className="roll-log-item__breakdown">
            {entry.result.breakdown}
          </p>
          <button
            type="button"
            className="roll-log-item__delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  )
}
