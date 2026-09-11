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

import { calcEndTurnENDGain } from '@/lib/calculations'
import { effectiveCombatStats } from '@/lib/abilityModifiers'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'

export interface RecoverActionProps {
  /**
   * Character whose turn is being managed. Defaults to the store's
   * `currentCharacter` (the normal sheet page); the GM Screen passes the
   * id of the panel's own character so several sheets can be run at once.
   */
  characterId?: string
}

export default function RecoverAction({ characterId }: RecoverActionProps) {
  const recover = useCharacterStore((s) => s.recover)
  const endTurn = useCharacterStore((s) => s.endTurn)
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  // Resolve by id from the list so an expanded GM-screen panel never reads
  // the wrong entity's resources.
  const character = useCharacterStore(
    (s) =>
      (characterId
        ? s.characters.find((c) => c.id === characterId)
        : s.currentCharacter) ?? null,
  )
  const activeId = character?.id ?? storeCharacter?.id ?? ''
  const currentAP = character?.currentAP ?? 0
  const currentEND = character?.currentEND ?? 0
  const { notify } = useNotification()

  // END Recovery includes any ability modifiers currently switched on.
  const endRecovery = character ? effectiveCombatStats(character).endRecovery : 0
  const totalGain = character
    ? calcEndTurnENDGain(
        currentAP,
        currentEND,
        character.attributes.GRT,
        undefined,
        endRecovery,
      )
    : endRecovery

  const handleRecover = () => {
    const success = activeId ? recover(activeId) : false
    if (success) {
      notify('Recovered! All END restored.', 'success')
    } else {
      notify('Character not found.', 'error')
    }
  }

  const handleEndTurn = () => {
    const gained = activeId ? endTurn(activeId) : 0
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
