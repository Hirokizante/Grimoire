/**
 * Custom attributes — the user-created stats a player adds to their own sheet.
 *
 * A custom attribute is a named number that lives on the sheet beside the five
 * Divergence Attributes (see {@link CustomAttribute}). Unlike MAR/POW/… it
 * drives nothing derived: its whole purpose is to be **referenced in dice
 * notation**. `2d6+FOO` resolves FOO from the sheet's own custom attributes,
 * matching either the attribute's shorthand ("MAR" for Martial) or its full
 * name, so a homebrew stat can be rolled exactly like a built-in one.
 *
 * Everything the feature needs to agree on — what counts as a usable stored
 * attribute, which names the dice highlighter must recognize, and how a name
 * resolves to a value — is defined here so the sheet, the parser, and the
 * roller cannot drift apart.
 */

import { generateId } from '@/constants/gameData'
import type { CustomAttribute } from '@/types'

/**
 * Bounds a stepper can walk an attribute's value to.
 *
 * Custom attributes are free-form (a "Doom Counter" may legitimately climb into
 * the dozens) so this is deliberately generous — it exists to keep a stuck key
 * or a hand-edited export from parking the sheet on `Infinity`, not to model a
 * rule. Typing a value in the modal is not clamped to it.
 */
export const MIN_CUSTOM_ATTRIBUTE_VALUE = -999
export const MAX_CUSTOM_ATTRIBUTE_VALUE = 999

/** Clamp a value into the steppable range as a whole number. */
export function clampCustomAttributeValue(value: number): number {
  const rounded = Math.round(value)
  return Math.min(
    MAX_CUSTOM_ATTRIBUTE_VALUE,
    Math.max(MIN_CUSTOM_ATTRIBUTE_VALUE, rounded),
  )
}

/**
 * Sanitize a stored/imported custom-attribute list.
 *
 * Follows the project's backfill-on-read migration pattern (see
 * `normalizeCharacter` in lib/db.ts): unknown shapes are dropped rather than
 * trusted, so downstream code never sees a nameless block, a NaN value, or a
 * missing `showSteppers` flag. An entry is kept only when it has a usable name
 * — an attribute nobody can reference in notation is not an attribute.
 */
export function normalizeCustomAttributes(raw: unknown): CustomAttribute[] {
  if (!Array.isArray(raw)) return []
  const attributes: CustomAttribute[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    if (!name) continue
    const value =
      typeof e.value === 'number' && Number.isFinite(e.value)
        ? Math.round(e.value)
        : 0
    attributes.push({
      id: typeof e.id === 'string' && e.id ? e.id : generateId(),
      name,
      value,
      shorthand: typeof e.shorthand === 'string' ? e.shorthand.trim() : '',
      showSteppers: e.showSteppers === true,
    })
  }
  return attributes
}

/**
 * Every name dice notation may use to reference this character's custom
 * attributes: each shorthand first (it is the intended token), then the full
 * name.
 *
 * Handed to the parser's custom-aware notation matcher, which needs the
 * character's own vocabulary to recognize `2d6+Martial Arts` as one variable
 * and to stop at `2d6+FOO` in `2d6+FOO damage` instead of swallowing the prose.
 */
export function customAttributeVariableNames(
  attributes: readonly CustomAttribute[] | null | undefined,
): string[] {
  if (!attributes || attributes.length === 0) return []
  const names: string[] = []
  for (const attribute of attributes) {
    const shorthand = attribute.shorthand.trim()
    if (shorthand) names.push(shorthand)
    const name = attribute.name.trim()
    if (name) names.push(name)
  }
  return names
}

/**
 * Resolve a variable name from dice notation to a custom attribute.
 *
 * The shorthand is matched first (it is the token players write), then the full
 * name; both case-insensitively. Returns null when the character has no such
 * custom attribute.
 *
 * Callers check the built-in Attributes and Skills BEFORE this, so a custom
 * attribute can never shadow a canonical stat.
 */
export function findCustomAttribute(
  attributes: readonly CustomAttribute[] | null | undefined,
  name: string,
): CustomAttribute | null {
  if (!attributes || attributes.length === 0) return null
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  const byShorthand = attributes.find(
    (a) => a.shorthand.trim().toLowerCase() === needle,
  )
  if (byShorthand) return byShorthand
  return attributes.find((a) => a.name.trim().toLowerCase() === needle) ?? null
}
