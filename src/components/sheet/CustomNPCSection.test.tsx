import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import CustomNPCSection from '@/components/sheet/CustomNPCSection'
import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultNPC } from '@/constants/gameData'
import type {
  AbilityBlock,
  Character,
  CustomNPCSection as CustomNPCSectionType,
} from '@/types'

// Shared mock state recreated per test so the NPC lookups are easy to control.
// `charactersRef` must live in vi.hoisted so the hoisted vi.mock factory can
// reach it (the classic vi.mock hoisting gotcha).
const {
  roll,
  removeCustomSection,
  reorderCustomSection,
  updateCharacter,
  charactersRef,
  currentCharacterRef,
  dragEndRef,
} = vi.hoisted(() => ({
    roll: vi.fn(),
    removeCustomSection: vi.fn(),
    reorderCustomSection: vi.fn(),
    // The section's only store write: an id-targeted updater. Applied to the
    // shared list so a test can read the resulting record back.
    updateCharacter: vi.fn((id: string, updater: (c: Character) => Character) => {
      charactersRef.current = charactersRef.current.map((c) =>
        c.id === id ? updater(c) : c,
      )
    }),
    charactersRef: { current: [] as Character[] },
    // `AbilityBlockCard` falls back to the store's `currentCharacter` when no
    // use writer is threaded in — the case a test flips on to prove an NPC base
    // record still gets no steppers.
    currentCharacterRef: { current: null as Character | null },
    // Captures the drag handler from the section's (nested) DndContext: jsdom
    // has no layout, so a real drag cannot resolve a drop target here. The
    // pointer path is covered end to end by e2e/npc-abilities.spec.ts.
    dragEndRef: {
      current: null as null | ((event: {
        active: { id: string }
        over: { id: string } | null
      }) => void),
    },
  }))

// The NPC is selected from the character store's `characters` list, so the
// mock must expose a real `characters` array the test can populate.
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      characters: charactersRef.current,
      currentCharacter: currentCharacterRef.current,
      removeCustomSection,
      reorderCustomSection,
      updateCharacter,
    }),
}))

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  const React = await import('react')
  return {
    ...actual,
    DndContext: (props: {
      children: React.ReactNode
      onDragEnd?: (event: {
        active: { id: string }
        over: { id: string } | null
      }) => void
    }) => {
      dragEndRef.current = props.onDragEnd ?? null
      return React.createElement(React.Fragment, null, props.children)
    },
  }
})

vi.mock('@/store/diceRollStore', () => ({
  useDiceRollStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ roll }),
}))

vi.mock('@/lib/db', () => ({
  putCharacter: vi.fn(async () => {}),
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

const section: CustomNPCSectionType = {
  kind: 'npc',
  id: 'section-1',
  name: 'Goblin',
  npcId: 'npc-1',
}

beforeEach(() => {
  charactersRef.current = []
  currentCharacterRef.current = null
  roll.mockReset()
  removeCustomSection.mockReset()
  reorderCustomSection.mockReset()
  updateCharacter.mockClear()
  dragEndRef.current = null
})

function makeNPC(): Character {
  return {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Goblin',
    attributes: { MAR: 1, POW: 5, AGI: 2, VIT: 3, GRT: 4 },
    skills: { ...createDefaultNPC().skills, Sneak: 2 },
  }
}

test('clicking an attribute rolls d20 using the NPC attribute value', () => {
  const npc = makeNPC()
  charactersRef.current = [npc]

  render(<CustomNPCSection tabId="tab-1" section={section} mode="view" />)

  // POW abbreviation chip — the clickable target is the whole <li>.
  fireEvent.click(screen.getByText('POW'))

  expect(roll).toHaveBeenCalledTimes(1)
  expect(roll.mock.calls[0][0]).toMatchObject({
    notation: 'd20+5',
    character: npc,
    source: { type: 'attribute-check', attributeKey: 'POW' },
  })
})

test('clicking a skill rolls d20 using the NPC skill value', () => {
  const npc = makeNPC()
  charactersRef.current = [npc]

  render(<CustomNPCSection tabId="tab-1" section={section} mode="view" />)

  fireEvent.click(screen.getByText('Sneak'))

  expect(roll).toHaveBeenCalledTimes(1)
  expect(roll.mock.calls[0][0]).toMatchObject({
    notation: 'd20+2',
    character: npc,
    source: { type: 'skill-check', skillName: 'Sneak' },
  })
})

test('attributes and skills are not clickable in edit mode', () => {
  const npc = makeNPC()
  charactersRef.current = [npc]

  render(<CustomNPCSection tabId="tab-1" section={section} mode="edit" />)

  fireEvent.click(screen.getByText('POW'))
  fireEvent.click(screen.getByText('Sneak'))

  expect(roll).not.toHaveBeenCalled()
})

// ---- Section reordering ----------------------------------------------------

test('edit mode offers the reorder arrows, wired to this section’s position', () => {
  charactersRef.current = [makeNPC()]

  render(
    <CustomNPCSection
      tabId="tab-1"
      section={section}
      mode="edit"
      index={1}
      count={2}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Move Goblin up' }))
  expect(reorderCustomSection).toHaveBeenCalledWith('tab-1', 1, 0)
})

test('view mode shows no reorder arrows', () => {
  charactersRef.current = [makeNPC()]

  render(
    <CustomNPCSection
      tabId="tab-1"
      section={section}
      mode="view"
      index={1}
      count={2}
    />,
  )

  expect(
    screen.queryByRole('button', { name: 'Move Goblin up' }),
  ).not.toBeInTheDocument()
})

test('a section whose NPC record is gone can still be moved in edit mode', () => {
  // The lookup fails (no characters), so the section renders its placeholder —
  // which must keep the reorder pair, or a broken section could not be shifted
  // out of the way of the ones that still work.
  render(
    <CustomNPCSection
      tabId="tab-1"
      section={section}
      mode="edit"
      index={0}
      count={2}
    />,
  )

  expect(screen.getByText(/could not be found/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Move Goblin down' }))
  expect(reorderCustomSection).toHaveBeenCalledWith('tab-1', 0, 1)
})

/** An NPC ability, costed and activatable, carrying one costed sub-ability. */
function npcAbility(): AbilityBlock {
  return {
    id: 'npc-ability-1',
    name: 'Fire Breath',
    traits: [],
    cost: { ap: 2 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [
      {
        id: 'npc-sub-1',
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

test('an attached NPC never renders an Activate button — sub-abilities included', () => {
  // An attached NPC is a static reference like the standalone NPC sheet: the
  // parent card has no button, and a nested sub-ability must not fall back to
  // its own `showActivate` flag to grow one.
  const npc = makeNPC()
  npc.slottedAbilities = [npcAbility()]
  charactersRef.current = [npc]

  // Wrapped in the provider the Activate button's plan would need, so this
  // test fails on the button itself rather than on a missing context.
  render(
    <NotificationProvider>
      <CustomNPCSection tabId="tab-1" section={section} mode="view" />
    </NotificationProvider>,
  )

  expect(document.querySelector('.sub-ability-block')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull()
})

// ---- Shared ability section (layout + drag and drop) ------------------------

/** A bare ability with nothing but an id and a name. */
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

/** An attached NPC holding three abilities. */
function npcWithThreeAbilities(): Character {
  const npc = makeNPC()
  npc.slottedAbilities = [
    plainAbility('a1', 'Claw'),
    plainAbility('a2', 'Bite'),
    plainAbility('a3', 'Howl'),
  ]
  return npc
}

/** The attached NPC's ability order, read back from the shared record. */
function attachedAbilityIds(): string[] {
  return (charactersRef.current[0]?.slottedAbilities ?? []).map((a) => a.id)
}

test('the embedded abilities section is the standalone one: same grid, button and toggle', () => {
  const npc = npcWithThreeAbilities()
  charactersRef.current = [npc]
  const onViewModeChange = vi.fn()

  const { container, unmount } = render(
    <CustomNPCSection
      tabId="tab-1"
      section={section}
      mode="edit"
      viewMode="grid"
      onViewModeChange={onViewModeChange}
    />,
  )

  // The exact classes the standalone NPC sheet's section renders — a 3-column
  // card grid, one grip handle per card, and the same "+ Add Ability" button.
  const embedded = container.querySelector('.npc-abilities-section--embedded')
  expect(embedded).not.toBeNull()
  const embeddedGridClass = container.querySelector('.ability-grid')?.className
  expect(container.querySelector('.ability-grid--cards')).not.toBeNull()
  expect(container.querySelectorAll('.drag-handle')).toHaveLength(3)
  expect(screen.getByRole('button', { name: '+ Add Ability' })).toBeInTheDocument()
  // The old embedded-only grid (fixed auto-fill columns, no toggle) is gone.
  expect(container.querySelector('.custom-npc-section__abilities')).toBeNull()

  // The heading row carries the same grid/list toggle the sheet page does…
  fireEvent.click(screen.getByRole('tab', { name: 'List view' }))
  expect(onViewModeChange).toHaveBeenCalledWith('list')

  unmount()

  // …and the standalone section renders the identical list markup.
  const { container: standalone } = render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
      viewMode="grid"
      onViewModeChange={onViewModeChange}
    />,
  )
  expect(standalone.querySelector('.ability-grid')?.className).toBe(embeddedGridClass)
})

test('dragging an attached NPC ability card reorders that NPC record', () => {
  const npc = npcWithThreeAbilities()
  charactersRef.current = [npc]

  render(
    <CustomNPCSection tabId="tab-1" section={section} mode="edit" />,
  )

  // Drag "Howl" (last) onto "Claw" (first). The write targets the attached NPC
  // record — not the player character whose sheet the section lives on.
  act(() => dragEndRef.current?.({ active: { id: 'a3' }, over: { id: 'a1' } }))

  expect(updateCharacter).toHaveBeenCalledWith('npc-1', expect.any(Function))
  expect(attachedAbilityIds()).toEqual(['a3', 'a1', 'a2'])
})

test('an attached NPC list is not draggable in view mode', () => {
  const npc = npcWithThreeAbilities()
  charactersRef.current = [npc]

  const { container } = render(
    <CustomNPCSection tabId="tab-1" section={section} mode="view" />,
  )

  // The three authored abilities plus the pinned Basic Attack every NPC record
  // carries — and not one of them is draggable outside edit mode.
  expect(container.querySelectorAll('.ability-card')).toHaveLength(4)
  expect(container.querySelectorAll('.drag-handle')).toHaveLength(0)
})

test('an attached NPC’s limited uses are read-only', () => {
  const npc: Character = {
    ...makeNPC(),
    slottedAbilities: [
      {
        id: 'a1',
        name: 'Cleave',
        traits: [],
        cost: { ap: 1 },
        damage: '',
        description: '',
        overcharge: '',
        flavorText: '',
        isMinor: false,
        showActivate: true,
        uses: { max: 3, current: 2, expendOnActivate: true },
        subAbilitiesUnderDescription: [],
        subAbilitiesUnderOvercharge: [],
      },
    ],
  }
  charactersRef.current = [npc]
  // The attached record is also the store's current character — the situation
  // that gives a *player* sheet its steppers. A base NPC record is a static
  // reference the GM Screen spawns instances from, so it must stay read-only
  // here: the count reads, nothing moves it, and no write reaches the record.
  currentCharacterRef.current = npc

  render(<CustomNPCSection tabId="tab-1" section={section} mode="view" />)

  expect(
    screen.getByRole('img', { name: '2 of 3 uses remaining' }),
  ).toBeInTheDocument()
  expect(screen.queryAllByRole('button', { name: /one use of/i })).toHaveLength(0)
  expect(updateCharacter).not.toHaveBeenCalled()
})

test('an attached NPC’s modifier switch is visible but inert', () => {
  const npc: Character = {
    ...makeNPC(),
    slottedAbilities: [
      {
        id: 'a1',
        name: 'Rage',
        traits: [],
        cost: {},
        damage: '',
        description: '',
        overcharge: '',
        flavorText: '',
        isMinor: false,
        showActivate: true,
        modifiers: [{ target: 'evasion', value: 2 }],
        subAbilitiesUnderDescription: [],
        subAbilitiesUnderOvercharge: [],
      },
    ],
  }
  charactersRef.current = [npc]
  // Same trap as the limited-use test: the attached record is the store's
  // current character, which is exactly what makes a *player* sheet's switch
  // interactive. An NPC base record stays a static reference either way, so the
  // switch renders and reads but cannot be flipped, and no write reaches it.
  currentCharacterRef.current = npc

  render(<CustomNPCSection tabId="tab-1" section={section} mode="view" />)

  const toggle = screen.getByRole('switch', { name: /Apply Rage modifiers/i })
  expect(toggle).toBeDisabled()
  expect(screen.getByText('+2 Evasion')).toBeInTheDocument()

  fireEvent.click(toggle)
  expect(updateCharacter).not.toHaveBeenCalled()
})
