/**
 * DeathSaveTracker — tracks and rolls Death Saves for a knocked-out character.
 *
 * Per DESIGN.md "Death Saves":
 * - A Death Save is a D20 roll against DC 10, unmodifiable.
 * - Rolling 20+ counts as 2 successes.
 * - Rolling 1 counts as 2 failures.
 * - 3 successes → character revives at 1 HP.
 * - 3 failures → character dies.
 *
 * The tracker shows success/failure pips and a "Roll Death Save" button.
 * The player can also manually adjust successes/failures if needed.
 */

import { useState } from 'react'

import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore, type DeathSaveResult } from '@/store/characterStore'
import type { Character } from '@/types'

export interface DeathSaveTrackerProps {
  character: Character
}

export default function DeathSaveTracker({ character }: DeathSaveTrackerProps) {
  const rollDeathSave = useCharacterStore((s) => s.rollDeathSave)
  const updateCurrentCharacter = useCharacterStore((s) => s.updateCurrentCharacter)
  const [lastRoll, setLastRoll] = useState<DeathSaveResult | null>(null)
  const { notify } = useNotification()

  const { successes, failures } = character.deathSaves
  const isDead = failures >= 3
  const isRevived = successes >= 3

  const handleRoll = () => {
    const result = rollDeathSave()
    setLastRoll(result)
    if (result.revived) {
      notify('Revived at 1 HP!', 'success', 5000)
    } else if (result.died) {
      notify('The character has died.', 'error', 5000)
    } else {
      notify(`Rolled ${result.roll}: ${result.doubled ? (result.roll >= 20 ? '2 successes!' : '2 failures!') : result.roll >= 10 ? '1 success' : '1 failure'}`, 'info')
    }
  }

  const adjustSuccess = (delta: number) => {
    updateCurrentCharacter((char) => ({
      ...char,
      deathSaves: {
        ...char.deathSaves,
        successes: Math.max(0, Math.min(3, char.deathSaves.successes + delta)),
      },
    }))
  }

  const adjustFailure = (delta: number) => {
    updateCurrentCharacter((char) => ({
      ...char,
      deathSaves: {
        ...char.deathSaves,
        failures: Math.max(0, Math.min(3, char.deathSaves.failures + delta)),
      },
    }))
  }

  return (
    <div className="death-save-tracker">
      <div className="death-save-tracker__row">
        <span className="death-save-tracker__label">Successes</span>
        <div className="death-save-tracker__pips">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={
                'death-pip' + (i < successes ? ' death-pip--success' : '')
              }
            />
          ))}
          <button
            type="button"
            className="btn btn--ghost pip-btn"
            onClick={() => adjustSuccess(-1)}
            disabled={successes <= 0}
          >
            −
          </button>
          <button
            type="button"
            className="btn btn--ghost pip-btn"
            onClick={() => adjustSuccess(1)}
            disabled={successes >= 3}
          >
            +
          </button>
        </div>
      </div>

      <div className="death-save-tracker__row">
        <span className="death-save-tracker__label">Failures</span>
        <div className="death-save-tracker__pips">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={
                'death-pip' + (i < failures ? ' death-pip--failure' : '')
              }
            />
          ))}
          <button
            type="button"
            className="btn btn--ghost pip-btn"
            onClick={() => adjustFailure(-1)}
            disabled={failures <= 0}
          >
            −
          </button>
          <button
            type="button"
            className="btn btn--ghost pip-btn"
            onClick={() => adjustFailure(1)}
            disabled={failures >= 3}
          >
            +
          </button>
        </div>
      </div>

      {!isDead && !isRevived && (
        <button
          type="button"
          className="btn btn--primary death-save-tracker__roll"
          onClick={handleRoll}
        >
          Roll Death Save (d20)
        </button>
      )}

      {lastRoll && (
        <div className="death-save-result">
          <p>
            Rolled <strong>{lastRoll.roll}</strong> →{' '}
            {lastRoll.doubled
              ? lastRoll.roll >= 20
                ? '2 successes!'
                : '2 failures!'
              : lastRoll.roll >= 10
                ? '1 success'
                : '1 failure'}
          </p>
          {lastRoll.revived && (
            <p className="death-save-result--revive">✦ Revived at 1 HP!</p>
          )}
          {lastRoll.died && (
            <p className="death-save-result--dead">☠ The character has died.</p>
          )}
        </div>
      )}

      {isRevived && !lastRoll && (
        <p className="death-save-result--revive">✦ Character is conscious.</p>
      )}
      {isDead && !lastRoll && (
        <p className="death-save-result--dead">☠ Character has died.</p>
      )}
    </div>
  )
}
