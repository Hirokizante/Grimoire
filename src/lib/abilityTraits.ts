/**
 * abilityTraits — one reusable parser for the free-form Trait tags on an
 * AbilityBlock.
 *
 * Traits are stored as plain strings ("Recharge (5)", "Multi-Hit(2)", "Action")
 * so authors keep full creative freedom (see `types/ability.ts`). Anything that
 * needs to *read* a trait — Recharge cooldowns today, Cooldown / Multi-Hit /
 * Reliable tomorrow — must not grow its own regex: it asks this module for a
 * structured {@link ParsedAbilityTrait} instead.
 *
 * The accepted shape is `Name` or `Name (Value)`. The parentheses are optional,
 * the space before them is optional (the SRD itself writes "Multi-Hit(2)"),
 * matching is case-insensitive, and the value may be numeric ("Recharge (4)")
 * or free text ("Status (Quick)"). `value` carries the numeric reading when one
 * exists, `text` the raw parenthetical content.
 *
 * `ABILITY_TRAITS` is the registry of traits the app knows about; it is the one
 * place a new trait is declared (key, canonical name, whether it takes a
 * value), and lookups accept the key *or* the name so call sites read well:
 *
 *   const recharge = abilityTraitValue(ability.traits, ABILITY_TRAITS.recharge.key)
 */

/** A trait the app knows how to read, registered in {@link ABILITY_TRAITS}. */
export interface AbilityTraitDefinition {
  /** Stable key used by code (`ABILITY_TRAITS.recharge.key`). */
  key: string
  /** Canonical display name. Matching is case-insensitive. */
  name: string
  /** True when the trait is written with a parenthetical value: `Name (X)`. */
  valued: boolean
  /** One-line rules summary (used by tooltips and documentation). */
  summary: string
}

/**
 * Every trait the app understands, keyed for code use. Registering a trait here
 * is what makes {@link parseAbilityTrait} report its canonical name/key; the
 * parser itself is name-agnostic and happily parses unregistered traits too.
 */
export const ABILITY_TRAITS = {
  recharge: {
    key: 'recharge',
    name: 'Recharge',
    valued: true,
    summary:
      'After use the ability is unavailable until its owner’s next turn, where a Recharge Die roll of this value or higher brings it back.',
  },
  cooldown: {
    key: 'cooldown',
    name: 'Cooldown',
    valued: true,
    summary:
      'After use the ability cannot be activated again for this many full rounds.',
  },
  reliable: {
    key: 'reliable',
    name: 'Reliable',
    valued: true,
    summary:
      'The ability always deals this much damage, even when the attack roll misses.',
  },
  multiHit: {
    key: 'multi-hit',
    name: 'Multi-Hit',
    valued: true,
    summary: 'The ability rolls its attacking die this many times.',
  },
  armorBreaking: {
    key: 'armor-breaking',
    name: 'Armor-Breaking',
    valued: false,
    summary: 'The ability bypasses Armor mitigation.',
  },
  explosive: {
    key: 'explosive',
    name: 'Explosive',
    valued: false,
    summary:
      'The ability bypasses Evasion; targets instead make a save to gain Resistance.',
  },
} as const satisfies Record<string, AbilityTraitDefinition>

/** Key of a registered trait (`'recharge' | 'cooldown' | …`). */
export type AbilityTraitKey = keyof typeof ABILITY_TRAITS

/** The registered traits as a list, in declaration order. */
export const ABILITY_TRAIT_LIST: AbilityTraitDefinition[] = Object.values(
  ABILITY_TRAITS,
)

/** One parsed trait tag. */
export interface ParsedAbilityTrait {
  /** Registry key when the name matches a known trait, else null. */
  key: string | null
  /** Canonical name for a registered trait, else the name as authored. */
  name: string
  /** Parenthetical content as authored ("4", "Quick"), or null when absent. */
  text: string | null
  /** Numeric reading of {@link text} ("4" → 4), or null when not a number. */
  value: number | null
  /** The original trait string, untouched (useful for diagnostics). */
  raw: string
}

/** `Name`, `Name (Value)` — the parentheses are optional and may hug the name. */
const TRAIT_PATTERN = /^([^()]+?)\s*(?:\(\s*([^()]*?)\s*\))?$/

/** Lookup table over both a trait's key and its lower-cased name. */
const TRAIT_BY_ALIAS = new Map<string, AbilityTraitDefinition>()
for (const definition of ABILITY_TRAIT_LIST) {
  TRAIT_BY_ALIAS.set(definition.key.toLowerCase(), definition)
  TRAIT_BY_ALIAS.set(definition.name.toLowerCase(), definition)
}

/** The registered definition for a trait key or name, or null when unknown. */
export function findAbilityTraitDefinition(
  nameOrKey: string,
): AbilityTraitDefinition | null {
  if (typeof nameOrKey !== 'string') return null
  return TRAIT_BY_ALIAS.get(nameOrKey.trim().toLowerCase()) ?? null
}

/** The numeric reading of a parenthetical value, or null when it isn't one. */
function traitNumber(text: string | null): number | null {
  if (text == null || text === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/**
 * Parse one authored trait string.
 *
 * Returns null for empty/blank input; every other string parses (an
 * unrecognized shape simply yields no `key`/`value`). Callers that just want a
 * value should use {@link abilityTraitValue}.
 */
export function parseAbilityTrait(raw: string): ParsedAbilityTrait | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const match = TRAIT_PATTERN.exec(trimmed)
  if (!match) {
    // Unbalanced parentheses and similar typos: keep the authored text as the
    // name so a caller can still show it, but claim nothing about a value.
    return { key: null, name: trimmed, text: null, value: null, raw }
  }

  const authoredName = match[1].trim()
  if (!authoredName) return null

  const text = match[2]?.trim() ?? null
  const definition = findAbilityTraitDefinition(authoredName)

  return {
    key: definition?.key ?? null,
    name: definition?.name ?? authoredName,
    text,
    value: traitNumber(text),
    raw,
  }
}

/** Parse every trait on an ability, dropping blanks and unparseable entries. */
export function parseAbilityTraits(
  traits: readonly string[] | null | undefined,
): ParsedAbilityTrait[] {
  if (!Array.isArray(traits)) return []
  const parsed: ParsedAbilityTrait[] = []
  for (const trait of traits) {
    const result = parseAbilityTrait(trait)
    if (result) parsed.push(result)
  }
  return parsed
}

/** True when a trait's name or key matches the queried trait (case-insensitive). */
function traitMatches(
  parsed: ParsedAbilityTrait,
  definition: AbilityTraitDefinition | null,
  query: string,
): boolean {
  if (definition) {
    return (
      parsed.key === definition.key ||
      parsed.name.toLowerCase() === definition.name.toLowerCase()
    )
  }
  return parsed.name.toLowerCase() === query
}

/** Every trait on the ability matching a trait key or name, in authored order. */
export function findAbilityTraits(
  traits: readonly string[] | null | undefined,
  nameOrKey: string,
): ParsedAbilityTrait[] {
  if (typeof nameOrKey !== 'string' || !nameOrKey.trim()) return []
  const query = nameOrKey.trim().toLowerCase()
  const definition = findAbilityTraitDefinition(query)
  return parseAbilityTraits(traits).filter((parsed) =>
    traitMatches(parsed, definition, query),
  )
}

/** The first trait on the ability matching a trait key or name, or null. */
export function findAbilityTrait(
  traits: readonly string[] | null | undefined,
  nameOrKey: string,
): ParsedAbilityTrait | null {
  return findAbilityTraits(traits, nameOrKey)[0] ?? null
}

/** Whether the ability carries the trait at all. */
export function hasAbilityTrait(
  traits: readonly string[] | null | undefined,
  nameOrKey: string,
): boolean {
  return findAbilityTrait(traits, nameOrKey) != null
}

/**
 * The value of the named trait (`Recharge (4)` → 4), or null when the trait is
 * absent or carries no number.
 */
export function abilityTraitValue(
  traits: readonly string[] | null | undefined,
  nameOrKey: string,
): number | null {
  return findAbilityTrait(traits, nameOrKey)?.value ?? null
}
