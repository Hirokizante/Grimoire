/**
 * Shared helpers for GM Screen panels.
 *
 * These live outside the components so the list pages (delete confirmations)
 * and the GM Screen page itself describe screen references identically.
 */

import { withInstanceAbilityModifiers } from '@/lib/abilityModifiers'
import { withInstanceAbilityUses } from '@/lib/abilityUses'
import type { Character, NpcInstanceState, ScreenPanel } from '@/types'
import type { DamageResult } from '@/store/characterStore'

/**
 * Apply an NPC instance's own live ability state to its base record: remaining
 * uses first, then the modifier switches.
 *
 * This is the **one** definition of "the entity behind an instance" — the
 * expanded panel renders it, and `gmScreenStore` reads the instance's effective
 * Max HP and Armor from it — so a panel's body, its chrome and its damage
 * pipeline can never disagree about what an instance's switches do. Both
 * projections are deltas: each returns the base reference while the instance
 * matches it and rebuilds only what actually differs, so nothing is copied and
 * the base record is never written to.
 */
export function withInstanceState(
  base: Character,
  state: NpcInstanceState,
): Character {
  return withInstanceAbilityModifiers(
    withInstanceAbilityUses(base, state.abilityUses),
    state.abilityModifiers,
  )
}

/**
 * One-line outcome of damage applied to a GM panel target, for its toast and
 * its Damage dialog.
 *
 * Both panel kinds run the same damage pipeline and both resolve their Mortal
 * Wounds inside it, so the sentence is written once here: a target taken out of
 * the fight, a target that took a wound (HP reset to max), or a plain hit.
 * Only the word for "out of the fight" differs — an NPC instance is **downed**,
 * a player character is **knocked out** and starts Death Saves — so the caller
 * passes it (`takenOutLabel`) rather than each panel growing its own wording.
 */
export function panelDamageOutcome(
  label: string,
  result: DamageResult,
  /** Word for a target this damage took out of the fight ("DOWNED", "KNOCKED OUT"). */
  takenOutLabel: string,
): string {
  const rolled = (result.mortalWoundRolls ?? [])
    .map((wound) => `${wound.name} (d20 ${wound.roll})`)
    .join(', ')
  if (result.downed || result.knockedOut) {
    return rolled
      ? `${label} is ${takenOutLabel}! ${rolled} — no Mortal Wounds left.`
      : `${label} is ${takenOutLabel}!`
  }
  if (rolled) {
    return `${label} takes a Mortal Wound: ${rolled} — HP reset to ${result.finalHP}.`
  }
  return `Applied ${result.hpLost} damage to ${label}.`
}

/**
 * One-line warning for a delete confirmation: which GM screens reference the
 * record about to be deleted. Returns `undefined` when nothing references it,
 * so callers can omit the line entirely.
 *
 * Deletion always proceeds — the referencing panels simply render as
 * placeholders afterwards (no cascade, no orphan cleanup).
 */
export function screenReferenceNote(
  referencingScreenNames: string[],
): string | undefined {
  if (referencingScreenNames.length === 0) return undefined
  const list = referencingScreenNames.join(', ')
  return `Referenced on GM screen${referencingScreenNames.length === 1 ? '' : 's'}: ${list}`
}

/**
 * Display fields for one GM Screen panel, resolved against the live character
 * list. `missing` marks a panel whose referenced record was deleted — the
 * panel then renders as a placeholder. This state is derived at render time,
 * never stored.
 */
export interface ResolvedPanel {
  panel: ScreenPanel
  /** The referenced record: the player character, or the NPC base. */
  entity: Character | null
  /** True when the referenced record no longer exists. */
  missing: boolean
  /**
   * Name shown on the panel: the instance label for NPC instances, the
   * character's name otherwise.
   */
  displayName: string
  /**
   * Secondary line: the base NPC's name for an instance whose label differs
   * from it ("Bandit 2" over "Bandit"), otherwise null.
   */
  subtitle: string | null
}

/** Resolve every panel of a screen against the character list. */
export function resolvePanels(
  panels: ScreenPanel[],
  characters: Character[],
): ResolvedPanel[] {
  const byId = new Map(characters.map((c) => [c.id, c]))
  return panels.map((panel) => {
    if (panel.kind === 'character') {
      const entity = byId.get(panel.characterId) ?? null
      return {
        panel,
        entity,
        missing: entity === null,
        displayName: entity?.name ?? 'Missing character',
        subtitle: null,
      }
    }
    const base = byId.get(panel.baseNpcId) ?? null
    return {
      panel,
      entity: base,
      missing: base === null,
      displayName: panel.label || base?.name || 'NPC',
      subtitle: base && panel.label && panel.label !== base.name ? base.name : null,
    }
  })
}

/**
 * Split an ordered panel list into `columnCount` vertical columns, keeping
 * the array order flowing down each column (then across), the way the GM
 * Screen lays panels out at desktop widths.
 */
export function distributeIntoColumns<T>(items: T[], columnCount: number): T[][] {
  const count = Math.max(1, columnCount)
  const columns: T[][] = Array.from({ length: count }, () => [])
  const perColumn = Math.ceil(items.length / count)
  items.forEach((item, index) => {
    // Guard against the last column overflowing when perColumn is 0.
    const column = perColumn === 0 ? 0 : Math.min(count - 1, Math.floor(index / perColumn))
    columns[column].push(item)
  })
  return columns
}
