/**
 * GM Screen domain types.
 *
 * A GM Screen is a saved, named, ordered list of **panels**. A panel is either
 * a live reference to a player `Character` (one source of truth — edits made
 * from the screen are the same state the player sees on their own sheet) or an
 * **NPC instance** spawned from an NPC base record.
 *
 * Design principle: **instances are deltas, not clones.** We never duplicate
 * the NPC record. An instance owns only its live-play state (HP, temp HP,
 * condition) and a display label; stats, abilities, portrait and description
 * are read from the base at render time. That keeps storage tiny, guarantees
 * base edits propagate to every instance, and avoids the "which Bandit is the
 * real one?" problem. The NPC list page continues to show only bases.
 */

import type { MortalWoundRoll } from './character'

/**
 * Live state that belongs to ONE spawned instance of an NPC base.
 *
 * NPCs have no death saves. Reaching 0 HP rolls on the Mortal Wounds table
 * while the base still allows a wound (see {@link NpcInstanceState.mortalWounds});
 * once the instance can take no more, damage to 0 sets `downed` automatically.
 * `dead` is a GM-set flag applied from the panel menu.
 *
 * The instance also owns its **live play** resources: Action Points (3 per
 * turn, exactly like a player's sheet), the Recharge cooldowns of its
 * abilities, and its Mortal Wound track. All of them live here rather than on
 * the base record because they are per-instance: three spawned Bandits each
 * spend their own AP and bleed their own wounds, and nothing a GM does at the
 * table may leak into the standalone NPC sheet, which stays a static reference.
 */
export interface NpcInstanceState {
  /** Current HP. Spawned at the base's `npcStats.hp`. */
  currentHP: number
  /** Temporary HP (same semantics as characters: absorbs first, strongest wins). */
  tempHP: number
  /**
   * Combat condition. `downed` is set automatically when damage drives
   * currentHP to 0 and the instance has no Mortal Wound left to take; `dead` is
   * a GM-set flag.
   */
  condition: 'active' | 'downed' | 'dead'
  /**
   * Action Points left this turn. Spawned at `MAX_AP` (3) and reset to it by
   * "Start new turn"; activating an ability through the panel spends it.
   */
  currentAP: number
  /**
   * Ids of the base record's abilities currently on **Recharge** cooldown, in
   * the order they were used. Read against the base's traits at roll time (see
   * lib/abilityRecharge.ts): the start of the instance's next turn rolls one
   * Recharge Die and clears every id whose value is ≤ the roll, so a stored id
   * whose ability was deleted or lost its trait is dropped rather than kept
   * cooling forever.
   */
  cooldowns: string[]
  /**
   * Remaining uses of the base record's **limited abilities**, keyed by ability
   * id — the instance's own budget, never the base's.
   *
   * Spawned empty, and deliberately a **delta**: an ability with no entry reads
   * as its authored `max` (`withInstanceAbilityUses` in lib/abilityUses.ts), so
   * a fresh instance starts full, an ability added to the base later arrives
   * full, and raising a base ability's maximum raises every instance that has
   * not spent into it. Only a count the GM has actually moved on this panel is
   * stored, and it is clamped to the base's current `max` at render time.
   * Three spawned Bandits therefore each spend their own uses, and nothing the
   * GM does at the table can reach the standalone NPC sheet.
   */
  abilityUses: Record<string, number>
  /**
   * Which of the base record's abilities currently have their **stat/attribute
   * modifiers switched on** for this instance, keyed by ability id.
   *
   * The same delta rule as {@link abilityUses}: an ability with no entry reads
   * as its own `modifiersActive` flag (`withInstanceAbilityModifiers` in
   * lib/abilityModifiers.ts), which a base record only ever carries as template
   * data — so a fresh instance starts matching its base sheet and records only
   * the switches the GM has actually flipped here. Three spawned Bandits can
   * therefore rage independently, the panel's effective stats (Evasion, Armor,
   * Movement, Save DC, Max HP, Attributes, and the dice they feed) follow the
   * instance's own switches, and nothing the GM does at the table reaches the
   * standalone NPC sheet.
   */
  abilityModifiers: Record<string, boolean>
  /**
   * Mortal Wounds this instance has sustained, in the order they were rolled.
   *
   * The instance's **allowance** is the base's `npcStats.mortalWounds` (read at
   * damage/render time like every other base stat — never copied onto the
   * instance): at 0 HP the store rolls a D20 on the Mortal Wounds table, resets
   * HP to max with the excess spilling over, and appends the wound here. A base
   * with `mortalWounds: 0` never rolls and simply goes `downed` at 0 HP; an
   * instance whose track is full (or whose base allows none) does the same.
   * Wounds persist until cleared from the panel or a Rest — healing does not
   * erase them.
   */
  mortalWounds: MortalWoundRoll[]
}

/** How much detail a panel renders: a glance-height card, or the full sheet. */
export type ScreenPanelDensity = 'compact' | 'expanded'

/**
 * How long a tracked status lasts, per the SRD's duration taxonomy: Quick
 * (until the end of the next turn), Persistent (save at the end of the turn),
 * Countdown (N rounds), Permanent (until the conflict ends), Conditional
 * (while its condition holds).
 *
 * The GM Screen deliberately runs **no timers** — the duration is a label the
 * GM reads (and, for a Countdown, ticks down by adjusting stacks).
 */
export type PanelStatusDuration =
  | 'quick'
  | 'persistent'
  | 'countdown'
  | 'permanent'
  | 'conditional'

/**
 * One status the GM is tracking on one panel.
 *
 * This is **GM Screen state only**: it lives on the `ScreenPanel` and never
 * reaches the character sheet, so a player's own sheet never shows conditions
 * the GM is tracking for it. The compendium record is referenced by id and its
 * name/icon are read at render time — no copy is stored, so renames propagate
 * and deleting a status leaves a clearly-marked placeholder pill rather than
 * stale data.
 */
export interface PanelStatus {
  /** Referenced `StatusCondition.id`. */
  statusId: string
  /** Duration label (see {@link PanelStatusDuration}). */
  duration: PanelStatusDuration
  /** Stack count; always >= 1 — removing a status is its own action. */
  stacks: number
}

/** Fields every panel carries, whatever kind of sheet it references. */
interface ScreenPanelBase {
  /** Panel id (stable across reorders). */
  id: string
  density: ScreenPanelDensity
  /**
   * Statuses the GM is tracking on this panel, in the order they were added.
   * Never written to the referenced character/NPC record.
   */
  statuses: PanelStatus[]
}

/**
 * A character panel references a player `Character` by id; an NPC-instance
 * panel references an NPC base record and carries its own live state.
 */
export type ScreenPanel =
  | (ScreenPanelBase & {
      kind: 'character'
      /** Reference to a player Character record. */
      characterId: string
    })
  | (ScreenPanelBase & {
      kind: 'npc-instance'
      /** Reference to the NPC template record. */
      baseNpcId: string
      /** Display name; defaults to the base name, disambiguated ("Bandit 2"). */
      label: string
      state: NpcInstanceState
    })


/** A saved GM Screen: a named, ordered list of panels. */
export interface GMScreen {
  id: string
  name: string
  /** Display order of the panels = array order. */
  panels: ScreenPanel[]
  createdAt: string
  updatedAt: string
}
