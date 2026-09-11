/**
 * Unit tests for the GM Screen store — screen CRUD, panel operations, the
 * duplicate-character guard, instance auto-labeling, instance live state
 * (damage / heal / downed), and per-screen debounced autosave.
 *
 * IndexedDB is mocked so the store can be exercised in isolation, mirroring
 * the pattern in characterStore.test.ts.
 */

import { test, expect, beforeEach, afterEach, vi } from 'vitest'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useCharacterStore } from '@/store/characterStore'
import { createDefaultCharacter, createDefaultNPC } from '@/constants/gameData'
import type { Character, GMScreen } from '@/types'

// ---- Mock IndexedDB -------------------------------------------------------

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  // Screens.
  getAllScreens: vi.fn(async () => Array.from(dbMap.values())),
  getScreen: vi.fn(async (id: string) => dbMap.get(id) ?? null),
  putScreen: vi.fn(async (screen: GMScreen) => {
    dbMap.set(screen.id, screen)
  }),
  deleteScreen: vi.fn(async (id: string) => {
    dbMap.delete(id)
  }),
  normalizeScreen: (screen: GMScreen) => screen,
  // characterStore imports the db layer too (it self-loads on import), so the
  // full surface must be present here as well — see .hermes.md.
  getAllCharacters: vi.fn(async () => []),
  getCharacter: vi.fn(async () => null),
  putCharacter: vi.fn(async () => {}),
  deleteCharacter: vi.fn(async () => {}),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  putRollLogEntry: vi.fn(async () => {}),
  getRollLogForCharacter: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async () => {}),
  clearRollLogForCharacter: vi.fn(async () => {}),
  normalizeCharacter: (char: Character) => char,
  stripLabels: ({ labels: _labels, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getStatus: vi.fn(async () => null),
  putStatus: vi.fn(async () => {}),
  deleteStatus: vi.fn(async () => {}),
  normalizeStatus: (s: unknown) => s,
  getAllVersionSnapshots: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
}))

// ---- Helpers --------------------------------------------------------------

/** A player character with predictable combat stats. */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  const base = createDefaultCharacter()
  return {
    ...base,
    attributes: { MAR: 3, POW: 4, AGI: 1, VIT: 2, GRT: 3 },
    currentHP: 30,
    ...overrides,
  }
}

/** An NPC base with the given max HP and armor. */
function makeNpc(overrides: Partial<Character> = {}): Character {
  const base = createDefaultNPC()
  return {
    ...base,
    name: 'Bandit',
    npcStats: { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 },
    ...overrides,
  }
}

/** Seed the character list (GM screen panels resolve entities from it). */
function seedCharacters(...chars: Character[]) {
  useCharacterStore.setState({ characters: chars, currentCharacter: null })
}

beforeEach(() => {
  dbMap.clear()
  localStorage.clear()
  useGMScreenStore.setState({
    screens: [],
    currentScreenId: null,
    isLoaded: false,
    isSaving: false,
    loadError: null,
  })
  useCharacterStore.setState({ characters: [], currentCharacter: null })
})

afterEach(() => {
  vi.useRealTimers()
  // The Recharge Die tests pin Math.random; never leak that into the next test.
  vi.restoreAllMocks()
})

// ---- Screen CRUD ----------------------------------------------------------

test('createScreen: persists, selects, and names the new screen', async () => {
  const screen = await useGMScreenStore.getState().createScreen('Session 4')

  expect(screen.name).toBe('Session 4')
  expect(screen.panels).toEqual([])
  expect(useGMScreenStore.getState().currentScreenId).toBe(screen.id)
  expect(dbMap.get(screen.id)).toEqual(screen)
  expect(localStorage.getItem('grimoire.lastGMScreenId')).toBe(screen.id)
})

test('createScreen: defaults to "Untitled Screen" when unnamed', async () => {
  const screen = await useGMScreenStore.getState().createScreen()
  expect(screen.name).toBe('Untitled Screen')
})

test('renameScreen: updates the name and autosaves the screen', async () => {
  vi.useFakeTimers()
  const screen = await useGMScreenStore.getState().createScreen('Draft')
  dbMap.clear()

  useGMScreenStore.getState().renameScreen(screen.id, 'Dungeon Run')
  expect(useGMScreenStore.getState().screens[0].name).toBe('Dungeon Run')

  await vi.advanceTimersByTimeAsync(600)
  expect((dbMap.get(screen.id) as GMScreen).name).toBe('Dungeon Run')
})

test('deleteScreen: removes it and selects the next screen', async () => {
  const a = await useGMScreenStore.getState().createScreen('A')
  const b = await useGMScreenStore.getState().createScreen('B')

  // Delete B (currently selected) — falls back to A.
  await useGMScreenStore.getState().deleteScreen(b.id)

  const state = useGMScreenStore.getState()
  expect(state.screens.map((s) => s.id)).toEqual([a.id])
  expect(state.currentScreenId).toBe(a.id)
  expect(dbMap.has(b.id)).toBe(false)
  expect(localStorage.getItem('grimoire.lastGMScreenId')).toBe(a.id)
})

test('deleteScreen: deleting the last screen clears the selection', async () => {
  const only = await useGMScreenStore.getState().createScreen('Only')
  await useGMScreenStore.getState().deleteScreen(only.id)
  expect(useGMScreenStore.getState().currentScreenId).toBeNull()
  expect(localStorage.getItem('grimoire.lastGMScreenId')).toBeNull()
})

test('selectScreen: persists the open screen across reloads', async () => {
  const a = await useGMScreenStore.getState().createScreen('A')
  const b = await useGMScreenStore.getState().createScreen('B')

  useGMScreenStore.getState().selectScreen(a.id)
  expect(useGMScreenStore.getState().currentScreenId).toBe(a.id)

  // Simulate a reload: in-memory state dropped, localStorage survives.
  useGMScreenStore.setState({ screens: [], currentScreenId: null, isLoaded: false })
  await useGMScreenStore.getState().loadScreens()

  expect(useGMScreenStore.getState().currentScreenId).toBe(a.id)
  expect(useGMScreenStore.getState().currentScreen()!.name).toBe('A')
  expect(useGMScreenStore.getState().screens.map((s) => s.id)).toEqual([a.id, b.id])
})

test('loadScreens: falls back to the first screen when the remembered one is gone', async () => {
  const a = await useGMScreenStore.getState().createScreen('A')
  useGMScreenStore.getState().selectScreen('deleted-id')

  useGMScreenStore.setState({ screens: [], currentScreenId: 'deleted-id', isLoaded: false })
  await useGMScreenStore.getState().loadScreens()

  expect(useGMScreenStore.getState().currentScreenId).toBe(a.id)
})

// ---- Character panels -----------------------------------------------------

test('addCharacterPanel: adds a compact panel and returns true', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const pc = makeCharacter({ id: 'c1' })

  expect(useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')).toBe(true)

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels).toHaveLength(1)
  expect(panels[0]).toMatchObject({ kind: 'character', characterId: 'c1', density: 'compact' })
  expect(pc.id).toBe('c1')
})

test('addCharacterPanel: rejects a duplicate character with no state change', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')

  expect(useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')).toBe(false)
  expect(useGMScreenStore.getState().screens[0].panels).toHaveLength(1)
})

test('duplicatePanel: refuses to duplicate a character panel', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id

  expect(useGMScreenStore.getState().duplicatePanel(screen.id, panelId)).toBeNull()
  expect(useGMScreenStore.getState().screens[0].panels).toHaveLength(1)
})

// ---- NPC instances --------------------------------------------------------

test('addNpcInstancePanel: spawns at full HP with the base name', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const npc = makeNpc({ id: 'n1' })
  seedCharacters(npc)

  useGMScreenStore.getState().addNpcInstancePanel(screen.id, npc.id)

  const panel = useGMScreenStore.getState().screens[0].panels[0]
  expect(panel).toMatchObject({
    kind: 'npc-instance',
    baseNpcId: 'n1',
    label: 'Bandit',
    state: { currentHP: 20, tempHP: 0, condition: 'active' },
  })
})

test('addNpcInstancePanel: auto-numbers subsequent instances of the same base', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const npc = makeNpc({ id: 'n1' })
  seedCharacters(npc)
  const store = useGMScreenStore.getState()

  store.addNpcInstancePanel(screen.id, npc.id)
  store.addNpcInstancePanel(screen.id, npc.id)
  store.addNpcInstancePanel(screen.id, npc.id)

  const labels = useGMScreenStore
    .getState()
    .screens[0].panels.map((p) => (p.kind === 'npc-instance' ? p.label : ''))
  expect(labels).toEqual(['Bandit', 'Bandit 2', 'Bandit 3'])
})

test('addNpcInstancePanel: an explicit label wins over auto-numbering', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const npc = makeNpc({ id: 'n1' })
  seedCharacters(npc)

  useGMScreenStore.getState().addNpcInstancePanel(screen.id, npc.id, '  Captain  ')

  const panel = useGMScreenStore.getState().screens[0].panels[0]
  expect(panel.kind === 'npc-instance' && panel.label).toBe('Captain')
})

test('instances of the same base keep independent HP', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const npc = makeNpc({ id: 'n1' })
  seedCharacters(npc)
  const store = useGMScreenStore.getState()
  store.addNpcInstancePanel(screen.id, npc.id)
  store.addNpcInstancePanel(screen.id, npc.id)
  const [first, second] = useGMScreenStore.getState().screens[0].panels

  useGMScreenStore.getState().damageInstance(screen.id, first.id, 8)

  const panels = useGMScreenStore.getState().screens[0].panels
  const a = panels.find((p) => p.id === first.id)
  const b = panels.find((p) => p.id === second.id)
  expect(a?.kind === 'npc-instance' && a.state.currentHP).toBe(12)
  expect(b?.kind === 'npc-instance' && b.state.currentHP).toBe(20)
})

test('duplicatePanel: spawns a fresh instance at full HP with a new label', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const npc = makeNpc({ id: 'n1' })
  seedCharacters(npc)
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, npc.id)
  const original = useGMScreenStore.getState().screens[0].panels[0]

  // Damage the original first: the duplicate must NOT inherit its HP.
  useGMScreenStore.getState().damageInstance(screen.id, original.id, 15)
  const copyId = useGMScreenStore.getState().duplicatePanel(screen.id, original.id)

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels).toHaveLength(2)
  expect(copyId).not.toBe(original.id)
  const copy = panels.find((p) => p.id === copyId)
  expect(copy?.kind === 'npc-instance' && copy.label).toBe('Bandit 2')
  expect(copy?.kind === 'npc-instance' && copy.state.currentHP).toBe(20)
})

test('renameInstance: renames only the targeted instance', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const npc = makeNpc({ id: 'n1' })
  seedCharacters(npc)
  const store = useGMScreenStore.getState()
  store.addNpcInstancePanel(screen.id, npc.id)
  store.addNpcInstancePanel(screen.id, npc.id)
  const [first, second] = useGMScreenStore.getState().screens[0].panels

  useGMScreenStore.getState().renameInstance(screen.id, first.id, 'Scout')

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels.find((p) => p.id === first.id)).toMatchObject({ label: 'Scout' })
  expect(panels.find((p) => p.id === second.id)).toMatchObject({ label: 'Bandit 2' })
})

// ---- Instance live state --------------------------------------------------

test('damageInstance: reduces HP by the raw amount with no armor', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  const result = useGMScreenStore.getState().damageInstance(screen.id, panel.id, 7)

  expect(result?.hpLost).toBe(7)
  expect(result?.finalHP).toBe(13)
  expect(result?.downed).toBe(false)
})

test('damageInstance: temp HP absorbs damage before HP', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  useGMScreenStore.getState().setInstanceTempHP(screen.id, panel.id, 5)

  const result = useGMScreenStore.getState().damageInstance(screen.id, panel.id, 8)

  expect(result?.tempHPConsumed).toBe(5)
  expect(result?.hpLost).toBe(3)
  expect(result?.finalHP).toBe(17)
  const after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.tempHP).toBe(0)
})

test('damageInstance: bypassTempHP ignores the temp pool', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  useGMScreenStore.getState().setInstanceTempHP(screen.id, panel.id, 5)

  useGMScreenStore.getState().damageInstance(screen.id, panel.id, 4, { ignoreTempHP: true })

  const after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.currentHP).toBe(16)
  expect(after.kind === 'npc-instance' && after.state.tempHP).toBe(5)
})

test('damageInstance: armor comes from the base npcStats', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1', npcStats: { evasion: 10, armor: 2, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 } }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  // 2 armor points → 2d6 reduction, so damage is 10 - (2..12) ∈ [0, 8].
  const result = useGMScreenStore.getState().damageInstance(screen.id, panel.id, 10, { applyArmor: true })

  expect(result).not.toBeNull()
  expect(result!.afterArmor).toBeLessThanOrEqual(8)
  expect(result!.afterArmor).toBeGreaterThanOrEqual(0)
  expect(result!.hpLost).toBeLessThanOrEqual(8)
})

test('damageInstance: resistance halves the damage after armor', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  const result = useGMScreenStore.getState().damageInstance(screen.id, panel.id, 9, { resistant: true })

  expect(result?.afterResistance).toBe(4)
  expect(result?.finalHP).toBe(16)
})

test('damageInstance: reaching 0 HP downs the instance and clamps HP', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  const result = useGMScreenStore.getState().damageInstance(screen.id, panel.id, 999)

  expect(result?.downed).toBe(true)
  expect(result?.finalHP).toBe(0)
  const after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.condition).toBe('downed')
})

test('healInstance: caps at the base max HP and revives a downed instance', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  useGMScreenStore.getState().damageInstance(screen.id, panel.id, 999)

  useGMScreenStore.getState().healInstance(screen.id, panel.id, 5)
  let after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.currentHP).toBe(5)
  expect(after.kind === 'npc-instance' && after.state.condition).toBe('active')

  // Healing past max clamps; the store never exceeds the base's HP.
  useGMScreenStore.getState().healInstance(screen.id, panel.id, 100)
  after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.currentHP).toBe(20)
})

test('healInstance: never resurrects an instance flagged dead', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  useGMScreenStore.getState().setInstanceCondition(screen.id, panel.id, 'dead')

  useGMScreenStore.getState().healInstance(screen.id, panel.id, 5)

  const after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.condition).toBe('dead')
})

test('damageInstance: does not un-flag an instance that is already dead', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  useGMScreenStore.getState().setInstanceCondition(screen.id, panel.id, 'dead')

  useGMScreenStore.getState().damageInstance(screen.id, panel.id, 999)

  const after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.condition).toBe('dead')
})

test('setInstanceTempHP: the strongest instance applies (no stacking)', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  useGMScreenStore.getState().setInstanceTempHP(screen.id, panel.id, 6)
  useGMScreenStore.getState().setInstanceTempHP(screen.id, panel.id, 3)

  const after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.tempHP).toBe(6)
})

test('adjustInstanceHP: +1 clamps at max, −1 routes through temp HP', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  useGMScreenStore.getState().adjustInstanceHP(screen.id, panel.id, 10)
  let after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.currentHP).toBe(20)

  useGMScreenStore.getState().setInstanceTempHP(screen.id, panel.id, 3)
  useGMScreenStore.getState().adjustInstanceHP(screen.id, panel.id, -2)
  after = useGMScreenStore.getState().screens[0].panels[0]
  expect(after.kind === 'npc-instance' && after.state.tempHP).toBe(1)
  expect(after.kind === 'npc-instance' && after.state.currentHP).toBe(20)
})

// ---- Instance AP & Recharge (live play) ------------------------------------

/** A base NPC whose slotted abilities carry the given traits. */
function npcWithAbilities(
  abilities: { id: string; name: string; traits: string[] }[],
): Character {
  return makeNpc({
    id: 'n1',
    slottedAbilities: abilities.map((a) => ({
      id: a.id,
      name: a.name,
      traits: a.traits,
      cost: { ap: 1 },
      damage: '',
      description: '',
      overcharge: '',
      flavorText: '',
      isMinor: false,
      showActivate: true,
      subAbilitiesUnderDescription: [],
      subAbilitiesUnderOvercharge: [],
    })),
  })
}

/** Force the next Recharge Die to land on `value` (1–6). */
function mockRechargeRoll(value: number) {
  vi.spyOn(Math, 'random').mockReturnValue((value - 0.5) / 6)
}

/** The live state of the panel at `index`. */
function instanceState(index = 0) {
  const panel = useGMScreenStore.getState().screens[0].panels[index]
  if (panel.kind !== 'npc-instance') throw new Error('expected an npc-instance panel')
  return panel.state
}

test('addNpcInstancePanel: spawns with a full turn (3 AP, nothing cooling)', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')

  expect(instanceState()).toMatchObject({ currentAP: 3, cooldowns: [] })
})

test('duplicatePanel: a fresh instance gets its own full turn', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  const firstId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  useGMScreenStore.getState().spendInstanceAP(screen.id, firstId, 2)
  useGMScreenStore.getState().markAbilityCooldown(screen.id, firstId, 'a1')

  useGMScreenStore.getState().duplicatePanel(screen.id, firstId)

  expect(instanceState(0)).toMatchObject({ currentAP: 1, cooldowns: ['a1'] })
  expect(instanceState(1)).toMatchObject({ currentAP: 3, cooldowns: [] })
})

test('instances of the same base keep independent AP', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  const firstId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')

  useGMScreenStore.getState().spendInstanceAP(screen.id, firstId, 1)

  expect(instanceState(0).currentAP).toBe(2)
  expect(instanceState(1).currentAP).toBe(3)
})

test('spendInstanceAP: deducts, and refuses when the instance cannot afford it', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  const panelId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')

  expect(useGMScreenStore.getState().spendInstanceAP(screen.id, panelId, 1)).toBe(true)
  expect(useGMScreenStore.getState().spendInstanceAP(screen.id, panelId, 2)).toBe(true)
  expect(instanceState().currentAP).toBe(0)
  // Nothing left: the third point must not push AP negative.
  expect(useGMScreenStore.getState().spendInstanceAP(screen.id, panelId, 1)).toBe(false)
  expect(instanceState().currentAP).toBe(0)
  // Unknown panels are refused rather than throwing.
  expect(useGMScreenStore.getState().spendInstanceAP(screen.id, 'nope', 1)).toBe(false)
})

test('restoreInstanceAP: caps at the 3 AP turn budget', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  const panelId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')

  useGMScreenStore.getState().spendInstanceAP(screen.id, panelId, 2)
  useGMScreenStore.getState().restoreInstanceAP(screen.id, panelId, 1)
  expect(instanceState().currentAP).toBe(2)
  useGMScreenStore.getState().restoreInstanceAP(screen.id, panelId, 5)
  expect(instanceState().currentAP).toBe(3)
})

test('markAbilityCooldown: tracks an ability once, per instance', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  const firstId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')

  const store = useGMScreenStore.getState()
  store.markAbilityCooldown(screen.id, firstId, 'a1')
  store.markAbilityCooldown(screen.id, firstId, 'a2')
  // Re-marking an ability already cooling must not duplicate it.
  store.markAbilityCooldown(screen.id, firstId, 'a1')

  expect(instanceState(0).cooldowns).toEqual(['a1', 'a2'])
  expect(instanceState(1).cooldowns).toEqual([])
})

test('startInstanceTurn: refills AP and recharges everything at or below the roll', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(
    npcWithAbilities([
      { id: 'a1', name: 'Fire Breath', traits: ['Recharge (5)'] },
      { id: 'a2', name: 'Bite', traits: ['Recharge (3)'] },
    ]),
  )
  const panelId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const store = useGMScreenStore.getState()
  store.spendInstanceAP(screen.id, panelId, 3)
  store.markAbilityCooldown(screen.id, panelId, 'a1')
  store.markAbilityCooldown(screen.id, panelId, 'a2')

  mockRechargeRoll(5)
  const outcome = useGMScreenStore.getState().startInstanceTurn(screen.id, panelId)

  expect(outcome?.roll).toBe(5)
  expect(outcome?.recharged.map((r) => r.name)).toEqual(['Fire Breath', 'Bite'])
  expect(outcome?.stillCooling).toEqual([])
  expect(instanceState()).toMatchObject({ currentAP: 3, cooldowns: [] })
})

test('startInstanceTurn: keeps abilities that rolled short cooling', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(
    npcWithAbilities([
      { id: 'a1', name: 'Fire Breath', traits: ['Recharge (5)'] },
      { id: 'a2', name: 'Bite', traits: ['Recharge (2)'] },
    ]),
  )
  const panelId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const store = useGMScreenStore.getState()
  store.markAbilityCooldown(screen.id, panelId, 'a1')
  store.markAbilityCooldown(screen.id, panelId, 'a2')

  mockRechargeRoll(2)
  const outcome = useGMScreenStore.getState().startInstanceTurn(screen.id, panelId)

  expect(outcome?.roll).toBe(2)
  expect(outcome?.recharged.map((r) => r.name)).toEqual(['Bite'])
  expect(outcome?.stillCooling.map((r) => r.name)).toEqual(['Fire Breath'])
  expect(instanceState().cooldowns).toEqual(['a1'])
})

test('startInstanceTurn: drops ids that no longer resolve to a Recharge ability', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(
    npcWithAbilities([{ id: 'a1', name: 'Slash', traits: ['Action'] }]),
  )
  const panelId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const store = useGMScreenStore.getState()
  store.markAbilityCooldown(screen.id, panelId, 'a1') // trait-less: stale
  store.markAbilityCooldown(screen.id, panelId, 'deleted')

  mockRechargeRoll(1)
  const outcome = useGMScreenStore.getState().startInstanceTurn(screen.id, panelId)

  // Nothing is reported as recharged; the stale ids are simply gone.
  expect(outcome?.recharged).toEqual([])
  expect(outcome?.stillCooling).toEqual([])
  expect(instanceState().cooldowns).toEqual([])
})

test('startInstanceTurn: an unknown panel returns null and changes nothing', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  expect(useGMScreenStore.getState().startInstanceTurn(screen.id, 'nope')).toBeNull()
})

test('startInstanceTurn: resolving a deleted base record is safe', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  const panelId = useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  useGMScreenStore.getState().spendInstanceAP(screen.id, panelId, 2)
  // The GM deleted the base NPC while the panel stayed on the screen.
  seedCharacters()

  mockRechargeRoll(4)
  const outcome = useGMScreenStore.getState().startInstanceTurn(screen.id, panelId)

  expect(outcome).toMatchObject({ roll: 4, recharged: [], stillCooling: [] })
  expect(instanceState().currentAP).toBe(3)
})


// ---- Panel ordering & density ---------------------------------------------

test('movePanel: reorders panels in both directions', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }), makeNpc({ id: 'n2' }))
  const store = useGMScreenStore.getState()
  store.addNpcInstancePanel(screen.id, 'n1')
  store.addNpcInstancePanel(screen.id, 'n2')
  /** Base ids in panel order (all panels here are NPC instances). */
  const baseIds = () =>
    useGMScreenStore
      .getState()
      .screens[0].panels.map((p) => (p.kind === 'npc-instance' ? p.baseNpcId : ''))
  const before = baseIds()

  useGMScreenStore.getState().movePanel(screen.id, 0, 1)
  expect(baseIds()).toEqual([...before].reverse())

  useGMScreenStore.getState().movePanel(screen.id, 1, 0)
  expect(baseIds()).toEqual(before)
})

test('movePanel: out-of-range indices are a no-op', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const before = useGMScreenStore.getState().screens[0].panels

  useGMScreenStore.getState().movePanel(screen.id, 0, 5)
  useGMScreenStore.getState().movePanel(screen.id, -1, 0)

  expect(useGMScreenStore.getState().screens[0].panels).toEqual(before)
})

test('setPanelDensity: toggles only the targeted panel', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c2')
  const [first, second] = useGMScreenStore.getState().screens[0].panels

  useGMScreenStore.getState().setPanelDensity(screen.id, first.id, 'expanded')

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels.find((p) => p.id === first.id)?.density).toBe('expanded')
  expect(panels.find((p) => p.id === second.id)?.density).toBe('compact')
})

test('removePanel: removes exactly one panel', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c2')
  const [first, second] = useGMScreenStore.getState().screens[0].panels

  useGMScreenStore.getState().removePanel(screen.id, first.id)

  expect(useGMScreenStore.getState().screens[0].panels.map((p) => p.id)).toEqual([second.id])
})

// ---- Autosave -------------------------------------------------------------

test('panel edits autosave the screen after the debounce window', async () => {
  vi.useFakeTimers()
  const screen = await useGMScreenStore.getState().createScreen('S')
  useCharacterStore.setState({ characters: [makeNpc({ id: 'n1' })] })
  dbMap.clear()

  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')

  // Nothing written before the debounce elapses.
  expect(dbMap.has(screen.id)).toBe(false)
  await vi.advanceTimersByTimeAsync(600)
  expect((dbMap.get(screen.id) as GMScreen).panels).toHaveLength(1)
})

test('edits to two screens in one tick each persist their own record', async () => {
  vi.useFakeTimers()
  const a = await useGMScreenStore.getState().createScreen('A')
  const b = await useGMScreenStore.getState().createScreen('B')
  dbMap.clear()

  useGMScreenStore.getState().addCharacterPanel(a.id, 'c1')
  useGMScreenStore.getState().addCharacterPanel(b.id, 'c2')

  await vi.advanceTimersByTimeAsync(600)

  expect((dbMap.get(a.id) as GMScreen).panels[0]).toMatchObject({ characterId: 'c1' })
  expect((dbMap.get(b.id) as GMScreen).panels[0]).toMatchObject({ characterId: 'c2' })
})

// ---- Quick create & reference helpers --------------------------------------

test('createNpcBaseAndInstance: creates the base record and spawns an instance', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')

  const panelId = await useGMScreenStore.getState().createNpcBaseAndInstance(screen.id, 'Goblin')

  expect(panelId).toBeTruthy()
  const base = useCharacterStore.getState().characters.find((c) => c.name === 'Goblin')
  expect(base?.kind).toBe('npc')
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  expect(panel).toMatchObject({ kind: 'npc-instance', baseNpcId: base!.id, label: 'Goblin' })
  // The GM screen never hijacks the open sheet.
  expect(useCharacterStore.getState().currentCharacter).toBeNull()
})

test('createNpcBaseAndInstance: a blank name creates nothing', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  expect(await useGMScreenStore.getState().createNpcBaseAndInstance(screen.id, '  ')).toBeNull()
  expect(useGMScreenStore.getState().screens[0].panels).toHaveLength(0)
})

test('screensReferencing: lists every screen that uses an entity', async () => {
  const a = await useGMScreenStore.getState().createScreen('Session 4')
  const b = await useGMScreenStore.getState().createScreen('Dungeon Run')
  seedCharacters(makeNpc({ id: 'n1' }))

  useGMScreenStore.getState().addNpcInstancePanel(a.id, 'n1')
  useGMScreenStore.getState().addNpcInstancePanel(b.id, 'n1')
  useGMScreenStore.getState().addNpcInstancePanel(b.id, 'n1')

  expect(useGMScreenStore.getState().screensReferencing('n1')).toEqual([
    'Session 4',
    'Dungeon Run',
  ])
  expect(useGMScreenStore.getState().screensReferencing('unused')).toEqual([])
})

test('screensReferencing: counts character panels too', async () => {
  const a = await useGMScreenStore.getState().createScreen('Session 4')
  useGMScreenStore.getState().addCharacterPanel(a.id, 'c1')
  expect(useGMScreenStore.getState().screensReferencing('c1')).toEqual(['Session 4'])
})

// ---- Panel status tracking -------------------------------------------------

/** Tracked statuses of the screen's first panel. */
function panelStatuses() {
  return useGMScreenStore.getState().screens[0].panels[0].statuses
}

test('setPanelStatus: tracks a status with its duration at one stack', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id

  useGMScreenStore.getState().setPanelStatus(screen.id, panelId, 'poisoned', 'countdown')

  expect(panelStatuses()).toEqual([
    { statusId: 'poisoned', duration: 'countdown', stacks: 1 },
  ])
})

test('setPanelStatus: re-picking a duration edits in place and keeps stacks', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id
  const store = useGMScreenStore.getState()

  store.setPanelStatus(screen.id, panelId, 'poisoned', 'countdown')
  store.adjustPanelStatusStacks(screen.id, panelId, 'poisoned', 2)
  store.setPanelStatus(screen.id, panelId, 'poisoned', 'permanent')

  // One entry per status per panel: the picker's chips are also the duration
  // editor, so the stack count the GM has been ticking must survive.
  expect(panelStatuses()).toEqual([
    { statusId: 'poisoned', duration: 'permanent', stacks: 3 },
  ])
})

test('setPanelStatus: keeps insertion order and only touches its own panel', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const store = useGMScreenStore.getState()
  store.addCharacterPanel(screen.id, 'c1')
  store.addCharacterPanel(screen.id, 'c2')
  const [first, second] = useGMScreenStore.getState().screens[0].panels

  store.setPanelStatus(screen.id, first.id, 'blinded', 'quick')
  store.setPanelStatus(screen.id, first.id, 'prone', 'conditional')
  store.setPanelStatus(screen.id, second.id, 'hidden', 'quick')

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels[0].statuses.map((s) => s.statusId)).toEqual(['blinded', 'prone'])
  expect(panels[1].statuses.map((s) => s.statusId)).toEqual(['hidden'])
})

test('setPanelStatus: an unknown screen or panel is a no-op', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')

  useGMScreenStore.getState().setPanelStatus('nope', 'nope', 'poisoned', 'quick')

  expect(panelStatuses()).toEqual([])
})

test('adjustPanelStatusStacks: clamps to at least one stack and the cap', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id
  const store = useGMScreenStore.getState()
  store.setPanelStatus(screen.id, panelId, 'poisoned', 'countdown')

  // Never below one: a status is removed explicitly, not by decrementing past
  // zero (the pill turns its − into a ✕ at one stack for exactly that reason).
  store.adjustPanelStatusStacks(screen.id, panelId, 'poisoned', -5)
  expect(panelStatuses()[0].stacks).toBe(1)

  store.adjustPanelStatusStacks(screen.id, panelId, 'poisoned', 200)
  expect(panelStatuses()[0].stacks).toBe(99)
})

test('adjustPanelStatusStacks: leaves other statuses untouched', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id
  const store = useGMScreenStore.getState()
  store.setPanelStatus(screen.id, panelId, 'poisoned', 'countdown')
  store.setPanelStatus(screen.id, panelId, 'prone', 'quick')

  store.adjustPanelStatusStacks(screen.id, panelId, 'poisoned', 1)

  expect(panelStatuses()).toEqual([
    { statusId: 'poisoned', duration: 'countdown', stacks: 2 },
    { statusId: 'prone', duration: 'quick', stacks: 1 },
  ])
})

test('removePanelStatus: drops only the named status', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id
  const store = useGMScreenStore.getState()
  store.setPanelStatus(screen.id, panelId, 'poisoned', 'countdown')
  store.setPanelStatus(screen.id, panelId, 'prone', 'quick')

  store.removePanelStatus(screen.id, panelId, 'poisoned')

  expect(panelStatuses()).toEqual([
    { statusId: 'prone', duration: 'quick', stacks: 1 },
  ])
})

test('tracked statuses never reach the character record (GM-screen only)', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  const pc = makeCharacter({ id: 'c1' })
  seedCharacters(pc)
  useGMScreenStore.getState().addCharacterPanel(screen.id, 'c1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id

  useGMScreenStore.getState().setPanelStatus(screen.id, panelId, 'poisoned', 'quick')

  // The panel tracks it…
  expect(panelStatuses()).toHaveLength(1)
  // …and the character it references is untouched: the sheet page has no
  // concept of GM-tracked statuses.
  const stored = useCharacterStore.getState().characters.find((c) => c.id === 'c1')!
  expect(stored).not.toHaveProperty('statuses')
  expect(stored).toEqual(pc)
})

test('duplicatePanel: a fresh instance does not inherit tracked statuses', async () => {
  const screen = await useGMScreenStore.getState().createScreen('S')
  seedCharacters(makeNpc({ id: 'n1' }))
  useGMScreenStore.getState().addNpcInstancePanel(screen.id, 'n1')
  const panelId = useGMScreenStore.getState().screens[0].panels[0].id
  useGMScreenStore.getState().setPanelStatus(screen.id, panelId, 'poisoned', 'countdown')

  const copyId = useGMScreenStore.getState().duplicatePanel(screen.id, panelId)

  const copy = useGMScreenStore.getState().screens[0].panels.find((p) => p.id === copyId)!
  expect(copy.statuses).toEqual([])
  expect(panelStatuses()).toHaveLength(1)
})

// ---- Load failure handling -------------------------------------------------

test('loadScreens: a storage failure never leaves the page loading forever', async () => {
  const db = await import('@/lib/db')
  vi.spyOn(db, 'getAllScreens').mockRejectedValueOnce(
    new Error('IndexedDB is unavailable'),
  )

  await useGMScreenStore.getState().loadScreens()

  const state = useGMScreenStore.getState()
  // The page must leave the "Loading…" branch…
  expect(state.isLoaded).toBe(true)
  // …and say what went wrong, with the real message.
  expect(state.loadError).toBe('IndexedDB is unavailable')
  expect(state.screens).toEqual([])
  expect(state.currentScreenId).toBeNull()
})

test('loadScreens: a non-Error rejection still yields a readable message', async () => {
  const db = await import('@/lib/db')
  vi.spyOn(db, 'getAllScreens').mockRejectedValueOnce('nope')

  await useGMScreenStore.getState().loadScreens()

  const state = useGMScreenStore.getState()
  expect(state.isLoaded).toBe(true)
  expect(state.loadError).toBeTruthy()
})

test('loadScreens: retrying after a failure recovers the saved screens', async () => {
  const db = await import('@/lib/db')
  const spy = vi
    .spyOn(db, 'getAllScreens')
    .mockRejectedValueOnce(new Error('temporary'))

  await useGMScreenStore.getState().loadScreens()
  expect(useGMScreenStore.getState().loadError).toBe('temporary')

  // The next attempt succeeds and clears the error.
  spy.mockRestore()
  const screen = await useGMScreenStore.getState().createScreen('Recovered')
  await useGMScreenStore.getState().loadScreens()

  const state = useGMScreenStore.getState()
  expect(state.loadError).toBeNull()
  expect(state.screens.map((s) => s.id)).toEqual([screen.id])
})
