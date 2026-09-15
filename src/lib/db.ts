/**
 * IndexedDB storage layer for Grimoire.
 *
 * A thin promise wrapper around the native IndexedDB API. The database holds
 * two object stores:
 *   - `characters`: the live {@link Character} records keyed by `id`.
 *   - `versions`: {@link VersionSnapshot} records for character version
 *     history, keyed by `id` and indexed by `characterId`.
 *
 * All functions here are framework-agnostic and safe to call from anywhere.
 */

import type { AbilityBlock, AbilityCost, Character, CharacterViewModes, GMScreen, MortalWoundRoll, NPCStats, NpcInstanceState, PanelStatus, ScreenPanel, SheetColors, SheetLabel, StatusCondition, VersionSnapshot } from '@/types'
import { createDefaultStatuses } from '@/constants/statuses'
import { MAX_PANEL_STATUS_STACKS, isPanelStatusDuration } from '@/constants/statusDurations'
import { DEFAULT_SHEET_COLORS, MAX_AP, generateId } from '@/constants/gameData'
import {
  normalizeInstanceAbilityModifiers,
  normalizeModifiers,
} from '@/lib/abilityModifiers'
import { normalizeAbilityUses, normalizeInstanceAbilityUses } from '@/lib/abilityUses'
import { normalizeActivationRolls } from '@/lib/activationRolls'
import { normalizeCustomAttributes } from '@/lib/customAttributes'

const DB_NAME = 'grimoire'
const DB_VERSION = 5
const CHAR_STORE = 'characters'
const VERSION_STORE = 'versions'
const ROLL_LOG_STORE = 'roll_logs'
const STATUS_STORE = 'statuses'
const SCREEN_STORE = 'screens'

/**
 * How long to wait for an `indexedDB.open()` that never settles before giving
 * up with a diagnosable error.
 *
 * A version upgrade is BLOCKED (not failed) while any other connection to the
 * database stays open — most commonly the same app in another tab, or a cached
 * older build whose `DB_VERSION` is lower. In that state the browser fires no
 * useful event and the request simply never settles, so without a deadline
 * every caller awaits forever and the UI spins on "Loading…".
 */
const OPEN_TIMEOUT_MS = 10_000

/**
 * The object stores every Grimoire database must contain. A connection that
 * reports {@link DB_VERSION} but is missing any of these is a half-applied
 * upgrade (see {@link openDB}).
 */
const REQUIRED_STORES = [
  CHAR_STORE,
  VERSION_STORE,
  ROLL_LOG_STORE,
  STATUS_STORE,
  SCREEN_STORE,
] as const

/** Stores missing from an open connection, if any. */
function missingStores(db: IDBDatabase): string[] {
  return REQUIRED_STORES.filter((name) => !db.objectStoreNames.contains(name))
}

/** Create every store this schema needs that the connection doesn't have yet. */
function createMissingStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(CHAR_STORE)) {
    db.createObjectStore(CHAR_STORE, { keyPath: 'id' })
  }

  if (!db.objectStoreNames.contains(VERSION_STORE)) {
    const versionStore = db.createObjectStore(VERSION_STORE, { keyPath: 'id' })
    versionStore.createIndex('characterId', 'characterId', { unique: false })
  }

  if (!db.objectStoreNames.contains(ROLL_LOG_STORE)) {
    const rollLogStore = db.createObjectStore(ROLL_LOG_STORE, { keyPath: 'id' })
    rollLogStore.createIndex('characterId', 'characterId', { unique: false })
  }

  if (!db.objectStoreNames.contains(STATUS_STORE)) {
    const statusStore = db.createObjectStore(STATUS_STORE, { keyPath: 'id' })
    // Seed the built-in Divergence status conditions exactly once, when the
    // store is first created. Later upgrades never re-seed, so a user who
    // deletes a default won't have it resurrected.
    for (const status of createDefaultStatuses()) {
      statusStore.put(status)
    }
  }

  if (!db.objectStoreNames.contains(SCREEN_STORE)) {
    // Saved GM Screens. No indexes: the panel lists are stored inline and the
    // whole set is always read at once (see getAllScreens).
    db.createObjectStore(SCREEN_STORE, { keyPath: 'id' })
  }
}

/** True once a connection has been opened with a repaired (bumped) version. */
let schemaRepaired = false

/**
 * Whether {@link openDB} had to force a schema repair this session.
 *
 * Read by App so a silent repair can be reported to the user once.
 */
export function wasSchemaRepaired(): boolean {
  return schemaRepaired
}

/**
 * Open (and initialise) the Grimoire IndexedDB database.
 *
 * Creates the object stores on first run / version bump. Resolves with the
 * ready {@link IDBDatabase}; rejects on any open/upgrade error, when another
 * connection blocks the upgrade (after {@link OPEN_TIMEOUT_MS}), or when the
 * browser makes IndexedDB unavailable.
 *
 * **Self-healing:** an upgrade can be interrupted (the browser kills the
 * upgrade transaction, or an abandoned open lands late), leaving the database
 * stamped at the current version while an object store was never created.
 * Re-opening at the same version can never fire `upgradeneeded` again, so such
 * a database would fail every query forever. The connection is therefore
 * verified on open: if a required store is missing, the connection is closed
 * and reopened at `version + 1`, which re-runs the (idempotent) store creation.
 * An upgrade never touches existing records.
 */
export function openDB(): Promise<IDBDatabase> {
  // SERIALIZED: `loadCharacters` and `loadScreens` both run on mount, so two
  // opens (and therefore two competing version upgrades) would otherwise be in
  // flight at once. That race is what let one connection mint version 6 while
  // the other was still asking for version 5, and the loser failed with
  // `VersionError`. Every caller now shares one open.
  if (openPromise) return openPromise
  openPromise = openDatabase()
  // A failed open must not be cached forever — the next caller retries.
  openPromise.catch(() => {
    openPromise = null
  })
  return openPromise
}

/** The shared in-flight / completed open, or null when none is established. */
let openPromise: Promise<IDBDatabase> | null = null

/**
 * Close and forget the shared connection (used by tests and by flows that need
 * a guaranteed-fresh connection).
 */
export function resetDBConnection() {
  const existing = openPromise
  openPromise = null
  void existing?.then((db) => db.close()).catch(() => {})
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    /** Guards against settling twice (timeout racing the real outcome). */
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    /** The most recent in-flight request, so a late arrival can be closed. */
    let pending: IDBOpenDBRequest | null = null

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      timer = null
      fn()
    }

    timer = setTimeout(() => {
      const abandoned = pending
      pending = null
      // The request may STILL succeed after we give up. If it does, that
      // connection must be closed: an unreferenced open connection holds the
      // database at its current version and blocks every later upgrade.
      if (abandoned) {
        abandoned.onsuccess = () => abandoned.result?.close()
        abandoned.onerror = null
        abandoned.onupgradeneeded = null
      }
      finish(() =>
        reject(
          new Error(
            'The local database is locked by another Grimoire tab or window. ' +
              'Close the other tabs (or reload them so they run this version) and try again.',
          ),
        ),
      )
    }, OPEN_TIMEOUT_MS)

    /**
     * One open attempt. `version === undefined` opens whatever version exists
     * (no upgrade); `allowRepair` permits one version bump to create missing
     * stores, and one no-version retry if we lose a version race.
     */
    const attempt = (version: number | undefined, allowRepair: boolean) => {
      let request: IDBOpenDBRequest
      try {
        request =
          version === undefined
            ? indexedDB.open(DB_NAME)
            : indexedDB.open(DB_NAME, version)
      } catch (err) {
        // Private-mode / disabled storage throws synchronously.
        finish(() =>
          reject(
            new Error(
              `Could not open the local database: ${
                err instanceof Error ? err.message : String(err)
              }`,
            ),
          ),
        )
        return
      }
      pending = request

      request.onerror = () => {
        const err = request.error
        // Another context (tab) upgraded the database past our version while
        // this open was in flight, or we lost a race to mint the bumped
        // version. Re-open at whatever version now exists and re-verify.
        if (err?.name === 'VersionError' && allowRepair) {
          attempt(undefined, false)
          return
        }
        finish(() => reject(err))
      }
      request.onblocked = () => {
        // Another connection is holding the database open. The request may
        // still proceed if that tab closes, so let the timeout decide — but
        // give the real reason in the console immediately.
        console.warn(
          '[grimoire] IndexedDB upgrade blocked by another open connection; ' +
            'close other Grimoire tabs to continue.',
        )
      }

      request.onupgradeneeded = () => {
        const db = request.result
        // Fresh connections must yield to a later upgrade.
        db.onversionchange = () => db.close()
        createMissingStores(db)
      }

      request.onsuccess = () => {
        const db = request.result
        if (pending === request) pending = null
        // An older tab asking to upgrade would otherwise deadlock behind us:
        // release our connection so its `versionchange` can proceed.
        db.onversionchange = () => db.close()

        const missing = missingStores(db)
        if (missing.length > 0) {
          if (allowRepair) {
            // Bump the version so `upgradeneeded` runs again and creates the
            // missing stores. Upgrading never touches existing records.
            console.warn(
              `[grimoire] database is missing store(s) ${missing.join(
                ', ',
              )} — repairing schema`,
            )
            const bumped = db.version + 1
            db.close()
            attempt(bumped, false)
            return
          }
          db.close()
          finish(() =>
            reject(
              new Error(
                `The local database is missing required storage (${missing.join(
                  ', ',
                )}) and could not be repaired automatically.`,
              ),
            ),
          )
          return
        }

        if ((version ?? db.version) > DB_VERSION) schemaRepaired = true
        finish(() => resolve(db))
      }
    }

    attempt(DB_VERSION, true)
  })
}

/**
 * Run `fn` against the shared connection, reconnecting once if the connection
 * turns out to be dead.
 *
 * The connection is a long-lived singleton (see {@link openDB}), so it can be
 * closed underneath us — most commonly when another tab asks to upgrade the
 * schema and our `versionchange` handler releases it. Rather than failing the
 * user's action, drop the dead connection and retry once on a fresh one.
 */
async function withConnection<T>(
  fn: (db: IDBDatabase) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await openDB())
  } catch (err) {
    if (!isConnectionError(err)) throw err
    console.warn('[grimoire] storage connection was closed; reconnecting')
    resetDBConnection()
    return fn(await openDB())
  }
}

/** True for errors that mean "this connection is unusable", not "bad data". */
function isConnectionError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name
  return name === 'InvalidStateError' || name === 'DatabaseClosedError'
}

/**
 * Wrap an {@link IDBRequest} in a Promise, rejecting on error and resolving
 * with `request.result` on success.
 */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Normalize a freshly-loaded Character record to the latest schema.
 *
 * Migrates the old single-ability `innateAbility` field to the new
 * multi-ability `innateAbilities` array, guaranteeing downstream code never
 * sees an undefined `innateAbilities`.
 */
export function normalizeCharacter(raw: Character): Character {
  const result = { ...raw }

  // Migrate from old single-ability shape (field rename innateAbility →
  // innateAbilities). We still need to DROP the old key even when it
  // overlaps — the shallow spread above copies it onto `result`.
  if (!Array.isArray(result.innateAbilities)) {
    const rawObj = raw as unknown as {
      innateAbility?: import('@/types').AbilityBlock | null
    } & Record<string, unknown>
    const { innateAbility } = rawObj
    // Drop the legacy key and set the new array r/place.
    const rest = { ...result } as Record<string, unknown>
    delete rest.innateAbility
    Object.assign(result, rest, {
      innateAbilities:
        innateAbility && typeof innateAbility === 'object'
          ? [innateAbility]
          : [],
    })
  }

  // Ensure every AbilityBlock has `showActivate` (added in this release)
  // and the `subAbilitiesUnderDescription` / `subAbilitiesUnderOvercharge`
  // arrays (added with the Sub-Abilities feature). Existing records default
  // to true / [] so every ability keeps its Activate button and has empty
  // sub-ability lists until a user explicitly adds one.
  const normalizeBlock = (a: AbilityBlock): AbilityBlock => {
    const cost = (a.cost ?? {}) as AbilityCost
    const rawCustom: unknown =
      (cost as unknown as Record<string, unknown>).custom
    // Backfill `cost.custom` (added with the Custom Ability Costs feature):
    // keep only finite positive number entries so downstream code never sees
    // garbage from hand-edited exports.
    let custom: Record<string, number> | undefined
    if (rawCustom && typeof rawCustom === 'object') {
      custom = {}
      for (const [id, amount] of Object.entries(
        rawCustom as Record<string, unknown>,
      )) {
        if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
          custom[id] = amount
        }
      }
      if (Object.keys(custom).length === 0) custom = undefined
    }
    // Sanitize stat/attribute modifiers (added with the Ability Modifiers
    // feature): unknown targets and non-finite values are dropped, and the
    // switch is only kept meaningful when at least one modifier survives.
    // Both keys are omitted entirely when unused so stored shapes stay lean.
    const modifiers = normalizeModifiers(a.modifiers)
    const normalized: AbilityBlock = {
      ...a,
      cost: { ...cost, ...(custom ? { custom } : {}) },
      showActivate: a.showActivate ?? true,
      subAbilitiesUnderDescription: Array.isArray(a.subAbilitiesUnderDescription)
        ? a.subAbilitiesUnderDescription
        : [],
      subAbilitiesUnderOvercharge: Array.isArray(a.subAbilitiesUnderOvercharge)
        ? a.subAbilitiesUnderOvercharge
        : [],
    }
    if (modifiers.length > 0) {
      normalized.modifiers = modifiers
      normalized.modifiersActive = a.modifiersActive === true
    } else {
      delete (normalized as unknown as Record<string, unknown>).modifiers
      delete (normalized as unknown as Record<string, unknown>).modifiersActive
    }
    // Sanitize the limited-use budget (added with the Limited Uses feature):
    // a malformed entry reads as unlimited, and a negative / over-max remaining
    // count is clamped back into range so the card's meter can never overflow.
    const uses = normalizeAbilityUses(a.uses)
    if (uses) {
      normalized.uses = uses
    } else {
      delete (normalized as unknown as Record<string, unknown>).uses
    }
    // Sanitize the automatic activation rolls (added with the Roll Dice on
    // Activation feature): entries with no expression, an unknown accuracy
    // attribute and so on are dropped, and the key is omitted entirely when the
    // ability rolls nothing — so an older record and a hand-edited export both
    // load as "this ability rolls nothing on activation" rather than crashing
    // the roller mid-activation.
    const activationRolls = normalizeActivationRolls(a.activationRolls)
    if (activationRolls) {
      normalized.activationRolls = activationRolls
    } else {
      delete (normalized as unknown as Record<string, unknown>).activationRolls
    }
    // Sub-Abilities carry the same shape (and can be limited too) but are never
    // recursively visited by the caller, so sanitize one nesting level here.
    // Sub-Abilities cannot have sub-abilities of their own, so one pass ends it.
    const subArrays: ('subAbilitiesUnderDescription' | 'subAbilitiesUnderOvercharge')[] = [
      'subAbilitiesUnderDescription',
      'subAbilitiesUnderOvercharge',
    ]
    for (const key of subArrays) {
      normalized[key] = normalized[key].map((sub) => {
        const subUses = normalizeAbilityUses(sub.uses)
        const subActivationRolls = normalizeActivationRolls(sub.activationRolls)
        const nextSub: AbilityBlock = {
          ...sub,
          cost: (sub.cost ?? {}) as AbilityCost,
          showActivate: sub.showActivate ?? true,
        }
        if (subUses) nextSub.uses = subUses
        else delete (nextSub as unknown as Record<string, unknown>).uses
        if (subActivationRolls) nextSub.activationRolls = subActivationRolls
        else delete (nextSub as unknown as Record<string, unknown>).activationRolls
        return nextSub
      })
    }
    return normalized
  }

  const blockArrays: (keyof Character)[] = [
    'innateAbilities',
    'slottedAbilities',
    'abilityPool',
  ]
  for (const key of blockArrays) {
    const arr = result[key] as unknown as AbilityBlock[] | undefined
    if (Array.isArray(arr)) {
      ;(result as unknown as Record<string, unknown>)[key] = arr.map(
        normalizeBlock,
      )
    }
  }
  // Also normalize custom-tab sections: stamp the `kind` discriminator on
  // legacy sections (which predate NPC sections and lack the field) and
  // normalize nested ability blocks' `showActivate` flag.
  if (Array.isArray(result.customTabs)) {
    result.customTabs = result.customTabs.map((tab) => ({
      ...tab,
      sections: tab.sections.map((rawSection) => {
        const section = rawSection as unknown as {
          kind?: 'ability' | 'npc' | 'text'
          id: string
          name: string
          npcId?: string
          abilities?: AbilityBlock[]
          content?: string
        }
        // NPC sections reference a bundled NPC record.
        if (section.kind === 'npc' && typeof section.npcId === 'string') {
          return {
            kind: 'npc' as const,
            id: section.id,
            name: section.name,
            npcId: section.npcId,
          }
        }
        // Text sections carry a free-form Markdown body.
        if (section.kind === 'text') {
          return {
            kind: 'text' as const,
            id: section.id,
            name: section.name,
            content: section.content ?? '',
          }
        }
        // Legacy ability sections have no `kind` and always hold abilities.
        return {
          kind: 'ability' as const,
          id: section.id,
          name: section.name,
          abilities: (section.abilities ?? []).map(normalizeBlock),
        }
      }),
    }))
  }

  // Ensure customTabs exists (migration for older records without it).
  if (!Array.isArray(result.customTabs)) {
    result.customTabs = []
  }

  // Ensure customResourceBars exists (migration for records without it).
  if (!Array.isArray(result.customResourceBars)) {
    result.customResourceBars = []
  }

  // Ensure customAttributes exists and every entry is usable (migration for
  // records created before the feature, and a guard against hand-edited JSON:
  // an attribute without a name could never be referenced in dice notation).
  result.customAttributes = normalizeCustomAttributes(result.customAttributes)

  // Ensure labels exists and every entry carries id/name/value (migration
  // for records created before the labels feature; also guards against
  // hand-edited JSON missing the value field).
  if (!Array.isArray(result.labels)) {
    result.labels = []
  } else {
    result.labels = result.labels
      .filter((l): l is SheetLabel => !!l && typeof l === 'object')
      .map((l) => ({
        id: typeof l.id === 'string' ? l.id : generateId(),
        name: typeof l.name === 'string' ? l.name : '',
        value: typeof l.value === 'string' ? l.value : '',
      }))
  }

  // Ensure importedFonts exists inside config (migration for characters created
  // before the Google Fonts import feature was added).
  if (
    !Array.isArray(
      (result.config as unknown as Record<string, unknown>).importedFonts,
    )
  ) {
    ;(result.config as unknown as Record<string, unknown>).importedFonts = []
  }

  // Ensure every SheetColors key exists (migration for records saved before a
  // palette color was added — most recently tokenMortalWounds, which arrived
  // with the NPC Mortal Wounds stat). A missing key is not merely a cosmetic
  // default: it leaves the matching CSS variable unset, so the stat token that
  // reads it renders with no stripe and no accent, and the Customize drawer's
  // swatch/hex input gets an undefined value. User-set colors always win over
  // the defaults merged in here.
  const storedColors = (
    result.config as unknown as { colors?: Partial<SheetColors> } | undefined
  )?.colors
  result.config = {
    ...result.config,
    colors: { ...DEFAULT_SHEET_COLORS, ...(storedColors ?? {}) },
  }

  // Ensure scalar AbilityBlock shapes (basicAttack, fatebreaker) carry
  // showActivate and sub-ability arrays too.
  const scalarBlocks: (keyof Character)[] = ['basicAttack', 'fatebreaker']
  for (const key of scalarBlocks) {
    const block = result[key] as unknown as AbilityBlock | undefined
    if (block && typeof block === 'object') {
      ;(result as unknown as Record<string, unknown>)[key] = normalizeBlock(block)
    }
  }

  // Ensure kind is set (migration for records created before the NPC feature).
  if (!result.kind) {
    result.kind = 'character'
  }

  // Ensure npcStats exists for NPCs (migration for records without it).
  if (result.kind === 'npc' && !result.npcStats) {
    result.npcStats = {
      evasion: 10,
      armor: 0,
      movement: 5,
      saveDC: 10,
      hp: 20,
      mortalWounds: 0,
    }
  }

  // Migration for NPC records predating the mortalWounds stat — backfill
  // the new field with 0 so existing sheets load cleanly.
  if (result.kind === 'npc' && result.npcStats) {
    const ns = result.npcStats as Partial<NPCStats>
    if (typeof ns.mortalWounds !== 'number') {
      result.npcStats = { ...ns, mortalWounds: 0 } as NPCStats
    }
  }

  // Ensure description exists for NPCs (migration for records without it).
  if (result.kind === 'npc' && result.description == null) {
    result.description = ''
  }

  // Ensure viewModes exists and is complete (migration for records created
  // before view-modes were persisted). Build a full shape so any tabs or
  // sections present in customTabs get an entry — existing choices preserved,
  // new ones default to 'grid'.
  const rawRecord = result as unknown as Record<string, unknown>
  const existing =
    rawRecord.viewModes && typeof rawRecord.viewModes === 'object'
      ? (rawRecord.viewModes as Partial<CharacterViewModes>)
      : null
  const customTabModes: Record<string, Record<string, 'grid' | 'list'>> = {
    ...(existing?.customTabs ?? {}),
  }
  for (const tab of result.customTabs) {
    if (!customTabModes[tab.id]) customTabModes[tab.id] = {}
    for (const section of tab.sections) {
      if (!customTabModes[tab.id][section.id]) {
        customTabModes[tab.id][section.id] = 'grid'
      }
    }
  }
  result.viewModes = {
    slottedAbilities: existing?.slottedAbilities ?? 'grid',
    abilityPool: existing?.abilityPool ?? 'grid',
    customTabs: customTabModes,
  } satisfies CharacterViewModes

  return result as Character
}

/**
 * Return a copy of the character WITHOUT the `labels` field.
 *
 * Labels are local organizational metadata (list-page filter targets) and
 * deliberately never travel with an exported sheet — see exportImport.
 */
export function stripLabels(character: Character): Character {
  const { labels: _labels, ...rest } = character
  // Cast is safe: normalizeCharacter guarantees records carry `labels`, so
  // the only consumer impact of omitting it here is the stripped export.
  return rest as Character
}

/**
 * Load every stored character, ordered by creation date (oldest first).
 *
 * A single unreadable record is skipped (and logged) rather than failing the
 * whole load — losing the entire roster because one sheet is malformed would
 * be far worse than losing the one.
 */
export async function getAllCharacters(): Promise<Character[]> {
  return withConnection(async (db) => {
    const tx = db.transaction(CHAR_STORE, 'readonly')
    const store = tx.objectStore(CHAR_STORE)
    const all = await promisifyRequest<Character[]>(store.getAll())
    const characters: Character[] = []
    for (const raw of all) {
      try {
        characters.push(normalizeCharacter(raw))
      } catch (err) {
        console.error('[grimoire] skipping an unreadable character record:', err, raw)
      }
    }
    return characters.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

/**
 * Fetch a single character by id, or `null` if not found.
 */
export async function getCharacter(id: string): Promise<Character | null> {
  return withConnection(async (db) => {
    const tx = db.transaction(CHAR_STORE, 'readonly')
    const store = tx.objectStore(CHAR_STORE)
    const result = await promisifyRequest<Character | undefined>(store.get(id))
    return result ? normalizeCharacter(result) : null
  })
}

/** Insert or replace a character record. */
export async function putCharacter(char: Character): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(CHAR_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(CHAR_STORE).put(char))
  })
}

/** Remove a character record by id. No-op if the id doesn't exist. */
export async function deleteCharacter(id: string): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(CHAR_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(CHAR_STORE).delete(id))
  })
}

// ---- Version snapshots --------------------------------------------------------

/**
 * Store a new {@link VersionSnapshot}. Returns the snapshot object as stored.
 */
export async function putVersionSnapshot(
  snapshot: VersionSnapshot,
): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(VERSION_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(VERSION_STORE).put(snapshot))
  })
}

/**
 * Fetch every snapshot for a given character, newest first.
 */
export async function getVersionHistory(
  characterId: string,
): Promise<VersionSnapshot[]> {
  return withConnection(async (db) => {
    const tx = db.transaction(VERSION_STORE, 'readonly')
    const store = tx.objectStore(VERSION_STORE)
    const index = store.index('characterId')
    const all = await promisifyRequest<VersionSnapshot[]>(
      index.getAll(characterId),
    )
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })
}

/** Delete a single version snapshot by id. */
export async function deleteVersionSnapshot(id: string): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(VERSION_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(VERSION_STORE).delete(id))
  })
}

// ---- Roll log --------------------------------------------------------

import type { RollLogEntry } from '@/types'

/** Persist a roll-log entry. */
export async function putRollLogEntry(entry: RollLogEntry): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(ROLL_LOG_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(ROLL_LOG_STORE).put(entry))
  })
}

/** Fetch every roll-log entry for a character, newest first. */
export async function getRollLogForCharacter(
  characterId: string,
): Promise<RollLogEntry[]> {
  return withConnection(async (db) => {
    const tx = db.transaction(ROLL_LOG_STORE, 'readonly')
    const store = tx.objectStore(ROLL_LOG_STORE)
    const index = store.index('characterId')
    const all = await promisifyRequest<RollLogEntry[]>(
      index.getAll(characterId),
    )
    return all.sort((a, b) => b.rolledAt.localeCompare(a.rolledAt))
  })
}

/** Fetch every roll-log entry across all characters, newest first. */
export async function getAllRollLogEntries(): Promise<RollLogEntry[]> {
  return withConnection(async (db) => {
    const tx = db.transaction(ROLL_LOG_STORE, 'readonly')
    const store = tx.objectStore(ROLL_LOG_STORE)
    const all = await promisifyRequest<RollLogEntry[]>(store.getAll())
    return all.sort((a, b) => b.rolledAt.localeCompare(a.rolledAt))
  })
}

/** Delete a single roll-log entry by id. */
export async function deleteRollLogEntry(id: string): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(ROLL_LOG_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(ROLL_LOG_STORE).delete(id))
  })
}

/** Delete every roll-log entry for a character. */
export async function clearRollLogForCharacter(
  characterId: string,
): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(ROLL_LOG_STORE, 'readwrite')
    const store = tx.objectStore(ROLL_LOG_STORE)
    const index = store.index('characterId')
    const keys = await promisifyRequest<IDBValidKey[]>(
      index.getAllKeys(characterId),
    )
    for (const key of keys) {
      store.delete(key)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  })
}

// ---- Status conditions --------------------------------------------------------

/**
 * Normalize a status condition to the latest schema, back-filling any missing
 * fields so downstream code never sees `undefined` for `icon`, `tags`, or
 * timestamps. Idempotent.
 */
export function normalizeStatus(raw: StatusCondition): StatusCondition {
  return {
    id: raw.id,
    name: raw.name ?? '',
    icon: raw.icon ?? '',
    iconType: raw.iconType ?? 'emoji',
    description: raw.description ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
  }
}

/** Load every stored status condition, ordered by name. */
export async function getAllStatuses(): Promise<StatusCondition[]> {
  return withConnection(async (db) => {
    const tx = db.transaction(STATUS_STORE, 'readonly')
    const store = tx.objectStore(STATUS_STORE)
    const all = await promisifyRequest<StatusCondition[]>(store.getAll())
    return all
      .map(normalizeStatus)
      .sort((a, b) => a.name.localeCompare(b.name))
  })
}

/** Fetch a single status condition by id, or `null` if not found. */
export async function getStatus(id: string): Promise<StatusCondition | null> {
  return withConnection(async (db) => {
    const tx = db.transaction(STATUS_STORE, 'readonly')
    const store = tx.objectStore(STATUS_STORE)
    const result = await promisifyRequest<StatusCondition | undefined>(
      store.get(id),
    )
    return result ? normalizeStatus(result) : null
  })
}

/** Insert or replace a status condition record. */
export async function putStatus(status: StatusCondition): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(STATUS_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(STATUS_STORE).put(status))
  })
}

/** Remove a status condition record by id. No-op if the id doesn't exist. */
export async function deleteStatus(id: string): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(STATUS_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(STATUS_STORE).delete(id))
  })
}

// ---- GM Screens ---------------------------------------------------------------

/**
 * Normalize a freshly-loaded {@link GMScreen} to the latest schema.
 *
 * Follows the established migration pattern: backfill on read rather than
 * running a bulk migration. Guarantees `panels` is an array, that every panel
 * carries `id`/`density`/`statuses`, that NPC-instance panels carry a complete
 * {@link NpcInstanceState}, and that both timestamps are present. Idempotent,
 * so it is safe to run on already-normalized records.
 */
export function normalizeScreen(raw: GMScreen): GMScreen {
  const o = (raw ?? {}) as unknown as Record<string, unknown>
  const now = new Date().toISOString()
  const createdAt = typeof o.createdAt === 'string' ? o.createdAt : now
  const rawPanels = Array.isArray(o.panels) ? o.panels : []

  const panels: ScreenPanel[] = []
  for (const rawPanel of rawPanels) {
    if (!rawPanel || typeof rawPanel !== 'object') continue
    const p = rawPanel as unknown as Record<string, unknown>
    const id = typeof p.id === 'string' && p.id ? p.id : generateId()
    const density = p.density === 'expanded' ? 'expanded' : 'compact'
    const statuses = normalizePanelStatuses(p.statuses)

    if (p.kind === 'npc-instance') {
      if (typeof p.baseNpcId !== 'string' || !p.baseNpcId) continue
      const rawState = (p.state ?? {}) as Partial<NpcInstanceState>
      const currentHP =
        typeof rawState.currentHP === 'number' && Number.isFinite(rawState.currentHP)
          ? rawState.currentHP
          : 0
      const tempHP =
        typeof rawState.tempHP === 'number' && Number.isFinite(rawState.tempHP)
          ? Math.max(0, rawState.tempHP)
          : 0
      const condition: NpcInstanceState['condition'] =
        rawState.condition === 'downed' || rawState.condition === 'dead'
          ? rawState.condition
          : 'active'
      // Live-play fields added with NPC AP + Recharge tracking. Screens written
      // before they existed simply have no `currentAP`/`cooldowns`, which
      // backfills to a full turn with nothing cooling.
      const currentAP =
        typeof rawState.currentAP === 'number' && Number.isFinite(rawState.currentAP)
          ? Math.min(MAX_AP, Math.max(0, Math.round(rawState.currentAP)))
          : MAX_AP
      const cooldowns = Array.isArray(rawState.cooldowns)
        ? [
            ...new Set(
              rawState.cooldowns.filter(
                (abilityId): abilityId is string =>
                  typeof abilityId === 'string' && abilityId !== '',
              ),
            ),
          ]
        : []
      // Mortal Wound track, added with NPC-instance mortal wounds. Screens
      // written before it existed have no `mortalWounds` on the instance, which
      // backfills to an empty track; the allowance itself is never stored here
      // (it is read from the base's `npcStats` at damage/render time).
      const mortalWounds = normalizeInstanceMortalWounds(rawState.mortalWounds)
      // Per-instance ability uses, added with NPC-instance limited-use tracking.
      // Screens written before it existed have no `abilityUses`, which backfills
      // to an empty map — every limited ability then reads as its authored
      // maximum, i.e. a fresh instance (see lib/abilityUses.ts).
      const abilityUses = normalizeInstanceAbilityUses(rawState.abilityUses)
      // Per-instance modifier switches, added with NPC-instance ability
      // modifiers. Missing (or unusable) entries backfill to an empty map: the
      // instance then matches its base record's own switch state.
      const abilityModifiers = normalizeInstanceAbilityModifiers(
        rawState.abilityModifiers,
      )
      panels.push({
        kind: 'npc-instance',
        id,
        baseNpcId: p.baseNpcId,
        label: typeof p.label === 'string' ? p.label : '',
        density,
        statuses,
        state: {
          currentHP: Math.max(0, currentHP),
          tempHP,
          condition,
          currentAP,
          cooldowns,
          mortalWounds,
          abilityUses,
          abilityModifiers,
        },
      })
      continue
    }

    // Character panels are the default: the union's other arm.
    if (typeof p.characterId !== 'string' || !p.characterId) continue
    panels.push({
      kind: 'character',
      id,
      characterId: p.characterId,
      density,
      statuses,
    })
  }

  return {
    id: typeof o.id === 'string' ? o.id : generateId(),
    name: typeof o.name === 'string' && o.name ? o.name : 'Untitled Screen',
    panels,
    createdAt,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : createdAt,
  }
}

/**
 * Normalize a panel's tracked-status list: drop entries that carry no usable
 * status reference or an unknown duration, repair the stack count to a whole
 * number in `[1, MAX_PANEL_STATUS_STACKS]`, and drop duplicate references
 * (one entry per status per panel — the picker's upsert semantic).
 *
 * Screens written before status tracking existed simply have no `statuses`
 * field, which backfills to an empty list.
 */
function normalizePanelStatuses(raw: unknown): PanelStatus[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const statuses: PanelStatus[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const statusId = typeof e.statusId === 'string' ? e.statusId : ''
    if (!statusId || seen.has(statusId)) continue
    if (!isPanelStatusDuration(e.duration)) continue
    seen.add(statusId)
    const stacks =
      typeof e.stacks === 'number' && Number.isFinite(e.stacks)
        ? Math.min(MAX_PANEL_STATUS_STACKS, Math.max(1, Math.floor(e.stacks)))
        : 1
    statuses.push({ statusId, duration: e.duration, stacks })
  }
  return statuses
}

/**
 * Normalize an NPC instance's Mortal Wound track: keep only entries that carry
 * a usable wound name, and repair the D20 to a whole face of the die (entries
 * whose roll is off-table keep their name — the wound is what the panel shows —
 * and fall back to the table lookup at render time).
 *
 * Screens written before instance mortal wounds existed simply have no
 * `mortalWounds` field, which backfills to an empty track.
 */
function normalizeInstanceMortalWounds(raw: unknown): MortalWoundRoll[] {
  if (!Array.isArray(raw)) return []
  const wounds: MortalWoundRoll[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name : ''
    if (!name) continue
    const rawRoll = typeof e.roll === 'number' && Number.isFinite(e.roll) ? Math.round(e.roll) : 0
    wounds.push({ roll: rawRoll >= 1 && rawRoll <= 20 ? rawRoll : 0, name })
  }
  return wounds
}

/**
 * Load every saved GM screen, ordered by creation date (oldest first).
 *
 * A single unreadable record is skipped (and logged) rather than failing the
 * whole load — losing every screen because one is malformed would be far worse
 * than losing the one.
 */
export async function getAllScreens(): Promise<GMScreen[]> {
  return withConnection(async (db) => {
    const tx = db.transaction(SCREEN_STORE, 'readonly')
    const store = tx.objectStore(SCREEN_STORE)
    const all = await promisifyRequest<GMScreen[]>(store.getAll())
    const screens: GMScreen[] = []
    for (const raw of all) {
      try {
        screens.push(normalizeScreen(raw))
      } catch (err) {
        console.error('[grimoire] skipping an unreadable GM screen record:', err, raw)
      }
    }
    return screens.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

/** Fetch a single GM screen by id, or `null` if not found. */
export async function getScreen(id: string): Promise<GMScreen | null> {
  return withConnection(async (db) => {
    const tx = db.transaction(SCREEN_STORE, 'readonly')
    const store = tx.objectStore(SCREEN_STORE)
    const result = await promisifyRequest<GMScreen | undefined>(store.get(id))
    return result ? normalizeScreen(result) : null
  })
}

/** Insert or replace a GM screen record. */
export async function putScreen(screen: GMScreen): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(SCREEN_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(SCREEN_STORE).put(screen))
  })
}

/** Remove a GM screen record by id. No-op if the id doesn't exist. */
export async function deleteScreen(id: string): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(SCREEN_STORE, 'readwrite')
    await promisifyRequest(tx.objectStore(SCREEN_STORE).delete(id))
  })
}

// ---- Full backup / restore --------------------------------------------------

/**
 * Fetch every version snapshot across ALL characters, oldest first.
 * Used by the full-backup export (Settings → Backup & Restore).
 */
export async function getAllVersionSnapshots(): Promise<VersionSnapshot[]> {
  return withConnection(async (db) => {
    const tx = db.transaction(VERSION_STORE, 'readonly')
    const all = await promisifyRequest<VersionSnapshot[]>(
      tx.objectStore(VERSION_STORE).getAll(),
    )
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

/** Record payload for a wholesale data replacement ({@link replaceAllData}). */
export interface ReplaceAllDataInput {
  characters: Character[]
  versions: VersionSnapshot[]
  rollLogs: RollLogEntry[]
  statuses: StatusCondition[]
  screens: GMScreen[]
}

/**
 * Replace the ENTIRE contents of all five object stores with the provided
 * records — the restore half of the full-backup flow.
 *
 * Everything happens in a SINGLE readwrite transaction over all stores: the
 * clears and puts either all commit or all roll back, so a failed restore can
 * never leave the database half-old / half-new.
 */
export async function replaceAllData(data: ReplaceAllDataInput): Promise<void> {
  return withConnection(async (db) => {
    const tx = db.transaction(
      [CHAR_STORE, VERSION_STORE, ROLL_LOG_STORE, STATUS_STORE, SCREEN_STORE],
      'readwrite',
    )
    const charStore = tx.objectStore(CHAR_STORE)
    const versionStore = tx.objectStore(VERSION_STORE)
    const rollLogStore = tx.objectStore(ROLL_LOG_STORE)
    const statusStore = tx.objectStore(STATUS_STORE)
    const screenStore = tx.objectStore(SCREEN_STORE)

    charStore.clear()
    for (const char of data.characters) charStore.put(char)
    versionStore.clear()
    for (const snapshot of data.versions) versionStore.put(snapshot)
    rollLogStore.clear()
    for (const entry of data.rollLogs) rollLogStore.put(entry)
    statusStore.clear()
    for (const status of data.statuses) statusStore.put(status)
    screenStore.clear()
    // Older payloads (backup v1) carry no screens — that intentionally wipes
    // the store, matching the documented replace-everything semantics.
    for (const screen of data.screens ?? []) screenStore.put(screen)

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () =>
        reject(tx.error ?? new Error('Restore transaction aborted'))
      tx.onerror = () => reject(tx.error)
    })
  })
}
