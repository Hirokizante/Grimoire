/**
 * RoundTracker — the encounter's round counter and the **New Round** action.
 *
 * The GM Screen deliberately runs no timers, so the round is a label the GM
 * tracks: the number is directly editable (type it over), and **New Round** is
 * the encounter action that advances it and starts every panel's next turn —
 * an NPC instance rolls its Recharge Die, a player character runs the sheet's
 * End Turn (see `gmScreenStore.startNewRound`, which owns both).
 *
 * The field keeps a local draft while it has focus so a mid-edit value is never
 * clamped per keystroke — committing the store value on every change would
 * snap an emptied field back to the current round before the new one arrived.
 * It sits in the screen toolbar, on the same row as Add Character / Add NPC,
 * which is the caller's layout (see `.gm-round` in gmscreen.css).
 */

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

import { MIN_SCREEN_ROUND } from '@/constants/gameData'

export interface RoundTrackerProps {
  /** The screen's current round (1-based). */
  round: number
  /** Commit a manually changed round. Values below the floor are clamped. */
  onRoundChange: (round: number) => void
  /** Advance to the next round and start every panel's turn. */
  onNewRound: () => void
}

export default function RoundTracker({
  round,
  onRoundChange,
  onNewRound,
}: RoundTrackerProps) {
  /** Null when the field is showing the committed value. */
  const [draft, setDraft] = useState<string | null>(null)

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft, 10)
    setDraft(null)
    if (Number.isFinite(parsed)) onRoundChange(parsed)
  }

  return (
    <div className="gm-round" role="group" aria-label="Round tracker">
      <label className="gm-round__field">
        <span className="gm-round__label">Round</span>
        <input
          type="number"
          className="sheet-input gm-round__input"
          value={draft ?? String(round)}
          min={MIN_SCREEN_ROUND}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Blur commits, so the value is written exactly once.
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          title="Type to set the round"
        />
      </label>
      <button
        type="button"
        className="btn btn--primary gm-round__new"
        onClick={onNewRound}
        title="Start the next round: every panel gets a new turn"
      >
        <RotateCcw size={14} aria-hidden="true" />
        New Round
      </button>
    </div>
  )
}
