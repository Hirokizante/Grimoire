/**
 * Derived-stat calculations for the Divergence TTRPG.
 *
 * Every function here is a pure mapping from raw Attributes/Milestones to the
 * calculated fields the sheet displays read-only (see DESIGN.md,
 * "Calculated Fields"). Keeping them in one module makes them trivial to unit
 * test and guarantees a single source of truth for each formula.
 */

/**
 * Maximum Hit Points.
 *
 * Formula (DESIGN.md "Hit Points"): `20 + (VIT * 5)`.
 *
 * @param vit - The character's Vitality attribute.
 * @returns The character's maximum HP.
 */
export function calcHP(vit: number): number {
  return 20 + vit * 5
}

/**
 * Evasion (EVA) — the target attackers must beat to hit this character.
 *
 * Formula (DESIGN.md "Evasion"): `10 + AGI`.
 *
 * @param agi - The character's Agility attribute.
 * @returns The character's Evasion value.
 */
export function calcEvasion(agi: number): number {
  return 10 + agi
}

/**
 * Armor — natural damage reduction; each point grants 1d6 of reduction.
 *
 * Formula (DESIGN.md "Armor"): `floor(VIT / 2)`.
 *
 * @param vit - The character's Vitality attribute.
 * @returns The character's Armor value.
 */
export function calcArmor(vit: number): number {
  return Math.floor(vit / 2)
}

/**
 * Movement — the number of tiles a character can move on their turn.
 *
 * Formula (DESIGN.md "Movement"): `5 + floor(AGI / 2)`.
 *
 * @param agi - The character's Agility attribute.
 * @returns The character's Movement value in tiles.
 */
export function calcMovement(agi: number): number {
  return 5 + Math.floor(agi / 2)
}

/**
 * Milestone Bonus — added to all saves and attack rolls, and drives Save DC.
 *
 * Formula (DESIGN.md "Milestones" / "Milestone Bonus"): `floor(Milestones / 2)`.
 *
 * @param milestones - The character's current Milestone count.
 * @returns The character's Milestone Bonus.
 */
export function calcMilestoneBonus(milestones: number): number {
  return Math.floor(milestones / 2)
}

/**
 * Save DC — the target others must beat to resist this character's Abilities.
 *
 * Formula (DESIGN.md "Save DC"): `10 + Milestone Bonus`.
 *
 * @param milestones - The character's current Milestone count.
 * @returns The character's Save DC.
 */
export function calcSaveDC(milestones: number): number {
  return 10 + calcMilestoneBonus(milestones)
}

/**
 * END Recovery — Endurance regained at the end of each of the character's turns.
 *
 * Formula (DESIGN.md "Endurance Recovery"): `max(1, 1 + floor(GRT / 2))`.
 *
 * @param grt - The character's Grit attribute.
 * @returns The character's END Recovery value.
 */
export function calcENDRecovery(grt: number): number {
  return Math.max(1, 1 + Math.floor(grt / 2))
}

/**
 * Total END gained when ending a turn: sum of unspent AP (1:1) and END
 * Recovery, capped so final END does not exceed max END.
 *
 * @param currentAP - Current unspent Action Points.
 * @param currentEND - Current Endurance before the turn ends.
 * @param grt - Grit attribute (drives END Recovery).
 * @param maxEND - Maximum Endurance (defaults to 10).
 * @returns Actual END regained at end of turn (0 if already at max).
 */
export function calcEndTurnENDGain(
  currentAP: number,
  currentEND: number,
  grt: number,
  maxEND: number = 10,
): number {
  const apToEND = Math.min(currentAP, maxEND - currentEND)
  const recovery = calcENDRecovery(grt)
  const finalEND = Math.min(maxEND, currentEND + apToEND + recovery)
  return finalEND - currentEND
}