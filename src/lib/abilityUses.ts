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
 * field — and every mutation below mirrors the sheet-tree walk used by
 * lib/abilityModifiers.ts's setAbilityModifiersActive, so an ability is found
 * no matter where on the sheet it lives.
 *
 * Sub-Abilities may be limited too (they carry the same editor and their own
 * Activate button, see SubAbilityBlock), so every helper recurses into both
 * nesting points.
 */

import { forEachAbility } from '@/lib/abilityModifiers'
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
 * Map every AbilityBlock on the character — core, slotted, pool, custom-tab
 * sections, and nested Sub-Abilities — through `mapper`. Maps are rebuilt only
 * along the path that actually changed, so an untouched branch keeps its
 * reference (and its components skip re-rendering). The character itself is
 * returned unchanged when nothing matched, so a caller can use identity to
 * detect a no-op.
 */
export function mapAbilities(
  character: Character,
  mapper: (ability: AbilityBlock) => AbilityBlock,
): Character {
  let touched = false

  const apply = (ability: AbilityBlock): AbilityBlock => {
    let changed = false

    const subsUnderDescription = (ability.subAbilitiesUnderDescription ?? []).map(
      (sub) => {
        const mapped = apply(sub)
        if (mapped !== sub) changed = true
        return mapped
      },
    )
    const subsUnderOvercharge = (ability.subAbilitiesUnderOvercharge ?? []).map(
      (sub) => {
        const mapped = apply(sub)
        if (mapped !== sub) changed = true
        return mapped
      },
    )

    const self = mapper(ability)
    if (self !== ability) changed = true
    if (!changed) return ability

    touched = true
    return {
      ...self,
      subAbilitiesUnderDescription: subsUnderDescription,
      subAbilitiesUnderOvercharge: subsUnderOvercharge,
    }
  }

  const mapList = (
    list: AbilityBlock[] | undefined,
    fn: (ability: AbilityBlock) => AbilityBlock,
  ): AbilityBlock[] | undefined => {
    if (!list || list.length === 0) return list
    let changed = false
    const next = list.map((item) => {
      const mapped = fn(item)
      if (mapped !== item) changed = true
      return mapped
    })
    return changed ? next : list
  }

  const next: Character = { ...character }

  const innateAbilities = mapList(character.innateAbilities, apply)
  if (innateAbilities !== character.innateAbilities) {
    next.innateAbilities = innateAbilities ?? []
  }
  const slottedAbilities = mapList(character.slottedAbilities, apply)
  if (slottedAbilities !== character.slottedAbilities) {
    next.slottedAbilities = slottedAbilities ?? []
  }
  const abilityPool = mapList(character.abilityPool, apply)
  if (abilityPool !== character.abilityPool) {
    next.abilityPool = abilityPool ?? []
  }

  const tabs = character.customTabs
  if (tabs && tabs.length > 0) {
    let tabsChanged = false
    const customTabs = tabs.map((tab) => {
      let tabChanged = false
      const sections = (tab.sections ?? []).map((section) => {
        if (section.kind !== 'ability') return section
        const abilities = mapList(section.abilities, apply)
        if (abilities === section.abilities) return section
        tabChanged = true
        return { ...section, abilities: abilities ?? [] }
      })
      if (!tabChanged) return tab
      tabsChanged = true
      return { ...tab, sections }
    })
    if (tabsChanged) next.customTabs = customTabs
  }

  if (character.basicAttack) next.basicAttack = apply(character.basicAttack)
  if (character.fatebreaker) next.fatebreaker = apply(character.fatebreaker)

  return touched ? next : character
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
  let target: AbilityBlock | null = null
  forEachAbility(character, (ability) => {
    if (target) return
    if (ability.id === abilityId) target = ability
  })

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
