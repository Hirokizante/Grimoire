/**
 * RecoverAction — the Recover combat action and End Turn button.
 *
 * **Recover** (DESIGN.md "Recover"): Immediately regains all Endurance.
 *
 * **End Turn**: Converts unspent AP to END (1:1) and regenerates END via END
 * Recovery (DESIGN.md "Endurance" and "Action Points").
 *
 * Actions trigger toast notifications for feedback. The "clear 1 status" part
 * of Recover is left to the player's discretion (Mortal Wounds can be cleared
 * via the MortalWoundRoller).
 */

import { calcENDRecovery, calcEndTurnENDGain } from '@/lib/calculations'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'

export default function RecoverAction() {
  const recover = useCharacterStore((s) => s.recover)
  const endTurn = useCharacterStore((s) => s.endTurn)
  const character = useCharacterStore((s) => s.currentCharacter)
  const currentAP = useCharacterStore((s) => s.currentCharacter?.currentAP ?? 0)
  const currentEND = useCharacterStore((s) => s.currentCharacter?.currentEND ?? 0)
  const { notify } = useNotification()

  const endRecovery = character ? calcENDRecovery(character.attributes.GRT) : 0
  const totalGain = character
    ? calcEndTurnENDGain(currentAP, currentEND, character.attributes.GRT)
    : endRecovery

  const handleRecover = () => {
    const success = recover()
    if (success) {
      notify('Recovered! All END restored.', 'success')
    } else {
      notify('Character not found.', 'error')
    }
  }

  const handleEndTurn = () => {
    const gained = endTurn()
    if (gained > 0) {
      notify(`End Turn: +${gained} END`, 'success')
    } else {
      notify('End Turn: AP replenished (already at max END)', 'info')
    }
  }

  return (
    <div className="recover-action">
      <div className="recover-action__buttons">
        <button
          type="button"
          className="btn btn--primary recover-action__btn"
          onClick={handleRecover}
          title="Regain all END (no other actions this turn)"
        >
          Recover
        </button>
        <button
          type="button"
          className="btn btn--ghost recover-action__btn recover-action__btn--end-turn"
          onClick={handleEndTurn}
          title={`Convert AP→END (1:1) + ${endRecovery} END Recovery`}
        >
          {totalGain > 0 ? `End Turn (+${totalGain} END)` : 'End Turn'}
        </button>
      </div>
    </div>
  )
}
