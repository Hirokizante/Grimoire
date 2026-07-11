/**
 * ResourceTracker — spend/restore controls for AP, END, and FP in view mode.
 *
 * Each resource has a compact row with − / + buttons and the current value
 * shown as `current / max`. Clicking − spends 1; clicking + restores 1.
 *
 * Also includes an "End Turn" button that regenerates END (via END Recovery)
 * and converts unspent AP to END (1:1), per DESIGN.md "Endurance" and
 * "Action Points".
 */

import { useCharacterStore } from '@/store/characterStore'
import { calcENDRecovery } from '@/lib/calculations'
import type { Character } from '@/types'

const MAX_AP = 3
const MAX_END = 10

export interface ResourceTrackerProps {
  character: Character
}

export default function ResourceTracker({ character }: ResourceTrackerProps) {
  const spendAP = useCharacterStore((s) => s.spendAP)
  const restoreAP = useCharacterStore((s) => s.restoreAP)
  const resetAP = useCharacterStore((s) => s.resetAP)
  const spendEND = useCharacterStore((s) => s.spendEND)
  const restoreEND = useCharacterStore((s) => s.restoreEND)
  const resetEND = useCharacterStore((s) => s.resetEND)
  const spendFP = useCharacterStore((s) => s.spendFP)
  const restoreFP = useCharacterStore((s) => s.restoreFP)
  const regenerateEND = useCharacterStore((s) => s.regenerateEND)
  const convertAPtoEND = useCharacterStore((s) => s.convertAPtoEND)

  const endRecovery = calcENDRecovery(character.attributes.GRT)

  const handleEndTurn = () => {
    convertAPtoEND()
    regenerateEND()
  }

  return (
    <div className="resource-tracker">
      <div className="resource-tracker__row">
        <span className="resource-tracker__label">AP</span>
        <div className="resource-tracker__controls">
          <button
            type="button"
            className="btn btn--ghost resource-btn"
            onClick={() => spendAP(1)}
            disabled={character.currentAP <= 0}
          >
            −
          </button>
          <span className="resource-tracker__value">
            {character.currentAP} / {MAX_AP}
          </span>
          <button
            type="button"
            className="btn btn--ghost resource-btn"
            onClick={() => restoreAP(1)}
            disabled={character.currentAP >= MAX_AP}
          >
            +
          </button>
          <button
            type="button"
            className="btn btn--ghost resource-btn resource-btn--reset"
            onClick={resetAP}
            title="Reset to max (start of turn)"
          >
            ⟳
          </button>
        </div>
      </div>

      <div className="resource-tracker__row">
        <span className="resource-tracker__label">END</span>
        <div className="resource-tracker__controls">
          <button
            type="button"
            className="btn btn--ghost resource-btn"
            onClick={() => spendEND(1)}
            disabled={character.currentEND <= 0}
          >
            −
          </button>
          <span className="resource-tracker__value">
            {character.currentEND} / {MAX_END}
          </span>
          <button
            type="button"
            className="btn btn--ghost resource-btn"
            onClick={() => restoreEND(1)}
            disabled={character.currentEND >= MAX_END}
          >
            +
          </button>
          <button
            type="button"
            className="btn btn--ghost resource-btn resource-btn--reset"
            onClick={resetEND}
            title="Reset to max"
          >
            ⟳
          </button>
        </div>
      </div>

      <div className="resource-tracker__row">
        <span className="resource-tracker__label">FP</span>
        <div className="resource-tracker__controls">
          <button
            type="button"
            className="btn btn--ghost resource-btn"
            onClick={() => spendFP(1)}
            disabled={character.currentFP <= 0}
          >
            −
          </button>
          <span className="resource-tracker__value">
            {character.currentFP} / {character.maxFP}
          </span>
          <button
            type="button"
            className="btn btn--ghost resource-btn"
            onClick={() => restoreFP(1)}
            disabled={character.currentFP >= character.maxFP}
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn--ghost resource-tracker__end-turn"
        onClick={handleEndTurn}
        title={`Convert AP→END (1:1) + regenerate ${endRecovery} END`}
      >
        End Turn (+{endRecovery} END)
      </button>
    </div>
  )
}
