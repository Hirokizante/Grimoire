/**
 * DiceRollStore — manages the dice-roll modal lifecycle.
 *
 * Responsibilities:
 *   - Parse + evaluate variables/constants from notation.
 *   - Evaluate the full roll (variables/dice/constants) immediately.
 *   - Show modal with the result + breakdown.
 *   - Forward the completed result + context to the roll-log store.
 */

import { create } from 'zustand'

import { parseDiceNotation } from '@/lib/diceParser'
import { evaluateExpression, type RollResult } from '@/lib/diceRoller'
import type { Character, RollSource, NewRollLogEntry, AbilityBlock } from '@/types'
import { useRollLogStore } from '@/store/rollLogStore'

export interface RollRequest {
  notation: string
  character: Character
  source?: RollSource
  ability?: AbilityBlock
  note?: string
}

export interface DiceRollState {
  isVisible: boolean
  result: RollResult | null
  notation: string
  source: RollSource | null
  ability: AbilityBlock | null
  rollCharacter: Character | null
}

export interface DiceRollActions {
  roll: (req: RollRequest) => void
  dismiss: () => void
}

export type DiceRollStore = DiceRollState & DiceRollActions

export const useDiceRollStore = create<DiceRollStore>()((set) => ({
  isVisible: false,
  result: null,
  notation: '',
  source: null,
  ability: null,
  rollCharacter: null,

  roll: (req) => {
    const { notation, character, source, ability, note } = req
    const expr = parseDiceNotation(notation)
    const finalResult = evaluateExpression(expr, character)

    const resolvedSource: RollSource = source ?? (ability
      ? { type: 'ability-damage', abilityName: ability.name, abilityId: ability.id }
      : { type: 'manual', note })

    // Persist to roll-log.
    const logEntry: NewRollLogEntry = {
      notation,
      characterId: character.id,
      characterName: character.name,
      source: resolvedSource,
      result: finalResult,
    }
    useRollLogStore.getState().logRoll(logEntry)

    set({
      isVisible: true,
      result: finalResult,
      notation,
      source: resolvedSource,
      ability: ability ?? null,
      rollCharacter: character,
    })
  },

  dismiss: () => {
    set({
      isVisible: false,
      result: null,
      notation: '',
      source: null,
      ability: null,
      rollCharacter: null,
    })
  },
}))
