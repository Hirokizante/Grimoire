import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import CustomTextSection from '@/components/sheet/CustomTextSection'
import type { CustomTextSection as CustomTextSectionType } from '@/types'

const { renameCustomSection, removeCustomSection, updateContent } = vi.hoisted(() => ({
  renameCustomSection: vi.fn(),
  removeCustomSection: vi.fn(),
  updateContent: vi.fn(),
}))

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      renameCustomSection,
      removeCustomSection,
      updateCustomTextSectionContent: updateContent,
    }),
}))

const section: CustomTextSectionType = {
  kind: 'text',
  id: 'section-1',
  name: 'Backstory',
  content: '',
}

beforeEach(() => {
  renameCustomSection.mockReset()
  removeCustomSection.mockReset()
  updateContent.mockReset()
})

test('renders an editable textarea in edit mode', () => {
  render(<CustomTextSection tabId="tab-1" section={section} mode="edit" />)

  const textarea = screen.getByPlaceholderText(/Describe unique mechanics/i)
  expect(textarea).toBeInTheDocument()

  fireEvent.change(textarea, { target: { value: 'Born under a blood moon.' } })
  expect(updateContent).toHaveBeenCalledWith('tab-1', 'section-1', 'Born under a blood moon.')
})

test('renders markdown content in view mode', () => {
  const filled: CustomTextSectionType = {
    ...section,
    content: '**Iron** pact with the old gods.',
  }
  render(<CustomTextSection tabId="tab-1" section={filled} mode="view" />)

  expect(screen.getByText('Iron')).toBeInTheDocument()
  expect(screen.getByText('pact with the old gods.')).toBeInTheDocument()
})

test('shows an empty message in view mode when there is no content', () => {
  render(<CustomTextSection tabId="tab-1" section={section} mode="view" />)
  expect(screen.getByText('No text in this section.')).toBeInTheDocument()
})

test('deletes the section after confirmation in edit mode', () => {
  render(<CustomTextSection tabId="tab-1" section={section} mode="edit" />)

  fireEvent.click(screen.getByRole('button', { name: 'Delete Backstory section' }))

  expect(screen.getByRole('dialog', { name: 'Delete Section?' })).toBeInTheDocument()
  expect(removeCustomSection).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

  expect(removeCustomSection).toHaveBeenCalledWith('tab-1', 'section-1')
})

test('does not show section deletion in view mode', () => {
  render(<CustomTextSection tabId="tab-1" section={section} mode="view" />)
  expect(
    screen.queryByRole('button', { name: 'Delete Backstory section' }),
  ).not.toBeInTheDocument()
})
