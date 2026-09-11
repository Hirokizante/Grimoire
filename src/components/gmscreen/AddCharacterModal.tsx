/**
 * AddCharacterModal — pick a player character to put on the GM screen.
 *
 * Follows the modal conventions: header ✕ (dismiss) plus a footer action
 * (Add), centralized behavior via `useModalDialog`. Characters that already
 * have a panel on this screen are listed but disabled with an "Already on this
 * screen" note — duplicate player sheets are a footgun; NPC instances are the
 * supported way to have several of the same statblock.
 */

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { useModalDialog } from '@/hooks/useModalDialog'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useNotification } from '@/context/NotificationContext'

export interface AddCharacterModalProps {
  screenId: string
  onClose: () => void
}

export default function AddCharacterModal({
  screenId,
  onClose,
}: AddCharacterModalProps) {
  const characters = useCharacterStore((s) => s.characters)
  const screens = useGMScreenStore((s) => s.screens)
  const addCharacterPanel = useGMScreenStore((s) => s.addCharacterPanel)
  const { notify } = useNotification()

  const [query, setQuery] = useState('')
  const dialogRef = useModalDialog(onClose)

  const screen = screens.find((s) => s.id === screenId) ?? null
  const alreadyOnScreen = useMemo(
    () =>
      new Set(
        (screen?.panels ?? [])
          .filter((p) => p.kind === 'character')
          .map((p) => (p.kind === 'character' ? p.characterId : '')),
      ),
    [screen],
  )

  const players = useMemo(() => {
    const list = characters.filter((c) => c.kind !== 'npc')
    const q = query.trim().toLowerCase()
    const filtered = q
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.playerName.toLowerCase().includes(q) ||
            c.labels.some((l) => l.name.toLowerCase().includes(q)),
        )
      : list
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [characters, query])

  const available = players.find((c) => !alreadyOnScreen.has(c.id)) ?? null

  const handleAdd = () => {
    if (!available) return
    const ok = addCharacterPanel(screenId, available.id)
    if (!ok) {
      notify(`${available.name} is already on this screen.`, 'info')
      return
    }
    notify(`Added ${available.name}.`, 'success')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content gm-picker"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Add character to GM screen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Add Character</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="gm-picker__body">
          <label className="gm-picker__search">
            <Search size={14} aria-hidden="true" />
            <input
              className="sheet-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search characters…"
              aria-label="Search characters"
              autoFocus
            />
          </label>

          {players.length === 0 ? (
            <p className="muted gm-picker__empty">
              No player characters yet — create one from the Characters page.
            </p>
          ) : (
            <ul className="gm-picker__list" role="list">
              {players.map((c) => {
                const disabled = alreadyOnScreen.has(c.id)
                return (
                  <li key={c.id} className="gm-picker__row">
                    <button
                      type="button"
                      className={
                        'gm-picker__item' + (disabled ? ' gm-picker__item--disabled' : '')
                      }
                      onClick={() => {
                        if (disabled) {
                          notify(`${c.name} is already on this screen.`, 'info')
                          return
                        }
                        addCharacterPanel(screenId, c.id)
                        notify(`Added ${c.name}.`, 'success')
                        onClose()
                      }}
                      aria-disabled={disabled}
                    >
                      {c.portrait ? (
                        <img className="gm-picker__portrait" src={c.portrait} alt="" />
                      ) : (
                        <span className="gm-picker__portrait gm-picker__portrait--empty" aria-hidden="true" />
                      )}
                      <span className="gm-picker__info">
                        <span className="gm-picker__name">{c.name}</span>
                        <span className="gm-picker__meta">
                          {disabled
                            ? 'Already on this screen'
                            : c.playerName || `${c.currentHP} HP`}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Done
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleAdd}
            disabled={!available}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
