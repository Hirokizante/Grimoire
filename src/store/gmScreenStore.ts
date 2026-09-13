/**
 * GMScreenStore — Zustand store for saved GM Screens.
 *
 * A GM Screen is a named, ordered list of panels: live references to player
 * characters and/or instances spawned from NPC base records. See
 * `types/gmScreen.ts` for the data model and `.hermes/GM_SCREEN_DESIGN.md` for
 * the feature spec.
 *
 * Conventions mirror `characterStore`: mutations update in-memory state first,
 * then autosave the affected **screen** record with a 500ms per-screen
 * debounce. Only the screen record is written — a player character panel is a
 * reference, so its own live state is persisted by `characterStore`.
 */

import { create } from 'zustand'

import {
  deleteScreen as dbDeleteScreen,
  getAllScreens,
  putScreen,
} from '@/lib/db'
import { MAX_AP, generateId } from '@/constants/gameData'
import { MAX_PANEL_STATUS_STACKS } from '@/constants/statusDurations'
import {
  effectiveNPCStats,
  findAbility,
  hasAbilityModifiers,
} from '@/lib/abilityModifiers'
import {
  abilityUses,
  expendsUseOnActivate,
  instanceAbilityUsesRemaining,
} from '@/lib/abilityUses'
import { withInstanceState } from '@/lib/gmScreenUtils'
import { rollDie } from '@/lib/dice'
import { rollOnMortalWoundTable, mortalWoundByName } from '@/lib/mortalWounds'
import { resolveRecharge, rollRechargeDie, type RechargeOutcome } from '@/lib/abilityRecharge'
import { useCharacterStore } from '@/store/characterStore'
import type { DamageResult } from '@/store/characterStore'
import type { Character, GMScreen, MortalWoundRoll, NpcInstanceState, PanelStatusDuration, ScreenPanel, ScreenPanelDensity } from '@/types'

/** Debounce window for autosave (ms), matching characterStore. */
const AUTOSAVE_DEBOUNCE_MS = 500

/** localStorage key holding the last-opened screen id. */
const LAST_SCREEN_KEY = 'grimoire.lastGMScreenId'

/** Per-screen pending autosave timeouts. */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearSaveTimer(id: string) {
  const timer = saveTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    saveTimers.delete(id)
  }
}

/** Read the persisted "last opened screen" id (best-effort; storage may be unavailable). */
function readLastScreenId(): string | null {
  try {
    return localStorage.getItem(LAST_SCREEN_KEY)
  } catch {
    return null
  }
}

/** Persist the "last opened screen" id (best-effort). */
function writeLastScreenId(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_SCREEN_KEY, id)
    else localStorage.removeItem(LAST_SCREEN_KEY)
  } catch {
    // Private mode / storage disabled — the screen still works in-memory.
  }
}

/**
 * Flush every pending debounced screen write immediately.
 *
 * Autosave is debounced by 500ms; without this a page unload (reload, tab
 * close, navigation) inside that window would drop the last edits.
 * {@link installGMScreenAutosaveFlush} wires it to the unload events.
 */
export function flushPendingScreenSaves() {
  const ids = [...saveTimers.keys()]
  saveTimers.clear()
  for (const id of ids) {
    const screen = useGMScreenStore.getState().screens.find((s) => s.id === id)
    if (!screen) continue
    try {
      void putScreen(screen)
    } catch {
      // Best-effort during unload; in-memory state is already correct.
    }
  }
}

/** Wire the unload-time flush exactly once (App calls this at startup). */
let flushInstalled = false
export function installGMScreenAutosaveFlush() {
  if (flushInstalled || typeof window === 'undefined') return
  flushInstalled = true
  // `pagehide` also covers bfcache navigations on iOS, where `beforeunload`
  // and even `visibilitychange` can be skipped.
  window.addEventListener('pagehide', flushPendingScreenSaves)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingScreenSaves()
  })
}

/**
 * Plain-language message for a storage failure, falling back to a generic line
 * when the thrown value carries nothing useful (IndexedDB rejects with a
 * `DOMException` whose `message` is normally populated).
 */
function storageErrorMessage(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Could not write to this browser’s storage.'
}

/** Options for {@link GMScreenActions.damageInstance}. */
export interface InstanceDamageOptions {
  /** Apply armor reduction (1d6 per armor point from the base's `npcStats.armor`). */
  applyArmor?: boolean
  /** Resistance halves the damage (after armor). */
  resistant?: boolean
  /** Bypass the instance's temp HP. */
  ignoreTempHP?: boolean
}

export interface GMScreenState {
  /** All saved screens, oldest first. */
  screens: GMScreen[]
  /** The screen currently open on the GM Screen page, or null. */
  currentScreenId: string | null
  /** Whether the initial load from IndexedDB has completed. */
  isLoaded: boolean
  /** True while a screen write is in flight. */
  isSaving: boolean
  /**
   * Human-readable reason the last load failed, or null. When set, the page
   * shows the error plus a Retry action instead of a permanent loading state.
   */
  loadError: string | null
}

export interface GMScreenActions {
  /**
   * Load every saved screen from IndexedDB (call once at startup). Never
   * rejects: a failure sets `loadError` and still marks `isLoaded`, so the UI
   * can offer a retry instead of spinning forever.
   */
  loadScreens: () => Promise<void>
  /** Persist one screen immediately, cancelling its pending autosave. */
  saveScreen: (id: string) => Promise<void>
  /** Create a new screen (selected immediately) and return it. */
  createScreen: (name?: string) => Promise<GMScreen>
  /** Rename a screen. */
  renameScreen: (id: string, name: string) => void
  /** Delete a screen. If it was open, the next one (or none) is selected. */
  deleteScreen: (id: string) => Promise<void>
  /** Open a screen by id (persisted across reloads). */
  selectScreen: (id: string | null) => void
  /** The screen object currently open, or null. */
  currentScreen: () => GMScreen | null
  /**
   * Add a panel referencing a player character. No-op (returns false) when
   * that character already has a panel on this screen — duplicate player
   * sheets are a footgun; spawn NPC instances for multiples instead.
   */
  addCharacterPanel: (screenId: string, characterId: string) => boolean
  /**
   * Spawn a fresh NPC instance from a base record, at full HP, with an
   * auto-numbered label ("Bandit", "Bandit 2", …). Returns the panel id.
   */
  addNpcInstancePanel: (
    screenId: string,
    baseNpcId: string,
    label?: string,
  ) => string
  /** Duplicate an NPC-instance panel ("add another Bandit"). No-op for characters. */
  duplicatePanel: (screenId: string, panelId: string) => string | null
  /** Remove a panel. */
  removePanel: (screenId: string, panelId: string) => void
  /** Move a panel to a new index (wired to @dnd-kit sortable). */
  movePanel: (screenId: string, fromIndex: number, toIndex: number) => void
  /** Switch a panel between compact and expanded. */
  setPanelDensity: (
    screenId: string,
    panelId: string,
    density: ScreenPanelDensity,
  ) => void
  /**
   * Track a compendium status on a panel, or change the duration of one
   * already tracked. One entry per status per panel — re-adding an existing
   * status updates its duration in place and keeps its stack count.
   */
  setPanelStatus: (
    screenId: string,
    panelId: string,
    statusId: string,
    duration: PanelStatusDuration,
  ) => void
  /** Nudge a tracked status's stack count by ±delta, clamped to [1, 99]. */
  adjustPanelStatusStacks: (
    screenId: string,
    panelId: string,
    statusId: string,
    delta: number,
  ) => void
  /** Stop tracking a status on a panel. */
  removePanelStatus: (screenId: string, panelId: string, statusId: string) => void
  /** Rename an NPC instance's display label. */
  renameInstance: (screenId: string, panelId: string, label: string) => void
  /** Replace an NPC instance's live state. */
  updateInstanceState: (
    screenId: string,
    panelId: string,
    updater: (state: NpcInstanceState) => NpcInstanceState,
  ) => void
  /** Set an instance's condition (active / downed / dead). */
  setInstanceCondition: (
    screenId: string,
    panelId: string,
    condition: NpcInstanceState['condition'],
  ) => void
  /** Apply damage to an NPC instance (armor → resistance → temp HP → HP). */
  damageInstance: (
    screenId: string,
    panelId: string,
    amount: number,
    opts?: InstanceDamageOptions,
  ) => DamageResult | null
  /** Heal an NPC instance (caps at the base's max HP; revives a downed instance). */
  healInstance: (screenId: string, panelId: string, amount: number) => void
  /** Add or replace an instance's temp HP (higher value wins). */
  setInstanceTempHP: (screenId: string, panelId: string, amount: number) => void
  /**
   * Nudge an instance's HP by ±amount, clamped to [0, base max]. A downward
   * step runs through the full damage pipeline (temp HP first, and a Mortal
   * Wound roll at 0 HP), so the panel's `−` stepper behaves exactly like the
   * Damage dialog; its result is returned so the caller can announce a wound or
   * a knockout. Returns null on an upward/no-op step.
   */
  adjustInstanceHP: (
    screenId: string,
    panelId: string,
    delta: number,
  ) => DamageResult | null
  /**
   * Clear one Mortal Wound from an instance's track (a wound healed by an
   * ability, or one the GM tracked by mistake). No-op for an unknown index.
   */
  clearInstanceMortalWound: (
    screenId: string,
    panelId: string,
    index: number,
  ) => void
  /** Clear an instance's whole Mortal Wound track (the panel's Rest equivalent). */
  clearInstanceMortalWounds: (screenId: string, panelId: string) => void
  /**
   * Apply a **specific** wound from the table to an instance's own track, with
   * no D20 — the manual counterpart of the automatic roll
   * {@link GMScreenActions.damageInstance} makes at 0 HP, for a wound something
   * named outright (an ability in play, the NPC's authored effect, a GM ruling).
   *
   * `name` must be a Mortal Wounds table entry: the entry's own D20 is stored
   * beside it, so a hand-added wound renders on the panel exactly like a rolled
   * one (`Damaged Throat · d20 8`) and its rules text resolves. Respects the
   * instance's allowance — the base's `npcStats.mortalWounds`, read live as the
   * damage pipeline reads it — so a full track (and the `mortalWounds: 0` mook
   * case) gains nothing. Returns whether the wound was added; nothing is
   * written when it was not.
   */
  addInstanceMortalWound: (
    screenId: string,
    panelId: string,
    name: string,
  ) => boolean
  /**
   * Spend AP from an NPC instance's own turn budget. Returns false when the
   * instance cannot afford it (the caller decides what to tell the GM).
   */
  spendInstanceAP: (screenId: string, panelId: string, amount: number) => boolean
  /** Give an NPC instance AP back, clamped to `MAX_AP`. */
  restoreInstanceAP: (screenId: string, panelId: string, amount: number) => void
  /**
   * Mark one of the base record's abilities as on Recharge cooldown for this
   * instance. No-op when it is already cooling, so a double click cannot
   * reorder the list or schedule a redundant save.
   */
  markAbilityCooldown: (
    screenId: string,
    panelId: string,
    abilityId: string,
  ) => void
  /**
   * Set how many uses this instance has left of one of the base record's
   * limited abilities. Clamped to the ability's authored `max` (read from the
   * base — the panel never trusts the number the caller saw), and moves only
   * the **instance's** count: the base record is never written to.
   *
   * A write that lands on the ability's full budget drops the entry instead of
   * storing it, so "untouched" stays distinguishable from "spent down and
   * handed back" — see {@link NpcInstanceState.abilityUses}.
   */
  setInstanceAbilityUses: (
    screenId: string,
    panelId: string,
    abilityId: string,
    remaining: number,
  ) => void
  /**
   * Spend one use of a limited ability on this instance (the Activate path).
   * Returns whether a use was really spent — false for an unknown ability, an
   * unlimited one, one whose author switched off `expendOnActivate`, or one at
   * 0 uses, so the caller's toast never claims a use it did not spend.
   */
  spendInstanceAbilityUse: (
    screenId: string,
    panelId: string,
    abilityId: string,
  ) => boolean
  /**
   * Switch one of the base record's abilities' stat/attribute modifiers on or
   * off **for this instance**. No-op for an ability that declares no modifiers,
   * and moves only the instance's own switch: the base record is never written
   * to.
   *
   * A switch that lands back on the ability's own `modifiersActive` value drops
   * the entry instead of storing it, so "untouched" stays distinguishable from
   * "flipped here" — see {@link NpcInstanceState.abilityModifiers}. Switching a
   * Max HP modifier off clamps the instance's current HP to the new maximum,
   * exactly as the sheet's own action does.
   */
  setInstanceAbilityModifiersActive: (
    screenId: string,
    panelId: string,
    abilityId: string,
    active: boolean,
  ) => void
  /**
   * Start an NPC instance's next turn: refill its Action Points and roll the
   * Recharge Die once, bringing every cooling ability whose Recharge value is
   * at or below the roll back online (and dropping ids that no longer resolve
   * to a Recharge ability on the base).
   *
   * Returns the roll + what it changed so the caller can surface it (the store
   * deliberately knows nothing about notifications or the roll log), or null
   * when the panel is gone.
   */
  startInstanceTurn: (
    screenId: string,
    panelId: string,
  ) => RechargeOutcome | null
  /**
   * Quick-create helper for the NPC picker: create a base NPC record (without
   * navigating) and immediately spawn an instance of it on this screen.
   * Returns the new panel id, or null if the name was empty.
   */
  createNpcBaseAndInstance: (
    screenId: string,
    name: string,
  ) => Promise<string | null>
  /** Names of the screens that reference the given character/NPC id. */
  screensReferencing: (characterId: string) => string[]
}

export type GMScreenStore = GMScreenState & GMScreenActions

/**
 * Max HP of one NPC **instance**: the base's manual `npcStats.hp` with the
 * instance's own active Max HP modifiers applied, read through the same
 * projection the panel renders (`withInstanceState`), so the HP bar's cap, the
 * damage pipeline's Mortal Wound reset, and healing's clamp all agree with the
 * Combat Stats row.
 *
 * A base with no usable HP stat still reads 0 — the instance has no pool to
 * measure, exactly as before modifiers existed.
 */
function instanceMaxHP(
  base: Character | null | undefined,
  state: NpcInstanceState,
): number {
  if (!base) return 0
  const raw = base.npcStats?.hp
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return effectiveNPCStats(withInstanceState(base, state)).hp
}

/**
 * Armor of one NPC instance, with its own active modifiers applied. A player
 * sheet's damage pipeline reads `effectiveCombatStats(character).armor` for the
 * same reason: a "+2 Armor" ability the GM switched on this panel has to reduce
 * the damage this instance takes, not just change a number on its stat row.
 */
function instanceArmor(entity: Character | null): number {
  return entity ? effectiveNPCStats(entity).armor : 0
}

/**
 * How many Mortal Wounds an NPC instance may sustain before 0 HP downs it.
 *
 * This is the base's `npcStats.mortalWounds` — the GM-entered stat on the NPC
 * sheet — read live (like max HP, armor, Evasion, …) so editing the base
 * updates every instance of it. `0` is the mook case: no roll on the Mortal
 * Wounds table, 0 HP simply downs the instance.
 */
export function npcMortalWoundAllowance(base: Character | null | undefined): number {
  const allowance = base?.npcStats?.mortalWounds
  return typeof allowance === 'number' && Number.isFinite(allowance)
    ? Math.max(0, Math.floor(allowance))
    : 0
}

/**
 * Auto-numbered label for a new instance of `base`: the base name the first
 * time, then "Name 2", "Name 3", … skipping numbers already in use.
 */
function autoInstanceLabel(screen: GMScreen, base: Character): string {
  const used = new Set<string>()
  for (const p of screen.panels) {
    if (p.kind === 'npc-instance' && p.baseNpcId === base.id) used.add(p.label)
  }
  const instanceCount = screen.panels.filter(
    (p) => p.kind === 'npc-instance' && p.baseNpcId === base.id,
  ).length
  if (instanceCount === 0) return base.name
  let n = instanceCount + 1
  while (used.has(`${base.name} ${n}`)) n++
  return `${base.name} ${n}`
}

/** Panel id for a new panel. */
function newPanelId(): string {
  return generateId()
}

/**
 * Fold a remaining-uses write back into an instance's sparse
 * {@link NpcInstanceState.abilityUses} map.
 *
 * A count that lands on the ability's authored maximum is stored as **absence**
 * — the map records only budgets an instance has actually spent into — so a
 * fresh instance (and one the GM has handed every use back to) reads the base's
 * maximum at render time and follows it if the base's budget is later raised.
 */
function withRecordedAbilityUse(
  recorded: Record<string, number>,
  abilityId: string,
  remaining: number,
  max: number,
): Record<string, number> {
  const next = { ...recorded }
  if (remaining >= max) delete next[abilityId]
  else next[abilityId] = remaining
  return next
}

export const useGMScreenStore = create<GMScreenStore>()((set, get) => {
  /** Replace one screen in state and schedule its autosave. */
  function commit(updated: GMScreen) {
    const stamped: GMScreen = { ...updated, updatedAt: new Date().toISOString() }
    set((state) => ({
      screens: state.screens.map((s) => (s.id === stamped.id ? stamped : s)),
    }))
    clearSaveTimer(stamped.id)
    saveTimers.set(
      stamped.id,
      setTimeout(() => {
        saveTimers.delete(stamped.id)
        void get().saveScreen(stamped.id)
      }, AUTOSAVE_DEBOUNCE_MS),
    )
  }

  /** Apply a transformation to one screen's panel list. */
  function withPanels(
    screenId: string,
    transform: (panels: ScreenPanel[], screen: GMScreen) => ScreenPanel[],
  ): GMScreen | null {
    const screen = get().screens.find((s) => s.id === screenId)
    if (!screen) return null
    const panels = transform(screen.panels, screen)
    const updated = { ...screen, panels }
    commit(updated)
    return updated
  }

  /** Find an NPC-instance panel and its owning screen. */
  function findInstance(screenId: string, panelId: string) {
    const screen = get().screens.find((s) => s.id === screenId)
    if (!screen) return null
    const panel = screen.panels.find((p) => p.id === panelId)
    if (!panel || panel.kind !== 'npc-instance') return null
    return { screen, panel }
  }

  return {
    screens: [],
    currentScreenId: readLastScreenId(),
    isLoaded: false,
    isSaving: false,
    loadError: null,

    loadScreens: async () => {
      try {
        const screens = await getAllScreens()
        set((state) => {
          // Keep the persisted selection when it still exists; otherwise fall
          // back to the first screen (or none).
          const remembered = state.currentScreenId ?? readLastScreenId()
          const currentScreenId =
            remembered && screens.some((s) => s.id === remembered)
              ? remembered
              : (screens[0]?.id ?? null)
          writeLastScreenId(currentScreenId)
          return { screens, currentScreenId, isLoaded: true, loadError: null }
        })
      } catch (err) {
        // NEVER leave the page spinning: surface the failure and let the user
        // retry. IndexedDB can fail for reasons outside the app's control
        // (storage disabled, another tab blocking a schema upgrade, …).
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Could not read saved GM screens from this browser’s storage.'
        console.error('[grimoire] loadScreens failed:', err)
        set({ screens: [], currentScreenId: null, isLoaded: true, loadError: message })
      }
    },

    createScreen: async (name?: string) => {
      const now = new Date().toISOString()
      const screen: GMScreen = {
        id: generateId(),
        name: name?.trim() || `Untitled Screen`,
        panels: [],
        createdAt: now,
        updatedAt: now,
      }
      set({ isSaving: true })
      try {
        await putScreen(screen)
      } catch (err) {
        console.error('[grimoire] createScreen failed:', err)
        set({ isSaving: false, loadError: storageErrorMessage(err) })
        throw err
      }
      set((state) => ({
        screens: [...state.screens, screen],
        currentScreenId: screen.id,
        isSaving: false,
        loadError: null,
      }))
      writeLastScreenId(screen.id)
      return screen
    },

    renameScreen: (id, name) => {
      const screen = get().screens.find((s) => s.id === id)
      if (!screen) return
      commit({ ...screen, name })
    },

    deleteScreen: async (id) => {
      clearSaveTimer(id)
      try {
        await dbDeleteScreen(id)
      } catch (err) {
        console.error('[grimoire] deleteScreen failed:', err)
        set({ loadError: storageErrorMessage(err) })
        return
      }
      set((state) => {
        const screens = state.screens.filter((s) => s.id !== id)
        let currentScreenId = state.currentScreenId
        if (currentScreenId === id) {
          // Select the neighbour that took its place, else the previous one.
          const removedIndex = state.screens.findIndex((s) => s.id === id)
          currentScreenId =
            screens[Math.min(removedIndex, screens.length - 1)]?.id ?? null
          writeLastScreenId(currentScreenId)
        }
        return { screens, currentScreenId }
      })
    },

    selectScreen: (id) => {
      set({ currentScreenId: id })
      writeLastScreenId(id)
    },

    currentScreen: () => {
      const { screens, currentScreenId } = get()
      if (!currentScreenId) return null
      return screens.find((s) => s.id === currentScreenId) ?? null
    },

    addCharacterPanel: (screenId, characterId) => {
      const screen = get().screens.find((s) => s.id === screenId)
      if (!screen) return false
      const already = screen.panels.some(
        (p) => p.kind === 'character' && p.characterId === characterId,
      )
      if (already) return false
      commit({
        ...screen,
        panels: [
          ...screen.panels,
          {
            kind: 'character',
            id: newPanelId(),
            characterId,
            density: 'compact',
            statuses: [],
          },
        ],
      })
      return true
    },

    addNpcInstancePanel: (screenId, baseNpcId, label) => {
      const screen = get().screens.find((s) => s.id === screenId)
      if (!screen) return ''
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === baseNpcId)
      const id = newPanelId()
      const resolvedLabel = label?.trim() || (base ? autoInstanceLabel(screen, base) : '')
      // A fresh instance has taken no wounds (its allowance is the base's
      // `npcStats.mortalWounds`, read at damage time — not copied here), spent
      // none of its limited abilities' uses, and flipped none of its modifier
      // switches. Both maps are deliberately empty rather than snapshots of the
      // base: an instance records only what it changes itself, so every
      // instance starts on the base's own (template) state and tracks its own
      // from there.
      const state: NpcInstanceState = {
        currentHP: 0,
        tempHP: 0,
        condition: 'active',
        currentAP: MAX_AP,
        cooldowns: [],
        mortalWounds: [],
        abilityUses: {},
        abilityModifiers: {},
      }
      // Spawned at the instance's full pool, which is the base's HP with any
      // template-level Max HP modifier the base record carries.
      state.currentHP = instanceMaxHP(base, state)
      const panel: ScreenPanel = {
        kind: 'npc-instance',
        id,
        baseNpcId,
        label: resolvedLabel,
        density: 'compact',
        statuses: [],
        state,
      }
      commit({ ...screen, panels: [...screen.panels, panel] })
      return id
    },

    duplicatePanel: (screenId, panelId) => {
      const found = findInstance(screenId, panelId)
      if (!found) return null
      const { screen, panel } = found
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === panel.baseNpcId)
      const id = newPanelId()
      // A duplicate is a FRESH instance at full HP — never a HP copy, and no
      // inherited statuses, Mortal Wounds, spent uses or flipped modifier
      // switches either: the GM applied those to the original. Its turn is
      // fresh too (full AP, nothing on cooldown).
      const state: NpcInstanceState = {
        currentHP: 0,
        tempHP: 0,
        condition: 'active',
        currentAP: MAX_AP,
        cooldowns: [],
        mortalWounds: [],
        abilityUses: {},
        abilityModifiers: {},
      }
      state.currentHP = instanceMaxHP(base, state)
      const copy: ScreenPanel = {
        ...panel,
        id,
        label: base ? autoInstanceLabel(screen, base) : panel.label,
        statuses: [],
        state,
      }
      withPanels(screenId, (panels) => [...panels, copy])
      return id
    },

    removePanel: (screenId, panelId) => {
      withPanels(screenId, (panels) => panels.filter((p) => p.id !== panelId))
    },

    movePanel: (screenId, fromIndex, toIndex) => {
      if (fromIndex === toIndex) return
      withPanels(screenId, (panels) => {
        if (fromIndex < 0 || fromIndex >= panels.length) return panels
        if (toIndex < 0 || toIndex >= panels.length) return panels
        const next = [...panels]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
    },

    setPanelDensity: (screenId, panelId, density) => {
      withPanels(screenId, (panels) =>
        panels.map((p) => (p.id === panelId ? { ...p, density } : p)),
      )
    },

    setPanelStatus: (screenId, panelId, statusId, duration) => {
      withPanels(screenId, (panels) =>
        panels.map((p) => {
          if (p.id !== panelId) return p
          const existing = p.statuses.find((s) => s.statusId === statusId)
          // Re-picking a duration for a status already on the panel changes it
          // in place — the picker's chips double as the duration editor, so the
          // stack count the GM has been ticking must survive.
          const statuses = existing
            ? p.statuses.map((s) =>
                s.statusId === statusId ? { ...s, duration } : s,
              )
            : [...p.statuses, { statusId, duration, stacks: 1 }]
          return { ...p, statuses }
        }),
      )
    },

    adjustPanelStatusStacks: (screenId, panelId, statusId, delta) => {
      withPanels(screenId, (panels) =>
        panels.map((p) => {
          if (p.id !== panelId) return p
          return {
            ...p,
            statuses: p.statuses.map((s) =>
              s.statusId === statusId
                ? {
                    ...s,
                    stacks: Math.min(
                      MAX_PANEL_STATUS_STACKS,
                      Math.max(1, s.stacks + delta),
                    ),
                  }
                : s,
            ),
          }
        }),
      )
    },

    removePanelStatus: (screenId, panelId, statusId) => {
      withPanels(screenId, (panels) =>
        panels.map((p) =>
          p.id === panelId
            ? {
                ...p,
                statuses: p.statuses.filter((s) => s.statusId !== statusId),
              }
            : p,
        ),
      )
    },

    renameInstance: (screenId, panelId, label) => {
      withPanels(screenId, (panels) =>
        panels.map((p) =>
          p.id === panelId && p.kind === 'npc-instance' ? { ...p, label } : p,
        ),
      )
    },

    updateInstanceState: (screenId, panelId, updater) => {
      withPanels(screenId, (panels) =>
        panels.map((p) =>
          p.id === panelId && p.kind === 'npc-instance'
            ? { ...p, state: updater(p.state) }
            : p,
        ),
      )
    },

    setInstanceCondition: (screenId, panelId, condition) => {
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        condition,
      }))
    },

    damageInstance: (screenId, panelId, amount, opts = {}) => {
      const found = findInstance(screenId, panelId)
      if (!found) return null
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      // Every stat this pipeline reads goes through the instance's own
      // projection: a "+3 Armor" ability the GM switched on this panel has to
      // reduce the damage this instance takes, not just decorate its stat row.
      const entity = base ? withInstanceState(base, found.panel.state) : null
      const armor = instanceArmor(entity)
      const maxHP = instanceMaxHP(base, found.panel.state)
      const { applyArmor = false, resistant = false, ignoreTempHP = false } = opts

      let dmg = amount
      let afterArmor = dmg
      // Step 1: armor — 1d6 reduction per armor point.
      if (applyArmor && armor > 0) {
        const reduction = Array.from({ length: armor }, () => rollDie(6)).reduce(
          (a, b) => a + b,
          0,
        )
        dmg = Math.max(0, dmg - reduction)
        afterArmor = dmg
      }

      // Step 2: resistance — halves damage.
      let afterResistance = dmg
      if (resistant) {
        dmg = Math.floor(dmg / 2)
        afterResistance = dmg
      }

      // Step 3: temp HP absorbs first.
      const prev = found.panel.state
      let tempHPConsumed = 0
      let remaining = dmg
      let newTempHP = prev.tempHP
      if (!ignoreTempHP && prev.tempHP > 0) {
        tempHPConsumed = Math.min(prev.tempHP, remaining)
        newTempHP = prev.tempHP - tempHPConsumed
        remaining -= tempHPConsumed
      }

      // Step 4: remaining damage hits HP. An instance rolls a Mortal Wound
      // whenever it reaches 0 HP while the base still allows one — the same
      // rule a player sheet follows (HP resets to max, the excess spills over) —
      // except that the D20 is rolled here rather than by a card button, so the
      // GM sees the wound land without another click. Once the instance can
      // take no more (or the base allows none, the `mortalWounds: 0` mook case)
      // reaching 0 downs it instead. A downed or dead instance rolls nothing:
      // it is already out of the fight, so further damage just clamps at 0.
      const allowance =
        prev.condition === 'active' ? npcMortalWoundAllowance(base) : 0
      const mortalWounds: MortalWoundRoll[] = [...prev.mortalWounds]
      let newHP = prev.currentHP - remaining
      while (newHP <= 0 && mortalWounds.length < allowance) {
        const wound = rollOnMortalWoundTable()
        mortalWounds.push({ roll: wound.roll, name: wound.name })
        // HP resets to max after a mortal wound, excess spills over — which can
        // drive it to 0 again and cost a second wound, exactly as on a sheet.
        newHP = maxHP - Math.abs(newHP)
      }
      const downedNow = newHP <= 0
      if (downedNow) newHP = 0

      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentHP: newHP,
        tempHP: newTempHP,
        mortalWounds,
        condition:
          downedNow && state.condition !== 'dead' ? 'downed' : state.condition,
      }))

      return {
        rawDamage: amount,
        afterArmor,
        afterResistance,
        tempHPConsumed,
        // HP can end the exchange HIGHER than it started (a wound resets it to
        // max), so this is the drop in the pool, never a negative "damage".
        hpLost: Math.max(0, prev.currentHP - newHP),
        finalHP: newHP,
        causedMortalWound: mortalWounds.length > prev.mortalWounds.length,
        mortalWoundsIncurred: mortalWounds.length - prev.mortalWounds.length,
        mortalWoundRolls: mortalWounds.slice(prev.mortalWounds.length),
        knockedOut: downedNow,
        downed: downedNow,
      } satisfies DamageResult
    },

    healInstance: (screenId, panelId, amount) => {
      const found = findInstance(screenId, panelId)
      if (!found) return
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      // The instance's own Max HP modifiers raise/lower the cap healing stops
      // at, exactly as they do for a player sheet.
      const maxHP = instanceMaxHP(base, found.panel.state)
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentHP: Math.min(maxHP, state.currentHP + amount),
        // Healing a downed instance brings it back to active; the GM's
        // explicit `dead` flag is never cleared by healing.
        condition: state.condition === 'downed' ? 'active' : state.condition,
      }))
    },

    setInstanceTempHP: (screenId, panelId, amount) => {
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        tempHP: Math.max(state.tempHP, amount),
      }))
    },

    adjustInstanceHP: (screenId, panelId, delta) => {
      const found = findInstance(screenId, panelId)
      if (!found) return null
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      const maxHP = instanceMaxHP(base, found.panel.state)
      if (delta < 0) {
        // Downward steps run through the full damage pipeline (temp HP first,
        // Mortal Wounds at 0 HP), so stepping the bar matches applying damage.
        return get().damageInstance(screenId, panelId, -delta)
      }
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentHP: Math.min(maxHP, state.currentHP + delta),
        condition: state.condition === 'downed' ? 'active' : state.condition,
      }))
      return null
    },

    // ---- Live play: instance Mortal Wounds ------------------------------------

    clearInstanceMortalWound: (screenId, panelId, index) => {
      const found = findInstance(screenId, panelId)
      if (!found) return
      const wounds = found.panel.state.mortalWounds
      if (index < 0 || index >= wounds.length) return
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        mortalWounds: state.mortalWounds.filter((_, i) => i !== index),
      }))
    },

    clearInstanceMortalWounds: (screenId, panelId) => {
      const found = findInstance(screenId, panelId)
      if (!found || found.panel.state.mortalWounds.length === 0) return
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        mortalWounds: [],
      }))
    },

    addInstanceMortalWound: (screenId, panelId, name) => {
      const found = findInstance(screenId, panelId)
      // A hand-added wound is a table entry like a rolled one — see the action
      // doc: the panel resolves its rules text by name and prints the entry's
      // D20, so an invented name would render a wound with no rules at all.
      const entry = mortalWoundByName(name)
      if (!found || !entry) return false
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      // Room is the base's allowance, read live — exactly what the damage
      // pipeline compares the track against before it rolls.
      if (found.panel.state.mortalWounds.length >= npcMortalWoundAllowance(base)) {
        return false
      }
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        mortalWounds: [
          ...state.mortalWounds,
          { roll: entry.id, name: entry.name },
        ],
      }))
      return true
    },

    // ---- Live play: NPC Action Points & Recharge -------------------------------

    spendInstanceAP: (screenId, panelId, amount) => {
      const found = findInstance(screenId, panelId)
      if (!found || amount <= 0) return false
      if (found.panel.state.currentAP < amount) return false
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentAP: Math.max(0, state.currentAP - amount),
      }))
      return true
    },

    restoreInstanceAP: (screenId, panelId, amount) => {
      const found = findInstance(screenId, panelId)
      if (!found || amount <= 0) return
      if (found.panel.state.currentAP >= MAX_AP) return
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentAP: Math.min(MAX_AP, state.currentAP + amount),
      }))
    },

    markAbilityCooldown: (screenId, panelId, abilityId) => {
      const found = findInstance(screenId, panelId)
      if (!found || !abilityId) return
      if (found.panel.state.cooldowns.includes(abilityId)) return
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        cooldowns: [...state.cooldowns, abilityId],
      }))
    },

    // ---- Live play: instance ability uses --------------------------------------

    setInstanceAbilityUses: (screenId, panelId, abilityId, remaining) => {
      const found = findInstance(screenId, panelId)
      if (!found || !abilityId) return
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      const ability = base ? findAbility(base, abilityId) : null
      if (!ability) return
      const uses = abilityUses(ability)
      // An unlimited ability has no budget to set.
      if (!uses) return
      const clamped = Math.min(uses.max, Math.max(0, Math.floor(remaining)))
      const recorded = found.panel.state.abilityUses ?? {}
      if (instanceAbilityUsesRemaining(ability, recorded[abilityId]) === clamped) {
        return
      }
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        abilityUses: withRecordedAbilityUse(
          state.abilityUses ?? {},
          abilityId,
          clamped,
          uses.max,
        ),
      }))
    },

    spendInstanceAbilityUse: (screenId, panelId, abilityId) => {
      const found = findInstance(screenId, panelId)
      if (!found || !abilityId) return false
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      const ability = base ? findAbility(base, abilityId) : null
      if (!ability) return false
      const uses = abilityUses(ability)
      // Mirrors characterStore.spendAbilityUse: only a limited ability the
      // author opted into the use economy, and only with a use left, spends.
      if (!uses || !expendsUseOnActivate(ability)) return false
      const recorded = found.panel.state.abilityUses ?? {}
      const remaining = instanceAbilityUsesRemaining(ability, recorded[abilityId])
      if (remaining <= 0) return false
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        abilityUses: withRecordedAbilityUse(
          state.abilityUses ?? {},
          abilityId,
          remaining - 1,
          uses.max,
        ),
      }))
      return true
    },

    setInstanceAbilityModifiersActive: (screenId, panelId, abilityId, active) => {
      const found = findInstance(screenId, panelId)
      if (!found || !abilityId) return
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      const ability = base ? findAbility(base, abilityId) : null
      // An ability that declares no modifiers has nothing to switch.
      if (!ability || !hasAbilityModifiers(ability)) return
      const recorded = found.panel.state.abilityModifiers ?? {}
      const authored = ability.modifiersActive === true
      // Already in the requested state: no write, no autosave.
      if ((recorded[abilityId] ?? authored) === active) return
      // A switch that lands back on the ability's own flag is stored as
      // *absence* (the instance never touched it); anything else is recorded.
      // Unlike uses, both directions can be a real change: a base whose flag is
      // on can be switched off on one instance without touching the base.
      const abilityModifiers = { ...recorded }
      if (active === authored) delete abilityModifiers[abilityId]
      else abilityModifiers[abilityId] = active
      // Switching a Max HP modifier off can leave current HP above the new
      // maximum — clamp here, exactly as characterStore's own switch does.
      const maxHP = instanceMaxHP(base, {
        ...found.panel.state,
        abilityModifiers,
      })
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        abilityModifiers,
        currentHP: Math.min(state.currentHP, maxHP),
      }))
    },

    startInstanceTurn: (screenId, panelId) => {
      const found = findInstance(screenId, panelId)
      if (!found) return null
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      // One roll decides everything: the die is rolled here (not by the caller)
      // so the number the GM is told, the number in the roll log, and the set
      // of abilities that come back can never disagree.
      const roll = rollRechargeDie()
      const outcome: RechargeOutcome = base
        ? resolveRecharge(base, found.panel.state.cooldowns, roll)
        : // The base record is gone (the panel renders MissingPanel, so this is
          // unreachable from the UI) — nothing can be resolved against it.
          { roll, recharged: [], stillCooling: [] }
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentAP: MAX_AP,
        cooldowns: outcome.stillCooling.map((entry) => entry.id),
      }))
      return outcome
    },

    createNpcBaseAndInstance: async (screenId, name) => {
      const base = await useCharacterStore.getState().createNpcBase(name)
      if (!base) return null
      const panelId = get().addNpcInstancePanel(screenId, base.id, base.name)
      return panelId || null
    },

    screensReferencing: (characterId) => {
      return get()
        .screens.filter((s) =>
          s.panels.some((p) =>
            p.kind === 'character'
              ? p.characterId === characterId
              : p.baseNpcId === characterId,
          ),
        )
        .map((s) => s.name)
    },

    saveScreen: async (id: string) => {
      clearSaveTimer(id)
      const screen = get().screens.find((s) => s.id === id)
      if (!screen) return
      set({ isSaving: true })
      try {
        await putScreen(screen)
        set({ isSaving: false })
      } catch (err) {
        // Surface it rather than throwing out of a debounce callback, which
        // would become an unhandled rejection with no user-visible trace.
        console.error('[grimoire] saveScreen failed:', err)
        set({ isSaving: false, loadError: storageErrorMessage(err) })
      }
    },
  }
})
