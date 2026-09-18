/**
 * gmScreenTurns — one entity's turn, as the GM Screen announces and records it.
 *
 * A turn can be started from two places: the panel's own **Start new turn**
 * button, and the screen toolbar's **New Round**, which starts every panel's
 * turn at once. Both must tell the GM the same thing and leave the same
 * journal entry, so the wording and the roll-log shape live here once — a
 * round started from the toolbar reads exactly like a turn started from the
 * panel.
 */

import {
  RECHARGE_ROLL_NOTATION,
  rechargeRollResult,
  type RechargeOutcome,
} from '@/lib/abilityRecharge'
import type { NewRollLogEntry, RollLogEntry } from '@/types'

/** The store action that writes a roll-log entry (structurally `logRoll`). */
export type LogRoll = (input: NewRollLogEntry) => RollLogEntry

/** Names of the abilities a Recharge Die brought back. */
function rechargedNames(outcome: RechargeOutcome): string[] {
  return outcome.recharged.map((entry) => entry.name)
}

/** The toast for one NPC instance's turn (AP refill + Recharge Die). */
export function instanceTurnMessage(
  label: string,
  outcome: RechargeOutcome,
): string {
  const names = rechargedNames(outcome)
  return names.length
    ? `${label}'s turn — Recharge Die: ${outcome.roll} · recharged: ${names.join(', ')}`
    : `${label}'s turn — Recharge Die: ${outcome.roll} · nothing recharged`
}

/**
 * Write one NPC instance's Recharge Die to the persistent roll log, in the
 * shape the panel's own turn writes it: the instance label, the die, and what
 * it brought back — so a session's turns read back like a journal.
 */
export function logInstanceTurnRoll(
  logRoll: LogRoll,
  baseId: string,
  label: string,
  outcome: RechargeOutcome,
): void {
  logRoll({
    notation: RECHARGE_ROLL_NOTATION,
    characterId: baseId,
    characterName: label,
    source: {
      type: 'recharge',
      npcName: label,
      recharged: rechargedNames(outcome),
    },
    result: rechargeRollResult(outcome.roll),
  })
}

/** The toast for one player character's turn (the sheet's own End Turn). */
export function characterTurnMessage(name: string, gainedEND: number): string {
  return gainedEND > 0
    ? `${name}'s turn — AP restored · +${gainedEND} END`
    : `${name}'s turn — AP replenished`
}
