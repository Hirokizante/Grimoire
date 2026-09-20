/**
 * MortalWoundPicker — apply a **specific** Mortal Wound from the table, with no
 * D20.
 *
 * The SRD's normal path to a wound is the roll (Divergence SRD "Hit Points and
 * Mortal Wounds"), and both surfaces keep it: a player rolls from the sheet's
 * Mortal Wound card, a GM panel rolls inside the damage pipeline. But a wound
 * can also be **named outright** — an ability in play, an NPC's authored
 * effect, a GM ruling — and then nobody should have to roll a die and pretend
 * it produced the wound the table already agreed on. This dialog is that path:
 * the same twenty entries, listed with their D20 and their rules text, applied
 * by picking one.
 *
 * It is **one component for every surface** — the player sheet's Mortal Wound
 * block (`MortalWoundRoller`) and both GM panel kinds (through their ⋯ menu) —
 * because the table, the marking of what is already on the track and the
 * "no room left" rule are the same on all three; only the write differs, and
 * the caller passes that in `onPick`. A picked wound is written by
 * `characterStore.addMortalWound` for a character and by
 * `gmScreenStore.addInstanceMortalWound` for an NPC instance.
 *
 * The dialog deliberately **stays open after a pick** (the Add Status picker's
 * convention): a target can take two wounds in one hit, an NPC's allowance can
 * be higher, and the picker re-reads the track it is writing to — the newly
 * applied wound is marked "on track", and once the track fills, the list
 * disables with the reason on screen instead of silently refusing clicks.
 *
 * Rendered through a **portal to `document.body`**, for the reason
 * `AddStatusModal` documents: a GM panel can be dimmed (`opacity` passes down
 * to descendants AND makes the panel the containing block for `position:
 * fixed`), so an in-place dialog would paint translucent over a backdrop sized
 * to the panel. Portalled, it is a viewport overlay on the documented modal
 * layer (z-index 2000, below the 3000 title bar) and no panel state can reach
 * it.
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from '@/components/ui/icons'

import { MORTAL_WOUNDS } from '@/constants/gameData'
import { useModalDialog } from '@/hooks/useModalDialog'
import type { MortalWound } from '@/types'

export interface MortalWoundPickerProps {
  /** Whose track this is — the dialog title and the empty-state wording. */
  entityName: string
  /**
   * Wound names already on the target's track, marked "on track" in the list.
   * Duplicates are allowed (two wounds can share a name), so the mark is
   * informational only — it never disables a row.
   */
  activeNames: string[]
  /**
   * Whether the target's track can take another wound at all. False disables
   * every row and says why: the caller re-renders this dialog as it writes, so
   * the state is live — a full track locks the list without a second dialog.
   */
  canAdd: boolean
  /** Apply the chosen table entry. The caller owns the write and its toast. */
  onPick: (wound: MortalWound) => void
  onClose: () => void
}

export default function MortalWoundPicker({
  entityName,
  activeNames,
  canAdd,
  onPick,
  onClose,
}: MortalWoundPickerProps) {
  const dialogRef = useModalDialog(onClose)
  const [query, setQuery] = useState('')

  const onTrack = useMemo(() => new Set(activeNames), [activeNames])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Table order (by D20), never alphabetical: the numbers are the roll, and
    // the list has to read like the table it is a stand-in for.
    if (!q) return MORTAL_WOUNDS
    return MORTAL_WOUNDS.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        String(w.id) === q,
    )
  }, [query])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content mw-picker"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Add Mortal Wound to ${entityName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Add Mortal Wound — {entityName}</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mw-picker__body">
          <label className="mw-picker__search">
            <Search size={14} aria-hidden="true" />
            <input
              className="sheet-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the Mortal Wounds table…"
              aria-label="Search Mortal Wounds"
              autoFocus
            />
          </label>

          {!canAdd && (
            <p className="mw-picker__hint">
              No Mortal Wound slots left on {entityName} — clear one from the
              track first.
            </p>
          )}

          {visible.length === 0 ? (
            <p className="muted mw-picker__empty">No wounds match that search.</p>
          ) : (
            <ul className="mw-picker__list" role="list">
              {visible.map((wound) => (
                <li key={wound.id}>
                  <button
                    type="button"
                    className="mw-picker__row"
                    disabled={!canAdd}
                    onClick={() => onPick(wound)}
                    aria-label={`Add ${wound.name}`}
                    title={wound.description}
                  >
                    <span className="mw-picker__roll" aria-hidden="true">
                      {wound.id}
                    </span>
                    <span className="mw-picker__text">
                      <span className="mw-picker__name">
                        {wound.name}
                        {onTrack.has(wound.name) && (
                          <span className="mw-picker__badge">on track</span>
                        )}
                      </span>
                      <span className="mw-picker__desc">{wound.description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
