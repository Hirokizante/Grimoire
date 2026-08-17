/**
 * Status-reference parsing and detection helpers.
 *
 * Ability descriptions reference status conditions by name inside square
 * brackets, e.g. "inflicts [Poisoned]". These helpers:
 *   - find inline `[name]` references for clickable highlighting
 *   - enumerate every status name a character sheet references
 *   - map statuses to the sheets that reference them (for the compendium tags)
 *   - collect the status records a sheet references (for export bundling)
 */

import type { AbilityBlock, Character, StatusCondition } from '@/types'

/** A single `[name]` reference found in a body of text. */
export interface StatusRefMatch {
  /** Inner name between the brackets, trimmed. */
  name: string
  /** Index of the opening bracket. */
  start: number
  /** Index just past the closing bracket. */
  end: number
}

const STATUS_REFERENCE_REGEX = /\[([^\]]+)\]/g

/** Cheap pre-check: does this string contain any `[...]` at all? */
export function hasStatusCandidate(text: string): boolean {
  return text.length > 0 && text.includes('[') && text.includes(']')
}

/** Find every `[name]` reference in a string with its character offsets. */
export function findStatusReferences(text: string): StatusRefMatch[] {
  if (!text) return []
  const results: StatusRefMatch[] = []
  STATUS_REFERENCE_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = STATUS_REFERENCE_REGEX.exec(text)) !== null) {
    const name = m[1].trim()
    if (name) results.push({ name, start: m.index, end: m.index + m[0].length })
  }
  return results
}

/** Resolve a status by name (case-insensitive), or null if not found. */
export function statusByName(
  statuses: StatusCondition[],
  name: string,
): StatusCondition | null {
  const target = name.trim().toLowerCase()
  if (!target) return null
  return statuses.find((s) => s.name.trim().toLowerCase() === target) ?? null
}

/** Add every `[name]` found in `text` to `into` (lowercased, deduped). */
function collectNamesFromText(text: string, into: Set<string>): void {
  if (!text) return
  for (const ref of findStatusReferences(text)) {
    into.add(ref.name.toLowerCase())
  }
}

/** Add every status name referenced inside an AbilityBlock's prose fields. */
function collectNamesFromBlock(block: AbilityBlock, into: Set<string>): void {
  collectNamesFromText(block.description, into)
  collectNamesFromText(block.overcharge, into)
  collectNamesFromText(block.flavorText, into)
}

/**
 * Enumerate every unique status name (lowercased) referenced by a character
 * sheet — across innate description, all ability blocks (innate, basic attack,
 * fatebreaker, slotted, pool), and custom-tab ability/text sections.
 */
export function collectCharacterStatusNames(character: Character): string[] {
  const names = new Set<string>()

  collectNamesFromText(character.innateDescription, names)
  for (const block of character.innateAbilities) {
    collectNamesFromBlock(block, names)
  }
  collectNamesFromBlock(character.basicAttack, names)
  collectNamesFromBlock(character.fatebreaker, names)
  for (const block of character.slottedAbilities) {
    collectNamesFromBlock(block, names)
  }
  for (const block of character.abilityPool) {
    collectNamesFromBlock(block, names)
  }
  for (const tab of character.customTabs) {
    for (const section of tab.sections) {
      if (section.kind === 'ability') {
        for (const block of section.abilities) {
          collectNamesFromBlock(block, names)
        }
      } else if (section.kind === 'text') {
        collectNamesFromText(section.content, names)
      }
    }
  }

  return Array.from(names)
}

/** Whether a character sheet references the given status name. */
export function statusReferencedInCharacter(
  character: Character,
  statusName: string,
): boolean {
  const target = statusName.trim().toLowerCase()
  if (!target) return false
  return collectCharacterStatusNames(character).includes(target)
}

/** Return the statuses (from `allStatuses`) referenced by a character sheet. */
export function collectReferencedStatuses(
  character: Character,
  allStatuses: StatusCondition[],
): StatusCondition[] {
  const names = new Set(collectCharacterStatusNames(character))
  return allStatuses.filter((s) => names.has(s.name.trim().toLowerCase()))
}

/** Return the sheets (characters) that reference the given status name. */
export function referencingCharacters(
  statusName: string,
  characters: Character[],
): Character[] {
  return characters.filter((c) => statusReferencedInCharacter(c, statusName))
}
