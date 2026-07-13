/**
 * MortalWoundRoller — rolls on the Mortal Wounds table when HP reaches 0.
 *
 * Per DESIGN.md "Hit Points and Mortal Wounds": when a character's HP reaches
 * 0, they incur a Mortal Wound and HP resets to max. The player rolls a D20 to
 * determine which wound from the table they receive. Up to 2 Mortal Wounds can
 * be sustained; a third would knock the character out (Death Save territory).
 *
 * The redesigned Mortal Wound card is large, showing the wound's d20 roll
 * number, its name, and its game effect in a single self-contained card.
 */

import { MORTAL_WOUNDS } from '@/constants/gameData'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'

export interface MortalWoundRollerProps {
  character: Character
}

export default function MortalWoundRoller({ character }: MortalWoundRollerProps) {
  const rollMortalWound = useCharacterStore((s) => s.rollMortalWound)
  const clearMortalWound = useCharacterStore((s) => s.clearMortalWound)
  const fullRestore = useCharacterStore((s) => s.fullRestore)
  const { notify } = useNotification()

  const hasPendingRoll = character.mortalWounds.some((w) => w === 'Pending Roll')
  const filledCount = character.mortalWounds.filter((w) => w != null).length

  const handleRoll = () => {
    const result = rollMortalWound()
    if (result.knockedOut) {
      notify('Character knocked out! Death Saves begin next turn.', 'error', 5000)
    }
  }

  const handleClear = (index: number) => {
    clearMortalWound(index)
    notify('Mortal Wound cleared.', 'info', 2000)
  }

  const handleRest = () => {
    fullRestore()
    notify('Full Restore: all resources and wound slots cleared.', 'success', 4000)
  }

  return (
    <div className="mortal-wound-roller">
      {filledCount > 0 && (
        <div className="mw-card-grid">
          {character.mortalWounds.map((woundName, i) => {
            if (woundName == null) return null
            const isPending = woundName === 'Pending Roll'
            const woundData = MORTAL_WOUNDS.find((w) => w.name === woundName)
            const rollNumber = woundData?.id ?? null
            const description = woundData?.description ?? ''

            return (
              <div key={i} className={`mw-card${isPending ? ' mw-card--pending' : ''}`}>
                <div className="mw-card__roll">{isPending ? '?' : rollNumber}</div>
                <div className="mw-card__body">
                  <div className="mw-card__header">
                    <span className="mw-card__name">
                      {isPending ? 'Roll to determine' : woundName}
                    </span>
                    {!isPending && (
                      <button
                        type="button"
                        className="mw-card__clear"
                        onClick={() => handleClear(i)}
                        title="Clear this wound"
                        aria-label={`Clear ${woundName}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {!isPending && (
                    <p className="mw-card__desc">{description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasPendingRoll && (
        <button
          type="button"
          className="btn btn--primary mw-roll-btn"
          onClick={handleRoll}
        >
          Roll Mortal Wound (d20)
        </button>
      )}

      {filledCount >= 2 && character.currentHP > 0 && (
        <div className="mw-card mw-card--ko">
          <p className="mw-card__ko-text">
            ⚠ Critical Condition! Reaching 0 HP will cause you to get Knocked Out!
          </p>
        </div>
      )}

      {filledCount > 0 && (
        <button
          type="button"
          className="btn btn--ghost mw-rest-btn"
          onClick={handleRest}
          title="Full restore: HP, END, AP, FP, clear wounds & death saves"
        >
          Rest (Full Restore)
        </button>
      )}
    </div>
  )
}
