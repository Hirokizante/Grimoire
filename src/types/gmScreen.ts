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

/**
 * Live state that belongs to ONE spawned instance of an NPC base.
 *
 * NPCs have no death saves, so `downed` is set automatically when damage drives
 * `currentHP` to 0; `dead` is a GM-set flag applied from the panel menu.
 *
 * The instance also owns its **live play** resources: Action Points (3 per
 * turn, exactly like a player's sheet) and the Recharge cooldowns of its
 * abilities. Both live here rather than on the base record because they are
 * per-instance: three spawned Bandits each spend their own AP, and nothing a GM
 * does at the table may leak into the standalone NPC sheet, which stays a static
 * reference.
 */
export interface NpcInstanceState {
  /** Current HP. Spawned at the base's `npcStats.hp`. */
  currentHP: number
  /** Temporary HP (same semantics as characters: absorbs first, strongest wins). */
  tempHP: number
  /**
   * Combat condition. `downed` is set automatically when damage drives
   * currentHP to 0 (NPCs have no death saves). `dead` is a GM-set flag.
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
