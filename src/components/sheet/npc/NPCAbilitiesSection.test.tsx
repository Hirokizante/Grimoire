/**
 * The standalone NPC sheet is a **static reference**: it never offers an
 * Activate button, never tracks Action Points, and never shows Recharge
 * cooldowns. Live play belongs to a GM Screen instance, which owns its own turn
 * (see NpcInstancePanel / useNpcInstanceActivation).
 *
 * These tests pin that side of the contract — the GM panel's own behavior is
 * covered in components/gmscreen/GMScreenPanels.test.tsx — plus the section's
 * two other jobs: it lays the list out identically for the standalone sheet and
 * an NPC embedded in a player sheet's custom tab, and it reorders that list by
 * drag in edit mode (the same grip-and-drop the player sheet's Slotted
 * Abilities offers).
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import { useCharacterStore } from '@/store/characterStore'
import { createDefaultNPC } from '@/constants/gameData'
import type { AbilityBlock, Character } from '@/types'

/**
 * The real DndContext needs measured rects (which jsdom does not provide), so
 * the drag result is driven straight into the section's `onDragEnd`. dnd-kit's
 * own sensors and collision detection are exercised by the Playwright spec
 * (e2e/npc-abilities.spec.ts), which drags a real card with a real pointer.
 */
const { dragEndRef, dbMap } = vi.hoisted(() => ({
  dragEndRef: {
    current: null as null | ((event: { active: { id: string }; over: { id: string } | null }) => void),
  },
  dbMap: new Map<string, unknown>(),
}))

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  const React = await import('react')
  return {
    ...actual,
    DndContext: (props: {
      children: React.ReactNode
      onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void
    }) => {
      dragEndRef.current = props.onDragEnd ?? null
      return React.createElement(React.Fragment, null, props.children)
    },
  }
})

vi.mock('@/lib/db', () => ({
  getAllScreens: vi.fn(async () => []),
  getScreen: vi.fn(async () => null),
  putScreen: vi.fn(async () => {}),
  deleteScreen: vi.fn(async () => {}),
  normalizeScreen: (s: unknown) => s,
  getAllCharacters: vi.fn(async () => Array.from(dbMap.values())),
  getCharacter: vi.fn(async (id: string) => dbMap.get(id) ?? null),
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
  normalizeCharacter: (c: Character) => c,
  stripLabels: ({ labels: _l, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getStatus: vi.fn(async () => null),
  putStatus: vi.fn(async () => {}),
  deleteStatus: vi.fn(async () => {}),
  normalizeStatus: (s: unknown) => s,
  getAllVersionSnapshots: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
}))

/** A costed ability carrying the Recharge trait — the most "activatable" shape. */
function rechargeAbility(): AbilityBlock {
  return {
    id: 'a1',
    name: 'Fire Breath',
    traits: ['Action', 'Recharge (5)'],
    cost: { ap: 2 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [
      {
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
      },
    ],
    subAbilitiesUnderOvercharge: [],
  }
}

/** An NPC holding that ability as its store current character. */
function seedNpc(): Character {
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [rechargeAbility()],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })
  return npc
}

beforeEach(() => {
  dbMap.clear()
  useCharacterStore.setState({ characters: [], currentCharacter: null })
})

test('standalone NPC abilities never render an Activate button', () => {
  const npc = seedNpc()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
    />,
  )

  // Neither the ability nor its sub-ability can be activated on the sheet…
  expect(screen.queryAllByRole('button', { name: 'Activate' })).toHaveLength(0)
  // …and nothing live-play leaks in either: no cooldown badge, no AP meter.
  expect(document.querySelector('.gm-recharge')).toBeNull()
  expect(document.querySelector('.gm-ap')).toBeNull()
  // The card itself still renders (static reference).
  expect(screen.getByText('Fire Breath')).toBeInTheDocument()
})

test('the sub-ability editor hides the Show Activate toggle on an NPC sheet', () => {
  const npc = seedNpc()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  // Edit the nested sub-ability straight from the card…
  const sub = document.querySelector('.sub-ability-block') as HTMLElement
  fireEvent.click(within(sub).getByRole('button', { name: 'Edit' }))

  // …and the editor offers exactly what the main NPC ability editor offers:
  // AP cost, and none of the character-only controls. An NPC outside a GM
  // panel never renders an Activate button, so a flag for one is noise.
  expect(
    screen.getByRole('dialog', { name: 'Edit Sub-Ability' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('AP Cost')).toBeInTheDocument()
  expect(screen.queryByLabelText('Show Activate button')).toBeNull()
  expect(screen.queryByLabelText('END Cost')).toBeNull()
  expect(screen.queryByLabelText('FP Cost')).toBeNull()
})

// ---- Drag and drop ---------------------------------------------------------

/** A minimal ability with nothing but an id and a name. */
function plainAbility(id: string, name: string): AbilityBlock {
  return {
    id,
    name,
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: false,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
  }
}

/** An NPC whose list holds three plain abilities. */
function seedNpcWithThree(): Character {
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [
      plainAbility('a1', 'Claw'),
      plainAbility('a2', 'Bite'),
      plainAbility('a3', 'Howl'),
    ],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })
  return npc
}

/** The ability order currently persisted on the store's NPC record. */
function storedAbilityIds(): string[] {
  return (
    useCharacterStore.getState().characters.find((c) => c.id === 'npc-1')
      ?.slottedAbilities ?? []
  ).map((a) => a.id)
}

test('edit mode gives every NPC ability card a drag handle', () => {
  const npc = seedNpcWithThree()
  const { container } = render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  expect(container.querySelectorAll('.drag-handle')).toHaveLength(3)
  expect(container.querySelectorAll('.ability-card')).toHaveLength(3)
  // Edit mode still offers the per-card Edit / Remove buttons.
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3)
  expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(3)
})

test('view mode renders no drag handles — a static reference is not draggable', () => {
  const npc = seedNpcWithThree()
  const { container } = render(
    <NPCAbilitiesSection abilities={npc.slottedAbilities} ownerId={npc.id} owner={npc} />,
  )

  expect(container.querySelectorAll('.drag-handle')).toHaveLength(0)
  expect(container.querySelectorAll('.ability-card')).toHaveLength(3)
})

test('dropping a card on another reorders the NPC ability list', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  // Drag "Howl" (last) onto "Claw" (first) — the same move the player sheet's
  // Slotted Abilities performs on a drop.
  act(() => dragEndRef.current?.({ active: { id: 'a3' }, over: { id: 'a1' } }))

  expect(storedAbilityIds()).toEqual(['a3', 'a1', 'a2'])
})

test('dropping a card on the list itself sends it to the end', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  act(() => dragEndRef.current?.({ active: { id: 'a1' }, over: { id: 'npcAbilities' } }))

  expect(storedAbilityIds()).toEqual(['a2', 'a3', 'a1'])
})

test('a cancelled drag (no drop target) leaves the list alone', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  act(() => dragEndRef.current?.({ active: { id: 'a1' }, over: null }))

  expect(storedAbilityIds()).toEqual(['a1', 'a2', 'a3'])
})

// ---- Layout parity between the two mount points -----------------------------

test('the embedded variant lays the list out exactly like the standalone section', () => {
  const npc = seedNpcWithThree()
  const props = {
    abilities: npc.slottedAbilities,
    ownerId: npc.id,
    owner: npc,
    mode: 'edit' as const,
    viewMode: 'grid' as const,
    onViewModeChange: () => {},
  }

  const { container, rerender } = render(<NPCAbilitiesSection {...props} />)
  const standalone = {
    grid: container.querySelector('.ability-grid')?.className,
    heading: screen.getByRole('heading', { name: 'Abilities' }).tagName,
    handles: container.querySelectorAll('.drag-handle').length,
    shell: container.querySelector('.sheet-section--slotted') !== null,
    embeddedShell: container.querySelector('.npc-abilities-section--embedded') !== null,
  }

  rerender(<NPCAbilitiesSection {...props} variant="embedded" />)
  const embedded = {
    grid: container.querySelector('.ability-grid')?.className,
    heading: screen.getByRole('heading', { name: 'Abilities' }).tagName,
    handles: container.querySelectorAll('.drag-handle').length,
    shell: container.querySelector('.sheet-section--slotted') !== null,
    embeddedShell: container.querySelector('.npc-abilities-section--embedded') !== null,
  }

  // Same card grid, same drag handles, same toggle, same add button — only the
  // shell and the heading level differ (the embedded NPC's name is the section
  // heading, so its blocks use the compact h5 label).
  expect(embedded.grid).toBe(standalone.grid)
  expect(embedded.handles).toBe(standalone.handles)
  expect(standalone.heading).toBe('H3')
  expect(embedded.heading).toBe('H5')
  expect(standalone.shell).toBe(true)
  expect(embedded.shell).toBe(false)
  expect(standalone.embeddedShell).toBe(false)
  expect(embedded.embeddedShell).toBe(true)
  expect(
    screen.getAllByRole('tablist', { name: 'Abilities view' }),
  ).toHaveLength(1)
  expect(
    screen.getByRole('button', { name: '+ Add Ability' }),
  ).toBeInTheDocument()
  // The old embedded-only grid is gone: an NPC's abilities are one layout now.
  expect(container.querySelector('.custom-npc-section__abilities')).toBeNull()
})

test('the view toggle is not rendered when the surface fixes its view mode', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="view"
      viewMode="list"
    />,
  )

  // A GM panel passes no `onViewModeChange`, so it keeps its fixed list view.
  expect(screen.queryByRole('tablist', { name: 'Abilities view' })).toBeNull()
})
