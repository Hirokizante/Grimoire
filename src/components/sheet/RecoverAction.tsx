/**
 * RecoverAction — the Recover combat action (DESIGN.md "Recover").
 *
 * Costs 3 AP. Immediately regains all Endurance. Must be taken at the start of
 * the character's turn; no other actions can be taken thereafter. Also grants
 * the option to clear 1 status effect.
 *
 * In the UI this is a simple button that calls `store.recover()` and shows
 * feedback. The "clear 1 status" part is left to the player's discretion
 * (Mortal Wounds can be cleared via the MortalWoundRoller component).
 */

import { useState } from 'react'

import { useCharacterStore } from '@/store/characterStore'

export default function RecoverAction() {
  const recover = useCharacterStore((s) => s.recover)
  const currentAP = useCharacterStore((s) => s.currentCharacter?.currentAP ?? 0)
  const [message, setMessage] = useState('')

  const handleRecover = () => {
    const success = recover()
    if (success) {
      setMessage('Recovered! All END restored.')
    } else {
      setMessage('Not enough AP! Recover costs 3 AP.')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const canRecover = currentAP >= 3

  return (
    <div className="recover-action">
      <button
        type="button"
        className="btn btn--primary recover-action__btn"
        onClick={handleRecover}
        disabled={!canRecover}
        title="3 AP → regain all END (no other actions this turn)"
      >
        Recover (3 AP)
      </button>
      {message && <p className="recover-action__msg">{message}</p>}
    </div>
  )
}
