/**
 * Automatic rolls on ability activation.
 *
 * An Ability can be authored to roll its own dice the moment its **Activate**
 * button is pressed: an accuracy check (`d20 + <attribute>`), its own damage,
 * and any number of extra rolls the author added. The three parts run in a
 * fixed order — **accuracy, then damage, then the custom rolls as authored** —
 * and their results are shown together in one result modal.
 *
 * This module owns everything that has to agree for that to work on every
 * surface (player sheets, sub-abilities, GM Screen panels and NPC instances):
 *
 *   - {@link normalizeActivationRolls} — sanitize what an editor, an import or a
 *     hand-edited export produced, so the roller never meets a half-built entry.
 *   - {@link buildActivationRollPlan} — turn the authored config plus the
 *     *acting* entity into the concrete notation to roll. Resolving here (rather
 *     than at authoring time) is what lets one authored ability roll correctly
 *     for whoever activates it: the GM's Bandit and the player's character each
 *     substitute their own attributes and custom attributes.
 *   - {@link runActivationRollPlan} — parse and evaluate the plan, grouped the
 *     way the modal renders it.
 *
 * The roll itself goes through the same `lib/diceRoller.ts` evaluation the
 * click-to-roll notation uses, so an activation roll and a hand-clicked damage
 * roll can never disagree.
 */

import { ATTRIBUTE_LIST } from '@/constants/gameData'
import { effectiveAttributes } from '@/lib/abilityModifiers'
import { findCustomAttribute } from '@/lib/customAttributes'
import { normalizeAdvantageValue, applyRollAdvantage } from '@/lib/diceAdvantage'
import { applyCriticalHit, isCriticalHit } from '@/lib/diceCrit'
import { parseDiceNotation, type ParsedExpression } from '@/lib/diceParser'
import { evaluateExpression, type RollResult } from '@/lib/diceRoller'
import type {
  AbilityBlock,
  ActivationAccuracySource,
  ActivationAdvantage,
  ActivationRoll,
  ActivationRolls,
  AttributeKey,
  Character,
} from '@/types'

/** The largest number of custom rolls one ability may carry. */
export const MAX_ACTIVATION_CUSTOM_ROLLS = 12

/** Longest custom-roll label accepted (keeps the result modal readable). */
export const MAX_ACTIVATION_ROLL_LABEL = 40

/** Every Attribute key, for validation and the editor's picker. */
const ATTRIBUTE_KEYS = new Set<string>(ATTRIBUTE_LIST.map((a) => a.key))

/** Which part of an activation a roll came from. */
export type ActivationRollKind = 'accuracy' | 'damage' | 'custom'

/**
 * One concrete roll to perform, resolved against the acting entity.
 *
 * `notation` is what the roller parses and what the roll log stores, so it is
 * the authored expression after substitution — `d20+MAR`, `2d6+POW`, `1d8+2`.
 */
export interface ActivationRollSpec {
  kind: ActivationRollKind
  /** Group heading in the result modal ("Accuracy", "Damage", "Custom"). */
  groupLabel: string
  /** The roll's own name, when it has one ("Fire damage"). */
  label?: string
  /** Dice notation to parse and evaluate. */
  notation: string
  /** Start the result collapsed behind a "Show result" toggle. */
  hidden: boolean
  /** d6s of Advantage authored on this roll (0 when none). */
  advantage: number
  /** d6s of Disadvantage authored on this roll (0 when none). */
  disadvantage: number
}

/**
 * An executed {@link ActivationRollSpec} — the notation, the evaluated result
 * and how to present it. `character` is the entity the notation resolved
 * against (the GM panel's instance entity, not necessarily the base record).
 */
export interface ActivationRollOutcome extends ActivationRollSpec {
  character: Character
  result: RollResult
}

/** Everything an activation rolled, in the order it was rolled. */
export interface ActivationRollGroup {
  accuracy?: ActivationRollOutcome
  damage?: ActivationRollOutcome
  custom: ActivationRollOutcome[]
}

/** Trim a label and cap its length; empty means "no label". */
function cleanLabel(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const label = raw.trim().slice(0, MAX_ACTIVATION_ROLL_LABEL)
  return label.length > 0 ? label : undefined
}

/**
 * Copy sanitized Advantage/Disadvantage counts onto a config entry. Zero and
 * invalid values are dropped so the stored shape carries only what was
 * authored.
 */
function assignAdvantage<T extends ActivationAdvantage>(
  target: T,
  raw: Record<string, unknown>,
): T {
  const advantage = normalizeAdvantageValue(raw.advantage)
  const disadvantage = normalizeAdvantageValue(raw.disadvantage)
  if (advantage > 0) target.advantage = advantage
  if (disadvantage > 0) target.disadvantage = disadvantage
  return target
}

/** Validate/repair one untrusted custom roll entry. */
function normalizeActivationRoll(raw: unknown): ActivationRoll | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const e = raw as Record<string, unknown>
  const notation = typeof e.notation === 'string' ? e.notation.trim() : ''
  // A roll with no expression is not a roll — drop it rather than rolling 0.
  if (!notation) return undefined
  const roll = assignAdvantage<ActivationRoll>({ notation }, e)
  const label = cleanLabel(e.label)
  if (label) roll.label = label
  if (e.hidden === true) roll.hidden = true
  return roll
}

/**
 * Validate/repair the Damage roll config: `true` (roll as written) or undefined
 * (not rolled). The damage roll deliberately carries no Advantage/Disadvantage
 * — a hit at 20+ is a critical hit that rolls damage twice instead (see
 * lib/diceCrit.ts) — so a legacy object form loads as a plain "roll damage".
 */
function normalizeDamageRoll(raw: unknown): ActivationRolls['damage'] {
  if (raw === true) return true
  if (raw && typeof raw === 'object') return true
  return undefined
}

/** Validate/repair one untrusted accuracy modifier reference. */
function normalizeAccuracyModifier(
  raw: unknown,
): ActivationAccuracySource | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Record<string, unknown>
  if (m.kind === 'custom') {
    const token = typeof m.token === 'string' ? m.token.trim() : ''
    if (!token) return undefined
    return {
      kind: 'custom',
      id: typeof m.id === 'string' ? m.id : '',
      token,
    }
  }
  // Attributes are stored by key; anything else (a hand-edited export, a target
  // from a future release) reads as "no accuracy roll" rather than a broken one.
  const key = typeof m.key === 'string' ? m.key : ''
  if (!ATTRIBUTE_KEYS.has(key)) return undefined
  return { kind: 'attribute', key: key as AttributeKey }
}

/**
 * Sanitize a stored/imported activation-roll config.
 *
 * Follows the project's backfill-on-read pattern (see `normalizeCharacter` in
 * lib/db.ts): unknown shapes are dropped rather than trusted, so the roller
 * never sees an empty notation, a nameless group or a stray value. Returns
 * `undefined` when nothing usable survives, which the callers treat as "this
 * ability rolls nothing on activation" — the key is then omitted entirely, so
 * stored shapes stay lean.
 */
export function normalizeActivationRolls(
  raw: unknown,
): ActivationRolls | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const e = raw as Record<string, unknown>
  const result: ActivationRolls = {}

  const accuracyRaw = e.accuracy
  if (accuracyRaw && typeof accuracyRaw === 'object') {
    const a = accuracyRaw as Record<string, unknown>
    const modifier = normalizeAccuracyModifier(a.modifier)
    if (modifier) {
      const accuracy = assignAdvantage<NonNullable<ActivationRolls['accuracy']>>(
        { modifier },
        a,
      )
      // The extra bonus is free-form notation (`+2`, `+1d4`), so it is kept
      // verbatim — the parser is the only thing that needs to understand it.
      if (typeof a.bonus === 'string' && a.bonus.trim()) {
        accuracy.bonus = a.bonus.trim()
      }
      result.accuracy = accuracy
    }
  }

  const damage = normalizeDamageRoll(e.damage)
  if (damage) result.damage = damage

  if (Array.isArray(e.custom)) {
    const custom: ActivationRoll[] = []
    for (const entry of e.custom) {
      const roll = normalizeActivationRoll(entry)
      if (roll) custom.push(roll)
      if (custom.length >= MAX_ACTIVATION_CUSTOM_ROLLS) break
    }
    if (custom.length > 0) result.custom = custom
  }

  return result.accuracy || result.damage || result.custom ? result : undefined
}

/** The activation-roll config on an ability (never null). */
export function activationRolls(ability: AbilityBlock): ActivationRolls {
  return ability.activationRolls ?? {}
}

/** Whether the ability rolls anything when activated. */
export function hasActivationRolls(ability: AbilityBlock): boolean {
  const rolls = activationRolls(ability)
  return (
    rolls.accuracy != null ||
    rolls.damage === true ||
    (rolls.custom?.length ?? 0) > 0
  )
}

/** The accuracy modifier's display token ("MAR", "SAN", or the full name). */
export function accuracyModifierLabel(
  source: ActivationAccuracySource | undefined,
): string {
  if (!source) return ''
  if (source.kind === 'custom') return source.token
  return ATTRIBUTE_LIST.find((a) => a.key === source.key)?.abbreviation ?? source.key
}

/**
 * The notation an accuracy roll uses for this entity: `d20+MAR`, `d20+SAN`, or
 * a bare `d20` when a custom attribute the sheet no longer defines is
 * referenced (the same "unknown variable resolves to 0" rule dice notation
 * already follows everywhere else).
 */
export function accuracyNotation(
  accuracy: NonNullable<ActivationRolls['accuracy']>,
  character: Character,
): string {
  const { modifier } = accuracy
  const custom =
    modifier.kind === 'custom'
      ? findCustomAttribute(character.customAttributes, modifier.token)
      : null
  const token =
    modifier.kind === 'custom'
      ? custom?.shorthand.trim() || custom?.name.trim() || ''
      : modifier.key
  const base = token ? `d20+${token}` : 'd20'
  const bonus = accuracy.bonus?.trim() ?? ''
  if (!bonus) return base
  // A leading sign is the author's business (`+2`, `-1`, `+1d4`); anything else
  // is treated as an addition, so "2" cannot silently become part of the die.
  return `${base}${/^[+-]/.test(bonus) ? bonus : `+${bonus}`}`
}

/**
 * The entity's own name for an accuracy modifier — used by the editor to show
 * which value a roll will actually add.
 *
 * Attributes are read through `effectiveAttributes`, so a switched-on ability
 * modifier (a Rage that adds +3 MAR) is included — exactly as it is when the
 * same `d20+MAR` is clicked by hand.
 */
export function accuracyModifierValue(
  accuracy: NonNullable<ActivationRolls['accuracy']>,
  character: Character,
): number | null {
  const { modifier } = accuracy
  if (modifier.kind === 'attribute') {
    return effectiveAttributes(character)[modifier.key] ?? null
  }
  return findCustomAttribute(character.customAttributes, modifier.token)?.value ?? null
}

/**
 * Turn an ability's authored config plus the acting entity into the concrete
 * list of rolls to perform, in order: accuracy, damage, then custom rolls.
 *
 * Returns an empty list when the ability rolls nothing — or when damage is
 * switched on but the ability has no damage expression, which is a
 * half-configured ability rather than an error (the card simply has no damage
 * to roll).
 */
export function buildActivationRollPlan(
  ability: AbilityBlock,
  character: Character,
): ActivationRollSpec[] {
  const rolls = activationRolls(ability)
  const plan: ActivationRollSpec[] = []

  if (rolls.accuracy) {
    plan.push({
      kind: 'accuracy',
      groupLabel: 'Accuracy',
      notation: accuracyNotation(rolls.accuracy, character),
      hidden: false,
      advantage: rolls.accuracy.advantage ?? 0,
      disadvantage: rolls.accuracy.disadvantage ?? 0,
    })
  }

  if (rolls.damage === true && ability.damage.trim()) {
    plan.push({
      kind: 'damage',
      groupLabel: 'Damage',
      // The ability's own damage field IS the notation, so editing the field
      // updates the activation roll with it — no second copy to keep in sync.
      notation: ability.damage.trim(),
      hidden: false,
      // Damage carries no Advantage/Disadvantage: a critical hit is decided by
      // the accuracy total at execution and rolls the damage twice instead.
      advantage: 0,
      disadvantage: 0,
    })
  }

  for (const roll of rolls.custom ?? []) {
    plan.push({
      kind: 'custom',
      groupLabel: 'Custom',
      label: cleanLabel(roll.label),
      notation: roll.notation,
      hidden: roll.hidden === true,
      advantage: roll.advantage ?? 0,
      disadvantage: roll.disadvantage ?? 0,
    })
  }

  return plan
}

/**
 * Parse a spec's notation, or null when the parser can make nothing of it. The
 * one definition of "this roll can run", shared by the runner and
 * {@link willRollOnActivation}.
 */
function parseSpec(spec: ActivationRollSpec): ParsedExpression | null {
  const expression = parseDiceNotation(spec.notation)
  return expression.root ? expression : null
}

/**
 * Execute an activation plan: parse and evaluate every roll against the acting
 * entity, keeping the authored order and the part each roll belongs to.
 *
 * An expression the parser cannot make anything of is skipped rather than
 * rolled as zero — a malformed custom roll should cost the player a line in the
 * modal, not a wrong number. A roll's authored Advantage/Disadvantage is rolled
 * here, after its expression, so the opening result already includes it (the
 * modal can still re-roll it — see lib/diceAdvantage.ts).
 *
 * Accuracy runs before damage (the plan's fixed order), so a damage spec can
 * see the attack roll it follows: an accuracy total at or above
 * {@link isCriticalHit}'s threshold makes the damage a **critical hit**, rolled
 * twice with the higher result kept (lib/diceCrit.ts). An activation with no
 * accuracy roll of its own has no attack roll to crit on.
 */
export function runActivationRollPlan(
  plan: readonly ActivationRollSpec[],
  character: Character,
): ActivationRollGroup {
  const group: ActivationRollGroup = { custom: [] }

  for (const spec of plan) {
    const expression = parseSpec(spec)
    if (!expression) continue
    let result = applyRollAdvantage(
      evaluateExpression(expression, character),
      spec.advantage,
      spec.disadvantage,
    )
    if (spec.kind === 'damage' && isCriticalHit(group.accuracy?.result)) {
      result = applyCriticalHit(result, () =>
        evaluateExpression(expression, character),
      )
    }
    const outcome: ActivationRollOutcome = { ...spec, character, result }
    if (spec.kind === 'accuracy') group.accuracy = outcome
    else if (spec.kind === 'damage') group.damage = outcome
    else group.custom.push(outcome)
  }

  return group
}

/**
 * Whether activating the ability will really open a result window for this
 * entity.
 *
 * {@link hasActivationRolls} reports what the author configured; this reports
 * what would run. The two differ for a half-configured ability (damage switched
 * on with an empty Damage field, which builds no spec) and for one whose only
 * expression the parser cannot read (the plan holds it, but
 * {@link runActivationRollPlan} would skip it). A surface whose only reason to
 * offer an Activate button is the rolls asks this question, not the authored
 * one, so no button opens an empty result window (see
 * `useNpcInstanceActivation`).
 */
export function willRollOnActivation(
  ability: AbilityBlock,
  character: Character,
): boolean {
  return buildActivationRollPlan(ability, character).some(
    (spec) => parseSpec(spec) != null,
  )
}

/** Whether an executed group actually holds any roll. */
export function hasActivationRollOutcomes(group: ActivationRollGroup): boolean {
  return group.accuracy != null || group.damage != null || group.custom.length > 0
}

/** Every outcome in a group, in the order it was rolled. */
export function activationRollOutcomes(
  group: ActivationRollGroup,
): ActivationRollOutcome[] {
  const outcomes: ActivationRollOutcome[] = []
  if (group.accuracy) outcomes.push(group.accuracy)
  if (group.damage) outcomes.push(group.damage)
  outcomes.push(...group.custom)
  return outcomes
}

/**
 * Build and run in one step — the path an activation takes.
 */
export function rollAbilityActivation(
  ability: AbilityBlock,
  character: Character,
): ActivationRollGroup {
  return runActivationRollPlan(
    buildActivationRollPlan(ability, character),
    character,
  )
}
