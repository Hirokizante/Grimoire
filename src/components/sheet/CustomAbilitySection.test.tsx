import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import CustomAbilitySection from '@/components/sheet/CustomAbilitySection'
import type { CustomAbilitySection as CustomAbilitySectionType } from '@/types'

const { removeCustomSection } = vi.hoisted(() => ({
  removeCustomSection: vi.fn(),
}))

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addCustomAbility: vi.fn(),
      updateCustomAbility: vi.fn(),
      renameCustomSection: vi.fn(),
      removeCustomSection,
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
  id: 'section-1',
  name: 'Offense',
  abilities: [],
}

beforeEach(() => {
  removeCustomSection.mockReset()
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
