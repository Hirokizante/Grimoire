import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import CustomNPCSection from '@/components/sheet/CustomNPCSection'
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
const { roll, removeCustomSection, charactersRef } = vi.hoisted(() => ({
  roll: vi.fn(),
  removeCustomSection: vi.fn(),
  charactersRef: { current: [] as Character[] },
}))

// The NPC is selected from the character store's `characters` list, so the
// mock must expose a real `characters` array the test can populate.
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      characters: charactersRef.current,
      removeCustomSection,
    }),
}))

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
  roll.mockReset()
  removeCustomSection.mockReset()
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
