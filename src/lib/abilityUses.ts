/**
 * Limited-use abilities.
 *
 * An Ability can be flagged as **limited**: it may only be used a fixed number
 * of times before it is exhausted. The limit is authored in the Ability Block
 * editor (`uses.max`), together with whether clicking Activate consumes one of
 * those uses (`uses.expendOnActivate`). The remaining count (`uses.current`) is
 * live-play state, exactly like `currentHP` or a custom resource bar: it moves
 * when the ability is activated and is always refilled on a full restore/rest.
 *
 * Keeping the state on the AbilityBlock (rather than in a character-level map
 * keyed by ability id) means a block is self-contained wherever it appears —
 * core, slotted, pool, custom tabs, and nested Sub-Abilities all read the same
 * field — and every mutation below goes through lib/abilityModifiers.ts's
 * `mapAbilities`/`findAbility`, the shared sheet-tree walk, so an ability is
 * found no matter where on the sheet it lives.
 *
 * Sub-Abilities may be limited too (they carry the same editor and their own
 * Activate button, see SubAbilityBlock), so every helper recurses into both
 * nesting points.
 *
 * **NPC instances are the exception that proves the rule.** A base NPC record is
 * a static reference — the GM Screen spawns instances *from* it — so its own
 * `uses.current` is never live state an instance reads: an instance keeps its
 * own sparse count per ability (`NpcInstanceState.abilityUses`) and renders the
 * base through {@link withInstanceAbilityUses}. See the "NPC instances" section
 * at the bottom of this file.
 */

import { findAbility, mapAbilities } from '@/lib/abilityModifiers'
import type { AbilityBlock, AbilityUses, Character } from '@/types'

/**
 * Largest number of uses a limited Ability may be given. A generous ceiling
 * that still keeps the numeric readout sane (and the token row on the card
 * comfortably inside the ≤5 range).
 */
export const MAX_ABILITY_USES = 99

/** Max uses a limited Ability is seeded with when the toggle is first turned on. */
export const DEFAULT_ABILITY_USES = 3

/**
 * Uses displayed as one token per use. Six or more reads better as a plain
 * `current / max` number than as a row of pips (see AbilityUsesMeter).
 */
export const MAX_TOKEN_USES = 5

/** Validate/repair an untrusted use-limit entry (imports, older records). */
export function normalizeAbilityUses(raw: unknown): AbilityUses | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { max, current, expendOnActivate } = raw as Record<string, unknown>

  const maxNum = typeof max === 'number' ? max : Number(max)
  if (!Number.isFinite(maxNum)) return undefined
  const maxUses = Math.min(MAX_ABILITY_USES, Math.floor(maxNum))
  if (maxUses < 1) return undefined

  const currentNum = typeof current === 'number' ? current : Number(current)
  const currentUses = Number.isFinite(currentNum)
    ? Math.min(maxUses, Math.max(0, Math.floor(currentNum)))
    : maxUses

  return {
    max: maxUses,
    current: currentUses,
    expendOnActivate: expendOnActivate !== false,
  }
}

/**
 * The use limit on an ability, or null when it is unlimited (the common case).
 * A malformed entry reads as unlimited rather than rendering a broken meter.
 */
export function abilityUses(ability: AbilityBlock): AbilityUses | null {
  return normalizeAbilityUses(ability.uses) ?? null
}

/** Whether the ability is limited to a number of uses. */
export function isLimitedAbility(ability: AbilityBlock): boolean {
  return abilityUses(ability) != null
}

/** Remaining uses on a limited ability (0 for an unlimited one). */
export function abilityUsesRemaining(ability: AbilityBlock): number {
  return abilityUses(ability)?.current ?? 0
}

/**
 * Whether an Activate click consumes a use. Always false for an unlimited
 * ability, and for one the author chose to leave out of the use economy.
 */
export function expendsUseOnActivate(ability: AbilityBlock): boolean {
  const uses = abilityUses(ability)
  return uses != null && uses.expendOnActivate && uses.max > 0
}

/**
 * Whether the ability can still be activated, judged on uses alone (resource
 * affordability is a separate check). Unlimited abilities always can.
 */
export function hasUsesRemaining(ability: AbilityBlock): boolean {
  const uses = abilityUses(ability)
  return uses == null || uses.current > 0
}

/**
 * A use-limit entry as the editor writes it: the authored maximum, with the
 * remaining count following it (so a fresh ability starts full and a re-typed
 * maximum can never leave the meter reading more uses than the ability has).
 * Both values are clamped — `max` into `1…MAX_ABILITY_USES`, `current` into
 * `[0, max]`.
 */
export function buildAbilityUses(opts: {
  max: number
  current?: number
  expendOnActivate?: boolean
}): AbilityUses {
  const max = Math.min(
    MAX_ABILITY_USES,
    Math.max(1, Math.floor(Number.isFinite(opts.max) ? opts.max : 1)),
  )
  const rawCurrent =
    opts.current == null || !Number.isFinite(opts.current)
      ? max
      : Math.floor(opts.current)
  return {
    max,
    current: Math.min(max, Math.max(0, rawCurrent)),
    expendOnActivate: opts.expendOnActivate !== false,
  }
}

/**
 * Set the remaining uses on one limited ability, matched by id anywhere on the
 * sheet. Values are clamped into `[0, max]`; an unknown id, or one whose block
 * is not limited, leaves the character untouched (same reference).
 */
export function setAbilityUsesRemaining(
  character: Character,
  abilityId: string,
  remaining: number,
): Character {
  let touched = false

  const next = mapAbilities(character, (ability) => {
    if (ability.id !== abilityId) return ability
    const uses = abilityUses(ability)
    if (!uses) return ability
    const clamped = Math.min(uses.max, Math.max(0, Math.floor(remaining)))
    if (clamped === uses.current) return ability
    touched = true
    return { ...ability, uses: { ...uses, current: clamped } }
  })

  return touched ? next : character
}

/**
 * Consume one use of a limited ability. Returns the updated character plus
 * whether a use was actually spent, so the caller can decide between
 * "use spent" and "no uses left" before deducting anything else. An ability
 * that is unlimited, or limited but not use-expending on activation, reports
 * `spent: false` without changing the character.
 */
export function spendAbilityUse(
  character: Character,
  abilityId: string,
): { character: Character; spent: boolean } {
  const target = findAbility(character, abilityId)

  if (!target) return { character, spent: false }
  const uses = abilityUses(target)
  if (!uses || !expendsUseOnActivate(target) || uses.current <= 0) {
    return { character, spent: false }
  }

  return {
    character: setAbilityUsesRemaining(character, abilityId, uses.current - 1),
    spent: true,
  }
}

/**
 * Refill every limited ability on the character to its maximum — the
 * "uses are always restored on a rest / full restore" rule. Abilities that are
 * already full (and every unlimited ability) keep their reference, so a
 * character with no limited abilities at all is returned unchanged.
 */
export function restoreAllAbilityUses(character: Character): Character {
  return mapAbilities(character, (ability) => {
    const uses = abilityUses(ability)
    if (!uses || uses.current === uses.max) return ability
    return { ...ability, uses: { ...uses, current: uses.max } }
  })
}

// ---- NPC instances (GM Screen) ----------------------------------------------
//
// A GM Screen NPC instance is a **delta, not a clone** (see types/gmScreen.ts):
// its abilities are the base record's, read at render time, and the one piece
// of ability state it owns is how many uses it has left of each limited one.
// `NpcInstanceState.abilityUses` stores that as a sparse `{ abilityId: count }`
// map — an absent entry means "untouched, still on the ability's authored
// maximum" — and the helpers below read and apply it.

/**
 * Validate/repair an instance's remaining-uses map (imports, older screens).
 * Entries with a blank id or an unusable count are dropped, and every count is
 * floored into `[0, MAX_ABILITY_USES]`. The per-ability maximum is not known
 * here — it lives on the base record — so the render helper clamps against it.
 */
export function normalizeInstanceAbilityUses(
  raw: unknown,
): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [abilityId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!abilityId) continue
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) continue
    out[abilityId] = Math.min(MAX_ABILITY_USES, Math.max(0, Math.floor(num)))
  }
  return out
}

/**
 * How many uses an NPC instance has left of one limited ability: the count the
 * instance recorded for it, or the ability's authored maximum when it has not
 * touched it. Recorded counts are clamped to `[0, max]`, so lowering an
 * ability's maximum on the base tightens every instance that had spent into it,
 * and the base record's own live-play `current` is **never** read — a base sheet
 * is a static reference, so an instance always starts full.
 *
 * Unlimited abilities answer 0 (they have no budget to read).
 */
export function instanceAbilityUsesRemaining(
  ability: AbilityBlock,
  recorded: number | null | undefined,
): number {
  const uses = abilityUses(ability)
  if (!uses) return 0
  if (recorded == null || !Number.isFinite(recorded)) return uses.max
  return Math.min(uses.max, Math.max(0, Math.floor(recorded)))
}

/**
 * The entity a GM Screen NPC panel renders: the base record with this
 * instance's own remaining-uses counts applied to its abilities, and the
 * authored maximum wherever the instance has not spent into the budget.
 *
 * This is a *render-time projection*, not a clone — `mapAbilities` rebuilds only
 * the branches that actually differ, so a base that is already full (every
 * normally-authored one) comes back as the very same reference and editing the
 * base keeps reaching every instance. Nothing here is ever written back to the
 * base record.
 */
export function withInstanceAbilityUses(
  base: Character,
  recorded: Record<string, number> | null | undefined,
): Character {
  if (!recorded) return base
  return mapAbilities(base, (ability) => {
    const uses = abilityUses(ability)
    if (!uses) return ability
    const current = instanceAbilityUsesRemaining(ability, recorded[ability.id])
    if (current === uses.current) return ability
    return { ...ability, uses: { ...uses, current } }
  })
}
