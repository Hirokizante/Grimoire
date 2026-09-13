import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import CustomAbilitySection from '@/components/sheet/CustomAbilitySection'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter } from '@/constants/gameData'
import type {
  AbilityBlock,
  CustomAbilitySection as CustomAbilitySectionType,
} from '@/types'

const { removeCustomSection, setAbilityUsesRemaining, reorderCustomSection } =
  vi.hoisted(() => ({
    removeCustomSection: vi.fn(),
    setAbilityUsesRemaining: vi.fn(),
    reorderCustomSection: vi.fn(),
  }))

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addCustomAbility: vi.fn(),
      updateCustomAbility: vi.fn(),
      renameCustomSection: vi.fn(),
      removeCustomSection,
      reorderCustomSection,
      addCustomNPCSection: vi.fn(() => 'npc-section'),
      currentCharacter: { ...createDefaultCharacter(), id: 'char-1' },
      setAbilityUsesRemaining,
    }),
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

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  }
})

const section: CustomAbilitySectionType = {
  kind: 'ability',
  id: 'section-1',
  name: 'Offense',
  abilities: [],
}

beforeEach(() => {
  removeCustomSection.mockReset()
  setAbilityUsesRemaining.mockReset()
  reorderCustomSection.mockReset()
})

test('deletes a custom ability section after confirmation in edit mode', () => {
  render(
    <CustomAbilitySection
      tabId="tab-1"
      section={section}
      mode="edit"
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Delete Offense section' }))

  expect(screen.getByRole('dialog', { name: 'Delete Section?' })).toBeInTheDocument()
  expect(removeCustomSection).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

  expect(removeCustomSection).toHaveBeenCalledWith(
    'tab-1',
    'section-1',
  )
})

test('does not show section deletion in view mode', () => {
  render(
    <CustomAbilitySection
      tabId="tab-1"
      section={section}
      mode="view"
    />,
  )

  expect(
    screen.queryByRole('button', { name: 'Delete Offense section' }),
  ).not.toBeInTheDocument()
})

// ---- Section reordering ----------------------------------------------------

test('edit mode offers the reorder arrows, wired to this section’s position', () => {
  render(
    <CustomAbilitySection
      tabId="tab-1"
      section={section}
      mode="edit"
      index={1}
      count={3}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Move Offense down' }))
  expect(reorderCustomSection).toHaveBeenCalledWith('tab-1', 1, 2)
})

test('view mode shows no reorder arrows', () => {
  render(
    <CustomAbilitySection
      tabId="tab-1"
      section={section}
      mode="view"
      index={1}
      count={3}
    />,
  )

  expect(
    screen.queryByRole('button', { name: 'Move Offense up' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Move Offense down' }),
  ).not.toBeInTheDocument()
})

// ---- Limited uses ----------------------------------------------------------

/** A custom-tab ability with a 3-use budget. */
function limitedAbility(): AbilityBlock {
  return {
    id: 'ability-1',
    name: 'Custom Nova',
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
    uses: { max: 3, current: 3, expendOnActivate: true },
  }
}

/** The section holding one limited ability. */
function sectionWithAbility(): CustomAbilitySectionType {
  return { ...section, abilities: [limitedAbility()] }
}

test('a custom-tab ability keeps its uses meter and steppers in view mode', () => {
  render(
    <NotificationProvider>
      <CustomAbilitySection
        tabId="tab-1"
        section={sectionWithAbility()}
        mode="view"
      />
    </NotificationProvider>,
  )

  expect(
    screen.getByRole('img', { name: '3 of 3 uses remaining' }),
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /spend one use of/i }))
  expect(setAbilityUsesRemaining).toHaveBeenCalledWith('char-1', 'ability-1', 2)
})

test('a custom-tab ability keeps its steppers in edit mode too', () => {
  render(
    <NotificationProvider>
      <CustomAbilitySection
        tabId="tab-1"
        section={sectionWithAbility()}
        mode="edit"
      />
    </NotificationProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: /spend one use of/i }))
  expect(setAbilityUsesRemaining).toHaveBeenCalledWith('char-1', 'ability-1', 2)
})

test('an unlimited custom-tab ability renders no meter at all', () => {
  const plain: CustomAbilitySectionType = {
    ...section,
    abilities: [{ ...limitedAbility(), uses: undefined }],
  }

  render(
    <NotificationProvider>
      <CustomAbilitySection tabId="tab-1" section={plain} mode="view" />
    </NotificationProvider>,
  )

  expect(screen.queryByRole('img', { name: /uses remaining/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /spend one use of/i })).toBeNull()
})
