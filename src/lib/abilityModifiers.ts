/**
 * Ability stat/attribute modifiers.
 *
 * An Ability can carry a list of signed modifiers to the sheet's Attributes
 * (MAR, POW, AGI, VIT, GRT) and derived combat stats (Evasion, Armor,
 * Movement, Save DC, END Recovery, Max HP). Each modifier is applied only
 * while the Ability's modifier switch is ON — a per-card toggle in view mode
 * that is completely independent from the Activate button and never costs
 * resources.
 *
 * The character's stored Attributes / NPC stats are NEVER mutated by a
 * modifier. Instead every consumer asks this module for the *effective*
 * values, which layer the active modifiers on top of the base values:
 *
 *   effective attribute = base attribute + Σ active attribute modifiers
 *   effective stat      = formula(effective attributes) + Σ active stat modifiers
 *
 * So switching a modifier off (or deleting the Ability) instantly restores the
 * sheet to its unmodified values.
 *
 * **NPC instances are the exception.** A base NPC record is a static reference
 * — the GM Screen spawns instances *from* it — so its own switches are template
 * data shown read-only on the base sheet, and each instance keeps its own
 * (`NpcInstanceState.abilityModifiers`, projected back onto the base by
 * {@link withInstanceAbilityModifiers}). See the "NPC instances" section at the
 * bottom of this file.
 */

import { ATTRIBUTE_LIST } from '@/constants/gameData'
import {
  calcArmor,
  calcENDRecovery,
  calcEvasion,
  calcHP,
  calcMovement,
  calcSaveDC,
} from '@/lib/calculations'
import type {
  AbilityBlock,
  AbilityStatModifier,
  Attributes,
  Character,
  ModifierTarget,
  NPCStats,
} from '@/types'

/** Metadata describing one modifiable target. */
export interface ModifierTargetMeta {
  /** The target key stored on the modifier. */
  target: ModifierTarget
  /** Compact label rendered on ability cards (e.g. "Evasion", "MAR"). */
  label: string
  /** Descriptive label used in the editor's target picker. */
  menuLabel: string
  /** Attributes sit above the derived combat stats in pickers. */
  group: 'attribute' | 'stat'
  /** Whether NPC abilities may target it (NPCs have no END Recovery). */
  npc: boolean
}

/**
 * Every modifiable target, in picker order: the derived combat stats first,
 * then the five Attributes (which are the rarer, weightier choice — changing
 * an Attribute also moves everything derived from it).
 */
export const MODIFIER_TARGETS: ModifierTargetMeta[] = [
  { target: 'evasion', label: 'Evasion', menuLabel: 'Evasion', group: 'stat', npc: true },
  { target: 'armor', label: 'Armor', menuLabel: 'Armor', group: 'stat', npc: true },
  { target: 'movement', label: 'Movement', menuLabel: 'Movement', group: 'stat', npc: true },
  { target: 'saveDC', label: 'Save DC', menuLabel: 'Save DC', group: 'stat', npc: true },
  { target: 'maxHP', label: 'Max HP', menuLabel: 'Max HP', group: 'stat', npc: true },
  { target: 'endRecovery', label: 'END Recovery', menuLabel: 'END Recovery', group: 'stat', npc: false },
  ...ATTRIBUTE_LIST.map<ModifierTargetMeta>((attr) => ({
    target: attr.key,
    label: attr.abbreviation,
    menuLabel: `${attr.name} (${attr.abbreviation})`,
    group: 'attribute',
    npc: true,
  })),
]

const TARGET_BY_KEY = new Map<ModifierTarget, ModifierTargetMeta>(
  MODIFIER_TARGETS.map((t) => [t.target, t]),
)

/** Every valid modifier target key. */
const TARGET_KEYS = new Set<string>(MODIFIER_TARGETS.map((t) => t.target))

/** Whether a value is a valid modifier target. */
export function isModifierTarget(value: unknown): value is ModifierTarget {
  return typeof value === 'string' && TARGET_KEYS.has(value)
}

/** Compact display label for a target (e.g. "Evasion", "MAR"). */
export function modifierTargetLabel(target: ModifierTarget): string {
  return TARGET_BY_KEY.get(target)?.label ?? target
}

/** Descriptive label for a target, for the editor's picker. */
export function modifierTargetMenuLabel(target: ModifierTarget): string {
  return TARGET_BY_KEY.get(target)?.menuLabel ?? target
}

/**
 * The targets an ability on the given character kind may modify. NPC sheets
 * have no END Recovery pool, so that target is hidden for them.
 */
export function modifierTargetsFor(
  kind: Character['kind'] | undefined,
): ModifierTargetMeta[] {
  if (kind === 'npc') return MODIFIER_TARGETS.filter((t) => t.npc)
  return MODIFIER_TARGETS
}

/**
 * Validate an untrusted modifier list (hand-edited exports, older records):
 * keeps only known targets with finite, non-zero values. Duplicate targets are
 * merged so the same value can never be applied twice by one ability.
 */
export function normalizeModifiers(raw: unknown): AbilityStatModifier[] {
  if (!Array.isArray(raw)) return []
  const merged = new Map<ModifierTarget, number>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const { target, value } = entry as { target?: unknown; value?: unknown }
    if (!isModifierTarget(target)) continue
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || n === 0) continue
    merged.set(target, (merged.get(target) ?? 0) + n)
  }
  return MODIFIER_TARGETS.filter((t) => {
    const v = merged.get(t.target)
    return v != null && v !== 0
  }).map((t) => ({ target: t.target, value: merged.get(t.target) as number }))
}

/** The modifiers configured on an ability (never null). */
export function abilityModifiers(ability: AbilityBlock): AbilityStatModifier[] {
  return ability.modifiers ?? []
}

/** Whether the ability has any modifiers configured at all. */
export function hasAbilityModifiers(ability: AbilityBlock): boolean {
  return abilityModifiers(ability).length > 0
}

/** Whether the ability's modifiers are currently switched on. */
export function areAbilityModifiersActive(ability: AbilityBlock): boolean {
  return ability.modifiersActive === true && hasAbilityModifiers(ability)
}

/**
 * Visit every AbilityBlock on a character: the core abilities (Innate, Basic
 * Attack, Fatebreaker), slotted + pooled abilities, custom-tab ability
 * sections, and every nested Sub-Ability (both nesting points).
 */
export function forEachAbility(
  character: Character,
  visit: (ability: AbilityBlock) => void,
): void {
  const seen = new Set<string>()

  const walk = (ability: AbilityBlock) => {
    // Guard against a block appearing twice (e.g. a duplicated id from a
    // hand-merged import) so modifiers are never counted twice.
    if (ability.id && seen.has(ability.id)) return
    if (ability.id) seen.add(ability.id)
    visit(ability)
    for (const sub of ability.subAbilitiesUnderDescription ?? []) walk(sub)
    for (const sub of ability.subAbilitiesUnderOvercharge ?? []) walk(sub)
  }

  for (const ability of character.innateAbilities ?? []) walk(ability)
  if (character.basicAttack) walk(character.basicAttack)
  if (character.fatebreaker) walk(character.fatebreaker)
  for (const ability of character.slottedAbilities ?? []) walk(ability)
  for (const ability of character.abilityPool ?? []) walk(ability)
  for (const tab of character.customTabs ?? []) {
    for (const section of tab.sections ?? []) {
      if (section.kind !== 'ability') continue
      for (const ability of section.abilities ?? []) walk(ability)
    }
  }
}

/**
 * The AbilityBlock with `id` anywhere on the character — core, slotted, pool,
 * custom-tab sections, or nested as a Sub-Ability — or null when the character
 * has no such block. Same sheet-tree walk as {@link forEachAbility}, and stops
 * at the first match (duplicate ids cannot exist on a healthy record; a
 * hand-merged import that carries one resolves to the first, which is the copy
 * {@link forEachAbility} would visit first too).
 */
export function findAbility(
  character: Character,
  abilityId: string,
): AbilityBlock | null {
  if (!abilityId) return null
  let found: AbilityBlock | null = null
  forEachAbility(character, (ability) => {
    if (found || ability.id !== abilityId) return
    found = ability
  })
  return found
}

/**
 * Map every AbilityBlock on the character — core, slotted, pool, custom-tab
 * sections, and nested Sub-Abilities — through `mapper`. Maps are rebuilt only
 * along the path that actually changed, so an untouched branch keeps its
 * reference (and its components skip re-rendering). The character itself is
 * returned unchanged when nothing matched, so a caller can use identity to
 * detect a no-op.
 *
 * The writing counterpart of {@link forEachAbility}: every `set…` helper walks
 * the tree this way, and the GM Screen's instance projections use it so an
 * untouched instance still renders the base record itself.
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

/** The summed value of every active modifier on the character, by target. */
export function collectActiveModifiers(
  character: Character,
): Partial<Record<ModifierTarget, number>> {
  const totals: Partial<Record<ModifierTarget, number>> = {}
  forEachAbility(character, (ability) => {
    if (!areAbilityModifiersActive(ability)) return
    for (const mod of abilityModifiers(ability)) {
      totals[mod.target] = (totals[mod.target] ?? 0) + mod.value
    }
  })
  return totals
}

/** The character's Attributes with all active modifiers applied. */
export function effectiveAttributes(character: Character): Attributes {
  const totals = collectActiveModifiers(character)
  const result = { ...character.attributes }
  for (const attr of ATTRIBUTE_LIST) {
    result[attr.key] = character.attributes[attr.key] + (totals[attr.key] ?? 0)
  }
  return result
}

/** The character's derived combat stats with all active modifiers applied. */
export interface EffectiveCombatStats {
  evasion: number
  armor: number
  movement: number
  saveDC: number
  /** END regained at the end of each turn. */
  endRecovery: number
  /** Maximum Hit Points. */
  maxHP: number
}

/**
 * Derived combat stats for a player character, computed from the *effective*
 * attributes (so `+1 VIT` also raises Max HP and Armor) plus any direct stat
 * modifiers. Values that cannot sensibly go negative are clamped.
 */
export function effectiveCombatStats(character: Character): EffectiveCombatStats {
  const attrs = effectiveAttributes(character)
  const totals = collectActiveModifiers(character)
  return {
    evasion: calcEvasion(attrs.AGI) + (totals.evasion ?? 0),
    armor: Math.max(0, calcArmor(attrs.VIT) + (totals.armor ?? 0)),
    movement: Math.max(0, calcMovement(attrs.AGI) + (totals.movement ?? 0)),
    saveDC: calcSaveDC(character.milestones) + (totals.saveDC ?? 0),
    endRecovery: Math.max(
      0,
      calcENDRecovery(attrs.GRT) + (totals.endRecovery ?? 0),
    ),
    maxHP: Math.max(1, calcHP(attrs.VIT) + (totals.maxHP ?? 0)),
  }
}

/** Default combat stats for an NPC that has none stored yet. */
export const DEFAULT_NPC_STATS: NPCStats = {
  evasion: 10,
  armor: 0,
  movement: 5,
  saveDC: 10,
  hp: 20,
  mortalWounds: 0,
}

/**
 * An NPC's manually-entered combat stats with all active modifiers applied.
 * `mortalWounds` is a live-play counter, not a stat, so it is never modified.
 */
export function effectiveNPCStats(npc: Character): NPCStats {
  const base: NPCStats = { ...DEFAULT_NPC_STATS, ...(npc.npcStats ?? {}) }
  const totals = collectActiveModifiers(npc)
  return {
    ...base,
    evasion: base.evasion + (totals.evasion ?? 0),
    armor: Math.max(0, base.armor + (totals.armor ?? 0)),
    movement: Math.max(0, base.movement + (totals.movement ?? 0)),
    saveDC: base.saveDC + (totals.saveDC ?? 0),
    hp: Math.max(0, base.hp + (totals.maxHP ?? 0)),
  }
}

/**
 * Switch one ability's modifiers on/off, returning a new Character. The block
 * is matched by id anywhere on the sheet (core, slotted, pool, custom tabs, or
 * nested Sub-Abilities). Unknown ids leave the character untouched.
 */
export function setAbilityModifiersActive(
  character: Character,
  abilityId: string,
  active: boolean,
): Character {
  let touched = false

  /**
   * Apply the switch to one block, recursing into its nested Sub-Abilities.
   * Returns the same reference when nothing changed, so an unrelated toggle
   * never re-renders the whole sheet.
   */
  const apply = (ability: AbilityBlock): AbilityBlock => {
    const subsUnderDescription = ability.subAbilitiesUnderDescription ?? []
    const subsUnderOvercharge = ability.subAbilitiesUnderOvercharge ?? []
    let subsChanged = false

    const nextDescription = subsUnderDescription.map((sub) => {
      const mapped = apply(sub)
      if (mapped !== sub) subsChanged = true
      return mapped
    })
    const nextOvercharge = subsUnderOvercharge.map((sub) => {
      const mapped = apply(sub)
      if (mapped !== sub) subsChanged = true
      return mapped
    })

    // Not the target: only rebuild when a nested Sub-Ability changed.
    if (ability.id !== abilityId) {
      return subsChanged
        ? {
            ...ability,
            subAbilitiesUnderDescription: nextDescription,
            subAbilitiesUnderOvercharge: nextOvercharge,
          }
        : ability
    }

    // Already in the requested state, or switching ON an ability that defines
    // no modifiers at all — a no-op.
    if ((ability.modifiersActive === true) === active) return ability
    if (active && !hasAbilityModifiers(ability)) return ability

    touched = true
    return {
      ...ability,
      modifiersActive: active,
      subAbilitiesUnderDescription: nextDescription,
      subAbilitiesUnderOvercharge: nextOvercharge,
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

  const next: Character = {
    ...character,
    innateAbilities: mapList(character.innateAbilities, apply) ?? [],
    basicAttack: apply(character.basicAttack),
    fatebreaker: apply(character.fatebreaker),
    slottedAbilities: mapList(character.slottedAbilities, apply) ?? [],
    abilityPool: mapList(character.abilityPool, apply) ?? [],
    customTabs: (character.customTabs ?? []).map((tab) => ({
      ...tab,
      sections: (tab.sections ?? []).map((section) =>
        section.kind === 'ability'
          ? { ...section, abilities: mapList(section.abilities, apply) ?? [] }
          : section,
      ),
    })),
  }

  return touched ? next : character
}

// ---- NPC instances (GM Screen) ----------------------------------------------
//
// A GM Screen NPC instance is a **delta, not a clone** (see types/gmScreen.ts):
// its abilities are the base record's, read at render time, and one of the two
// pieces of ability state it owns is which modifier switches are on for *this*
// instance (`NpcInstanceState.abilityModifiers`). The base's own
// `modifiersActive` flag is template data — the base sheet shows it read-only —
// so an absent entry means "untouched, still matching the base", and the
// helpers below read and apply the map.

/**
 * Validate/repair an instance's modifier-switch map (imports, older screens).
 * Entries whose value is not a boolean are dropped; the ability's own
 * `modifiersActive` flag is not known here (it lives on the base record), so
 * the render helper decides what an absent entry means.
 */
export function normalizeInstanceAbilityModifiers(
  raw: unknown,
): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, boolean> = {}
  for (const [abilityId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!abilityId || typeof value !== 'boolean') continue
    out[abilityId] = value
  }
  return out
}

/**
 * Whether one of an NPC instance's abilities has its modifiers on: the switch
 * the instance recorded, or the ability's own `modifiersActive` flag when the
 * instance has not touched it. An ability that declares no modifiers is never
 * active — there is nothing to apply.
 */
export function instanceAbilityModifiersActive(
  ability: AbilityBlock,
  recorded: boolean | null | undefined,
): boolean {
  if (!hasAbilityModifiers(ability)) return false
  return recorded ?? ability.modifiersActive === true
}

/**
 * The entity a GM Screen NPC panel renders: the base record with this
 * instance's own modifier switches applied to its abilities (pairs with
 * `abilityUses.withInstanceAbilityUses`, which does the same for limited-use
 * budgets — `gmScreenUtils.withInstanceState` composes both).
 *
 * A *render-time projection*, not a clone: `mapAbilities` returns the base
 * reference untouched while the instance's switches match the base's, and
 * rebuilds only the abilities that differ — which is what makes an instance's
 * Evasion/Armor/Movement/Save DC/Max HP/Attributes (and the dice rolls that
 * resolve against them) follow its own switches while base edits keep
 * propagating. Nothing here is ever written back to the base record.
 */
export function withInstanceAbilityModifiers(
  base: Character,
  recorded: Record<string, boolean> | null | undefined,
): Character {
  if (!recorded) return base
  return mapAbilities(base, (ability) => {
    if (!hasAbilityModifiers(ability)) return ability
    const active = instanceAbilityModifiersActive(ability, recorded[ability.id])
    if ((ability.modifiersActive === true) === active) return ability
    return { ...ability, modifiersActive: active }
  })
}

/** Format a signed modifier value ("+2", "−2") for display. */
export function formatModifierValue(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

/** Human-readable one-line description of a modifier ("+2 Evasion"). */
export function describeModifier(mod: AbilityStatModifier): string {
  return `${formatModifierValue(mod.value)} ${modifierTargetLabel(mod.target)}`
}
