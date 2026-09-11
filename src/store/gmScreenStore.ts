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
import { rollDie } from '@/lib/dice'
import { resolveRecharge, rollRechargeDie, type RechargeOutcome } from '@/lib/abilityRecharge'
import { useCharacterStore } from '@/store/characterStore'
import type { DamageResult } from '@/store/characterStore'
import type { Character, GMScreen, NpcInstanceState, PanelStatusDuration, ScreenPanel, ScreenPanelDensity } from '@/types'

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
  /** Nudge an instance's HP by ±amount, clamped to [0, base max]. */
  adjustInstanceHP: (screenId: string, panelId: string, delta: number) => void
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

/** Max HP of an NPC instance = the base's manual `npcStats.hp`. */
function baseMaxHP(base: Character | null): number {
  const hp = base?.npcStats?.hp
  return typeof hp === 'number' && Number.isFinite(hp) ? hp : 0
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
      const panel: ScreenPanel = {
        kind: 'npc-instance',
        id,
        baseNpcId,
        label: resolvedLabel,
        density: 'compact',
        statuses: [],
        state: {
          currentHP: baseMaxHP(base ?? null),
          tempHP: 0,
          condition: 'active',
          currentAP: MAX_AP,
          cooldowns: [],
        },
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
      const copy: ScreenPanel = {
        ...panel,
        id,
        label: base ? autoInstanceLabel(screen, base) : panel.label,
        // A duplicate is a FRESH instance at full HP — never a HP copy, and no
        // inherited statuses either: the GM applied those to the original. Its
        // turn is fresh too: full AP and nothing on cooldown.
        statuses: [],
        state: {
          currentHP: baseMaxHP(base ?? null),
          tempHP: 0,
          condition: 'active',
          currentAP: MAX_AP,
          cooldowns: [],
        },
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
      const armor = base?.npcStats?.armor ?? 0
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

      // Step 4: remaining damage hits HP. NPCs have no mortal wounds or death
      // saves — reaching 0 simply downs the instance.
      let newHP = prev.currentHP - remaining
      const downedNow = newHP <= 0
      if (downedNow) newHP = 0

      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentHP: newHP,
        tempHP: newTempHP,
        condition:
          downedNow && state.condition !== 'dead' ? 'downed' : state.condition,
      }))

      return {
        rawDamage: amount,
        afterArmor,
        afterResistance,
        tempHPConsumed,
        hpLost: prev.currentHP - newHP,
        finalHP: newHP,
        causedMortalWound: false,
        mortalWoundsIncurred: 0,
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
      const maxHP = baseMaxHP(base ?? null)
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
      if (!found) return
      const base = useCharacterStore
        .getState()
        .characters.find((c) => c.id === found.panel.baseNpcId)
      const maxHP = baseMaxHP(base ?? null)
      if (delta < 0) {
        // Downward steps run through the full damage pipeline (temp HP first),
        // so stepping the bar matches applying damage.
        get().damageInstance(screenId, panelId, -delta)
        return
      }
      get().updateInstanceState(screenId, panelId, (state) => ({
        ...state,
        currentHP: Math.min(maxHP, state.currentHP + delta),
        condition: state.condition === 'downed' ? 'active' : state.condition,
      }))
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
