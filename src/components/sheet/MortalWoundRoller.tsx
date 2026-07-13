/**
 * MortalWoundRoller — rolls on the Mortal Wounds table when HP reaches 0.
 *
 * Per DESIGN.md "Hit Points and Mortal Wounds": when a character's HP reaches
 * 0, they incur a Mortal Wound and HP resets to max. The player rolls a D20 to
 * determine which wound from the table they receive. Up to 2 Mortal Wounds can
 * be sustained; a third would knock the character out (Death Save territory).
 *
 * This component shows filled wound slots with their names, a "Roll Mortal
 * Wound" button for any pending rolls, and allows clearing wounds (Rest).
 */

import { useState } from 'react'

import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore, type MortalWoundResult } from '@/store/characterStore'
import type { Character } from '@/types'

export interface MortalWoundRollerProps {
  character: Character
}

export default function MortalWoundRoller({ character }: MortalWoundRollerProps) {
  const rollMortalWound = useCharacterStore((s) => s.rollMortalWound)
  const clearMortalWound = useCharacterStore((s) => s.clearMortalWound)
  const fullRestore = useCharacterStore((s) => s.fullRestore)
  const [lastRoll, setLastRoll] = useState<MortalWoundResult | null>(null)
  const { notify } = useNotification()

  const hasPendingRoll = character.mortalWounds.some((w) => w === 'Pending Roll')
  const filledWounds = character.mortalWounds.filter((w) => w != null && w !== 'Pending Roll')

  const handleRoll = () => {
    const result = rollMortalWound()
    setLastRoll(result)
    notify(`Rolled ${result.roll}: ${result.woundName}`, 'warning')
    if (result.knockedOut) {
      setTimeout(() => setLastRoll(null), 5000)
      notify('Character knocked out! Death Saves begin next turn.', 'error', 5000)
    }
  }

  const handleClear = (index: number) => {
    clearMortalWound(index)
    notify('Mortal Wound cleared.', 'info')
  }

  const handleRest = () => {
    fullRestore()
    setLastRoll(null)
    notify('Full Restore: all resources restored, wounds cleared.', 'success', 4000)
  }

  return (
    <div className="mortal-wound-roller">
      <div className="mortal-wound-roller__slots">
        {character.mortalWounds.map((wound, i) => (
          <div
            key={i}
            className={
              'mortal-wound-slot' +
              (wound != null ? ' mortal-wound-slot--filled' : '')
            }
            title={wound ?? 'Empty'}
          >
            {wound === 'Pending Roll' ? '?' : wound != null ? '✕' : ''}
          </div>
        ))}
      </div>

      {filledWounds.length > 0 && (
        <ul className="mortal-wound-roller__list">
          {character.mortalWounds.map((wound, i) =>
            wound != null && wound !== 'Pending Roll' ? (
              <li key={i} className="mortal-wound-roller__entry">
                <span className="mortal-wound-roller__name">{wound}</span>
                <button
                  type="button"
                  className="btn btn--ghost mortal-wound-roller__clear"
                  onClick={() => handleClear(i)}
                  title="Clear this wound"
                >
                  Clear
                </button>
              </li>
            ) : null,
          )}
        </ul>
      )}

      {hasPendingRoll && (
        <button
          type="button"
          className="btn btn--primary mortal-wound-roller__roll"
          onClick={handleRoll}
        >
          Roll Mortal Wound (d20)
        </button>
      )}

      {lastRoll && (
        <div className="mortal-wound-result">
          <p>
            Rolled <strong>{lastRoll.roll}</strong> —{' '}
            <strong>{lastRoll.woundName}</strong>
          </p>
          <p className="mortal-wound-result__desc">{lastRoll.woundDescription}</p>
          {lastRoll.knockedOut && (
            <p className="mortal-wound-result--ko">
              ⚠ Knocked Out! Death Saves begin on your turn.
            </p>
          )}
        </div>
      )}

      {character.mortalWounds.some((w) => w != null) && (
        <button
          type="button"
          className="btn btn--ghost mortal-wound-roller__rest"
          onClick={handleRest}
          title="Full restore: HP, END, AP, FP, clear wounds & death saves"
        >
          Rest (Full Restore)
        </button>
      )}
    </div>
  )
}
