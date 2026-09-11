/**
 * The Ability Pool is a **build-time** surface: it holds the abilities a
 * character owns but is not currently using. Nothing in it is slotted, so
 * nothing in it activates — and a sub-ability is bound to its parent (it cannot
 * be slotted on its own), so it must not offer an Activate button either. That
 * button spends the character's real AP, which is exactly what a pooled
 * ability's sub-ability used to do by falling back to its own `showActivate`
 * flag.
 *
 * These tests pin both halves of that contract: the pool renders no Activate
 * buttons, and the *same* sub-ability activates again the moment its parent is
 * slotted — plus the independent live-play controls (uses steppers) that must
 * keep working wherever a limited ability lives.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import AbilityPoolSection from '@/components/sheet/AbilityPoolSection'
import SlottedAbilitiesSection from '@/components/sheet/SlottedAbilitiesSection'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { abilityUsesRemaining } from '@/lib/abilityUses'
import type { AbilityBlock, Character } from '@/types'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => Array.from(dbMap.values())),
  getCharacter: vi.fn(async (id: string) => dbMap.get(id) ?? null),
  putCharacter: vi.fn(async (char: Character) => {
    dbMap.set(char.id, char)
  }),
  deleteCharacter: vi.fn(async () => {}),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  getAllVersionSnapshots: vi.fn(async () => []),
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
  replaceAllData: vi.fn(async () => {}),
}))

vi.mock('@/store/diceRollStore', () => ({
  useDiceRollStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ roll: vi.fn() }),
}))

vi.mock('@/store/statusStore', () => ({
  useStatusStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      statuses: [],
      isLoaded: true,
      modal: { statusId: null, startInEdit: false },
      openStatus: vi.fn(),
      closeStatus: vi.fn(),
    }),
}))

/**
 * The sub-ability nested under the fixture parent: costed and flagged
 * `showActivate`, i.e. shaped exactly like one that used to grow a button in
 * the pool. `uses` makes its independent live-play stepper observable.
 */
function subAbility(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return {
    id: 'sub-1',
    name: 'Cinder',
    traits: [],
    cost: { ap: 1 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
    ...overrides,
  }
}

/** A costed, activatable parent carrying one sub-ability. */
function parentAbility(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return {
    id: 'parent-1',
    name: 'Fireball',
    traits: [],
    cost: { ap: 2 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [subAbility()],
    subAbilitiesUnderOvercharge: [],
    ...overrides,
  }
}

/** Install a character with a full AP pool as the store's current character. */
function setupCharacter(ability: AbilityBlock): Character {
  const char: Character = {
    ...createDefaultCharacter(),
    currentAP: 3,
    slottedAbilities: [ability],
    abilityPool: [ability],
  }
  dbMap.set(char.id, char)
  useCharacterStore.setState({ currentCharacter: char, characters: [char] })
  return char
}

/** The rendered sub-ability block (the nested card). */
function subBlock(): HTMLElement {
  const el = document.querySelector('.sub-ability-block')
  expect(el).not.toBeNull()
  return el as HTMLElement
}

beforeEach(() => {
  dbMap.clear()
  useCharacterStore.setState({
    characters: [],
    currentCharacter: null,
    isLoaded: true,
    isSaving: false,
    versionHistory: null,
    isRestoring: false,
    view: 'home',
  })
})

test('a pooled ability renders no Activate button — for itself or its sub-abilities', () => {
  const ability = parentAbility()
  setupCharacter(ability)

  render(
    <NotificationProvider>
      <AbilityPoolSection abilities={[ability]} mode="view" />
    </NotificationProvider>,
  )

  // The nested card is really there (so the assertion below is not vacuous).
  expect(within(subBlock()).getByText('Cinder')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull()
})

test('pooled sub-abilities keep their independent live-play controls', () => {
  // Steppers are not activation: a limited ability is a counter the player
  // tracks by hand wherever it sits, the pool included.
  const ability = parentAbility({
    subAbilitiesUnderDescription: [
      subAbility({ uses: { max: 3, current: 3, expendOnActivate: true } }),
    ],
  })
  setupCharacter(ability)

  render(
    <NotificationProvider>
      <AbilityPoolSection abilities={[ability]} mode="view" />
    </NotificationProvider>,
  )

  const sub = subBlock()
  expect(
    within(sub).getByRole('img', { name: /3 of 3 uses remaining/i }),
  ).toBeInTheDocument()

  fireEvent.click(
    within(sub).getByRole('button', { name: /spend one use of/i }),
  )
  const updated = useCharacterStore.getState().currentCharacter as Character
  expect(
    abilityUsesRemaining(updated.abilityPool[0].subAbilitiesUnderDescription[0]),
  ).toBe(2)
})

test('the same sub-ability activates once its parent is slotted', () => {
  const ability = parentAbility()
  setupCharacter(ability)

  render(
    <NotificationProvider>
      <SlottedAbilitiesSection abilities={[ability]} maxSlots={3} mode="view" />
    </NotificationProvider>,
  )

  // The parent's own button sits outside the nested block; the sub-ability
  // keeps one of its own — slotted abilities really do play (this is the
  // control that keeps the pool fix from over-reaching).
  expect(screen.getAllByRole('button', { name: 'Activate' })).toHaveLength(2)
  expect(
    within(subBlock()).getAllByRole('button', { name: 'Activate' }),
  ).toHaveLength(1)
})

test('the sheet-level sub-ability editor still offers the Show Activate toggle', () => {
  // The toggle is only hidden for NPCs (see NPCAbilitiesSection.test.tsx);
  // player sheets keep it, so the npcMode plumbing must not leak.
  const ability = parentAbility()
  setupCharacter(ability)

  render(
    <NotificationProvider>
      <SlottedAbilitiesSection abilities={[ability]} maxSlots={3} mode="edit" />
    </NotificationProvider>,
  )

  fireEvent.click(
    within(subBlock()).getByRole('button', { name: 'Edit' }),
  )

  expect(
    screen.getByRole('dialog', { name: 'Edit Sub-Ability' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Show Activate button')).toBeInTheDocument()
})
