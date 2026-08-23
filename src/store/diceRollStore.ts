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
import { useCharacterStore } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { appThemeSheetColors } from '@/lib/themeUtils'
import type {
  Character,
  RollSource,
  NewRollLogEntry,
  AbilityBlock,
} from '@/types'
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

/**
 * The entity whose theme the dice-result modal should render with.
 *
 * - Player sheets: their own per-sheet customization.
 * - Standalone NPC sheets: no customization exists, so the app theme's NPC
 *   palette (matches NPCSheet).
 * - Embedded NPC sections (inside a player sheet tab): the host player
 *   sheet's colors, so the modal matches the page it was rolled from.
 */
export function themeEntity(): Character | null {
  const { rollCharacter } = useDiceRollStore.getState()
  if (!rollCharacter) return null
  if (rollCharacter.kind !== 'npc') return rollCharacter

  // Standalone vs embedded: an embedded NPC section lives inside a custom
  // tab of a player character whose `currentCharacter` is that player.
  const current = useCharacterStore.getState().currentCharacter
  if (current && current.kind === 'character' && current.id !== rollCharacter.id) {
    return current
  }
  const appTheme = useAppThemeStore.getState().theme
  return {
    ...rollCharacter,
    config: { ...rollCharacter.config, colors: appThemeSheetColors(appTheme) },
  }
}

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
