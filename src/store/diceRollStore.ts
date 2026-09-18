/**
 * DiceRollStore — manages the dice-roll modal lifecycle.
 *
 * Responsibilities:
 *   - Parse + evaluate variables/constants from notation.
 *   - Evaluate the full roll (variables/dice/constants) immediately.
 *   - Show modal with the result + breakdown.
 *   - Forward the completed result + context to the roll-log store.
 *
 * Two kinds of roll can be shown, and the modal renders whichever is open:
 *
 *   - a **single** roll (clicking dice notation anywhere on a sheet), held in
 *     `result`/`notation`/`source`, and
 *   - an **activation**, where one Activate press performs several rolls
 *     (accuracy, damage, custom — see lib/activationRolls.ts). Those are held
 *     in `activation` and displayed together, because the player needs to read
 *     them as one action rather than dismissing a modal per roll. Each part is
 *     still logged separately, so the roll log stays a roll-by-roll history.
 */

import { create } from 'zustand'

import { parseDiceNotation } from '@/lib/diceParser'
import { evaluateExpression, type RollResult } from '@/lib/diceRoller'
import { applyRollAdvantage } from '@/lib/diceAdvantage'
import { applyCriticalHit, removeCriticalHit } from '@/lib/diceCrit'
import { useCharacterStore } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { appThemeSheetColors } from '@/lib/themeUtils'
import type {
  AbilityBlock,
  Character,
  RollSource,
  NewRollLogEntry,
} from '@/types'
import { useRollLogStore } from '@/store/rollLogStore'

export interface RollRequest {
  notation: string
  character: Character
  source?: RollSource
  ability?: AbilityBlock
  note?: string
}

/** One expression an activation rolled, with the context it logged under. */
export interface ActivationRollRequest {
  /** Parsed + evaluated expression (e.g. "d20+MAR"). */
  notation: string
  /** The part of the activation it came from — used to group the modal. */
  kind: 'accuracy' | 'damage' | 'custom'
  /** Heading the modal prints above this roll ("Accuracy", "Damage", "Custom"). */
  groupLabel: string
  /** The roll's own name, when the author gave it one. */
  label?: string
  /** Start the result collapsed behind a "Show result" toggle. */
  hidden: boolean
  /** The evaluated result (see lib/activationRolls.ts). */
  result: RollResult
  /** Authored Advantage the result carries, for the modal's pre-fill. */
  advantage?: number
  /** Authored Disadvantage the result carries, for the modal's pre-fill. */
  disadvantage?: number
  /** Roll-log entry this roll was logged as, so it can be updated in place. */
  logEntryId?: string
}

export interface ActivationRollRequestGroup {
  /** The ability whose Activate press produced these rolls. */
  abilityName: string
  abilityId?: string
  /**
   * The entity the notation resolved against and the rolls are logged under —
   * the GM panel's instance entity on the GM Screen, otherwise the sheet's own
   * character.
   */
  character: Character
  rolls: ActivationRollRequest[]
}

export interface DiceRollState {
  isVisible: boolean
  result: RollResult | null
  notation: string
  source: RollSource | null
  ability: AbilityBlock | null
  rollCharacter: Character | null
  /** The activation whose results are open, when one was rolled. */
  activation: ActivationRollRequestGroup | null
  /** Roll-log entry the single roll was logged as, so it can be updated. */
  rollLogEntryId: string | null
}

export interface DiceRollActions {
  roll: (req: RollRequest) => void
  /**
   * Perform every roll of one ability activation and open them together.
   *
   * Nothing is rolled when the request holds no evaluated rolls, so a disabled
   * or unfinished config can never open an empty result modal.
   */
  rollActivation: (req: ActivationRollRequestGroup) => void
  /**
   * Apply Advantage/Disadvantage to the open single roll. The d6s are rolled
   * here, the result's total and `advantage` are rewritten, and the roll-log
   * entry that was created when the roll happened is updated in place.
   */
  applyAdvantage: (advantage: number, disadvantage: number) => void
  /**
   * Apply Advantage/Disadvantage to one roll inside the open activation, by
   * index, with the same roll-and-update behaviour as {@link applyAdvantage}.
   */
  applyActivationAdvantage: (
    rollIndex: number,
    advantage: number,
    disadvantage: number,
  ) => void
  /**
   * Toggle the critical hit on the open single roll: mark it (rolling the
   * damage expression a second time and keeping the higher result) or remove
   * the critical, restoring the first roll. The roll-log entry is updated in
   * place either way. Only offered for damage rolls by the modal.
   */
  toggleCritical: () => void
  /**
   * Toggle the critical hit on one roll inside the open activation, by index —
   * the same second-roll-and-keep-higher behaviour as {@link toggleCritical}.
   */
  toggleActivationCritical: (rollIndex: number) => void
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

export const useDiceRollStore = create<DiceRollStore>()((set, get) => ({
  isVisible: false,
  result: null,
  notation: '',
  source: null,
  ability: null,
  rollCharacter: null,
  activation: null,
  rollLogEntryId: null,

  roll: (req) => {
    const { notation, character, source, ability, note } = req
    const expr = parseDiceNotation(notation)
    const finalResult = evaluateExpression(expr, character)

    const resolvedSource: RollSource = source ?? (ability
      ? { type: 'ability-damage', abilityName: ability.name, abilityId: ability.id }
      : { type: 'manual', note })

    // Persist to roll-log. The entry id is kept so Advantage applied later in
    // the modal updates this same entry rather than adding a second one.
    const logEntry: NewRollLogEntry = {
      notation,
      characterId: character.id,
      characterName: character.name,
      source: resolvedSource,
      result: finalResult,
    }
    const logged = useRollLogStore.getState().logRoll(logEntry)

    set({
      isVisible: true,
      result: finalResult,
      notation,
      source: resolvedSource,
      ability: ability ?? null,
      rollCharacter: character,
      // A single roll always replaces whatever modal was open, activation or
      // not — the modal shows one thing at a time.
      activation: null,
      rollLogEntryId: logged?.id ?? null,
    })
  },

  rollActivation: (req) => {
    const { abilityName, abilityId, character, rolls } = req
    if (rolls.length === 0) return

    // Each part of the activation is its own roll-log entry: the log is a
    // roll-by-roll history, and a GM scanning it should see the damage roll
    // next to the accuracy roll that produced it. The ids are carried onto the
    // modal's rolls so Advantage applied there updates the same entries.
    const loggedRolls = rolls.map((roll) => {
      const logged = useRollLogStore.getState().logRoll({
        notation: roll.notation,
        characterId: character.id,
        characterName: character.name,
        source: {
          type: 'ability-activation',
          abilityName,
          abilityId,
          rollKind: roll.kind,
          ...(roll.label ? { rollLabel: roll.label } : {}),
        },
        result: roll.result,
      })
      return { ...roll, logEntryId: logged?.id }
    })

    set({
      isVisible: true,
      result: null,
      notation: '',
      source: null,
      ability: null,
      rollCharacter: character,
      rollLogEntryId: null,
      activation: { abilityName, abilityId, character, rolls: loggedRolls },
    })
  },

  applyAdvantage: (advantage, disadvantage) => {
    const { result, rollLogEntryId } = get()
    if (!result) return
    const next = applyRollAdvantage(result, advantage, disadvantage)
    if (next === result) return
    if (rollLogEntryId) {
      useRollLogStore.getState().updateEntryResult(rollLogEntryId, next)
    }
    set({ result: next })
  },

  applyActivationAdvantage: (rollIndex, advantage, disadvantage) => {
    const { activation } = get()
    const roll = activation?.rolls[rollIndex]
    if (!activation || !roll) return
    const next = applyRollAdvantage(roll.result, advantage, disadvantage)
    if (next === roll.result) return

    const rolls = activation.rolls.map((current, i) =>
      i === rollIndex
        ? { ...current, result: next, advantage, disadvantage }
        : current,
    )
    if (roll.logEntryId) {
      useRollLogStore.getState().updateEntryResult(roll.logEntryId, next)
    }
    set({ activation: { ...activation, rolls } })
  },

  toggleCritical: () => {
    const { result, notation, rollCharacter, rollLogEntryId } = get()
    if (!result || !rollCharacter) return

    // Removing restores the first roll exactly; marking evaluates the damage
    // expression once more and keeps the higher of the two.
    const next = result.critical
      ? removeCriticalHit(result)
      : applyCriticalHit(result, () =>
          evaluateExpression(parseDiceNotation(notation), rollCharacter),
        )
    if (next === result) return

    if (rollLogEntryId) {
      useRollLogStore.getState().updateEntryResult(rollLogEntryId, next)
    }
    set({ result: next })
  },

  toggleActivationCritical: (rollIndex) => {
    const { activation } = get()
    const roll = activation?.rolls[rollIndex]
    if (!activation || !roll) return

    const next = roll.result.critical
      ? removeCriticalHit(roll.result)
      : applyCriticalHit(roll.result, () =>
          evaluateExpression(
            parseDiceNotation(roll.notation),
            activation.character,
          ),
        )
    if (next === roll.result) return

    const rolls = activation.rolls.map((current, i) =>
      i === rollIndex ? { ...current, result: next } : current,
    )
    if (roll.logEntryId) {
      useRollLogStore.getState().updateEntryResult(roll.logEntryId, next)
    }
    set({ activation: { ...activation, rolls } })
  },

  dismiss: () => {
    set({
      isVisible: false,
      result: null,
      notation: '',
      source: null,
      ability: null,
      rollCharacter: null,
      activation: null,
      rollLogEntryId: null,
    })
  },
}))
