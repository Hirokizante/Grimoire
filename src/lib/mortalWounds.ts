/**
 * Mortal Wounds — one implementation for every surface that handles them.
 *
 * The SRD's rule is the same whoever is hit (Divergence SRD "Hit Points and
 * Mortal Wounds"): at 0 HP roll a D20 on the twenty-entry Mortal Wounds table,
 * and the HP is reset to its maximum with the excess damage spilling over. A
 * player rolls it from the sheet's Mortal Wound card (`MortalWoundRoller` →
 * `characterStore.rollMortalWound`); an NPC instance rolls it automatically
 * inside `gmScreenStore.damageInstance`. Both resolve the table through here so
 * a wound's name and description can never disagree between the two.
 *
 * A wound can also be applied **by hand**, without a D20 — an ability in play,
 * an NPC's authored effect or a GM ruling can name the wound outright. That
 * path picks from this same table (`MortalWoundPicker` →
 * `characterStore.addMortalWound` / `gmScreenStore.addInstanceMortalWound`), so
 * a chosen wound is the very entry the roll would have produced.
 */

import { MAX_MORTAL_WOUNDS, MORTAL_WOUNDS } from '@/constants/gameData'
import { rollDie } from '@/lib/dice'
import type { MortalWound, MortalWoundRoll } from '@/types'

/**
 * The name `characterStore.takeDamage` parks in a slot awaiting its D20.
 *
 * A slot holding it counts as *taken* (the wound happened) but not yet
 * *named*: it is what the sheet's Mortal Wound card rolls, what a GM panel
 * shows as a dashed `?` chip, and what a manual add fills in place of the roll.
 */
export const PENDING_MORTAL_WOUND = 'Pending Roll'

/**
 * The sheet's line for a character who is actually **Knocked Out** — the SRD's
 * knock-out condition, not a full track (see {@link isKnockedOut}).
 *
 * The sheet is about one character, so the sentence never names them; every
 * surface that can knock one out (the Damage dialog, the HP stepper, the wound
 * roll) prints this same line, so the news cannot arrive worded three ways.
 */
export const KNOCKED_OUT_MESSAGE =
  'Character knocked out! Death Saves begin next turn.'

/**
 * The sheet's line for a **full track** — the state {@link isKnockedOut}
 * deliberately does not call a knock-out. Raised the moment the second wound
 * lands, and printed by the wound block's ⚠ banner while it holds.
 */
export const CRITICAL_CONDITION_MESSAGE =
  'Critical Condition! Reaching 0 HP will cause you to get Knocked Out!'

/** A Mortal Wound together with the D20 roll that produced it. */
export interface ResolvedMortalWound {
  /** The D20 roll (1–20). */
  roll: number
  /** Wound name from the table. */
  name: string
  /** Game-effect description of the wound. */
  description: string
}

/**
 * Roll a D20 on the Mortal Wounds table.
 *
 * A roll with no entry falls back to the table's first wound — the table covers
 * every face of a D20, so this only guards a table that was edited short.
 */
export function rollOnMortalWoundTable(): ResolvedMortalWound {
  const roll = rollDie(20)
  const wound = MORTAL_WOUNDS.find((w) => w.id === roll) ?? MORTAL_WOUNDS[0]
  return { roll, name: wound.name, description: wound.description }
}

/** The table entry for a wound name, or null when the table no longer has it. */
export function mortalWoundByName(name: string): MortalWound | null {
  return MORTAL_WOUNDS.find((w) => w.name === name) ?? null
}

/** The table entry a D20 roll produces, or null when the roll is off-table. */
export function mortalWoundByRoll(roll: number): MortalWound | null {
  return MORTAL_WOUNDS.find((w) => w.id === roll) ?? null
}

/**
 * The index of the next slot a wound fills on a character's track, or -1 when
 * the track is full.
 *
 * The **oldest slot that can take a name** wins: an empty one, or one parked on
 * {@link PENDING_MORTAL_WOUND} — a wound that happened but was never named, so
 * naming it (by roll or by hand) resolves that slot instead of opening a second
 * one. `characterStore.rollMortalWound` and `addMortalWound` both fill the slot
 * this returns, and the panels gate their manual-add entry point on it, so a
 * manual add can never land beside a pending roll.
 */
export function nextMortalWoundSlot(slots: readonly (string | null)[]): number {
  return slots.findIndex((w) => w == null || w === PENDING_MORTAL_WOUND)
}

/**
 * How many Mortal Wounds a track holds.
 *
 * A slot on {@link PENDING_MORTAL_WOUND} counts: the wound happened, only its
 * D20 is still outstanding. This is the count "can this character take
 * another wound?" is answered from — **not** {@link nextMortalWoundSlot},
 * which still counts a pending slot as fillable because naming it is not
 * taking a second wound.
 */
export function mortalWoundsTaken(slots: readonly (string | null)[]): number {
  return slots.filter((w) => w != null).length
}

/**
 * Whether a character is **Knocked Out** — the SRD's one condition for it
 * (Divergence SRD "Hit Points and Mortal Wounds"): *reduced to 0 HP when they
 * cannot take any more Mortal Wounds*.
 *
 * A **full track is not a knock-out**. Filling the last slot while the
 * character still stands is the Critical Condition — HP was reset to its
 * maximum and the *next* time they are reduced to 0 HP is the knock-out — so
 * the two must never be conflated: reporting `knockedOut` the moment the
 * second wound landed announced a knock-out that had not happened.
 *
 * NPC instances do not go through this: an instance has no Death Saves and is
 * `downed` when its own allowance (the base's `npcStats.mortalWounds`) runs
 * out, which is `gmScreenStore`'s rule, not a character's.
 */
export function isKnockedOut(
  slots: readonly (string | null)[],
  currentHP: number,
): boolean {
  return currentHP <= 0 && mortalWoundsTaken(slots) >= MAX_MORTAL_WOUNDS
}

/** One wound on a character's track, in the shape a GM panel row renders. */
export interface CharacterMortalWound extends MortalWoundRoll {
  /** The slot this wound sits in — slots are cleared out of order. */
  slot: number
}

/**
 * A character's wound slots as the `{ slot, roll, name }` entries both a GM
 * panel's track and the sheet's manual-add picker read.
 *
 * The panel row needs `{ roll, name }` (and the D20 that produced a named wound
 * is the table entry's id), while clearing a chip has to write back to the slot
 * the wound actually occupies — hence both in one shape. A slot awaiting its
 * D20 (`PENDING_MORTAL_WOUND`) reports `roll: 0`, which is what the row renders
 * as a dashed `?` chip rather than a made-up result.
 */
export function characterMortalWounds(
  slots: readonly (string | null)[],
): CharacterMortalWound[] {
  return slots.flatMap((name, slot) =>
    name == null ? [] : [{ slot, name, roll: mortalWoundByName(name)?.id ?? 0 }],
  )
}
