/**
 * SectionReorderButtons — the ↑/↓ pair every custom section's heading row
 * renders in edit mode.
 *
 * The parent (CustomTabContent) supplies the section's index and the tab's
 * section count, so these tests pin the two things the control owns: which
 * arrow is live at each position, and that a click asks the store for a
 * one-place move — never a jump, never a write off either end.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import SectionReorderButtons from '@/components/sheet/SectionReorderButtons'

const { reorderCustomSection } = vi.hoisted(() => ({
  reorderCustomSection: vi.fn(),
}))

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ reorderCustomSection }),
}))

beforeEach(() => {
  reorderCustomSection.mockReset()
})

test('the first section can move down but not up', () => {
  render(
    <SectionReorderButtons tabId="tab-1" index={0} count={3} name="Offense" />,
  )

  expect(screen.getByRole('button', { name: 'Move Offense up' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Move Offense down' })).toBeEnabled()
})

test('a middle section moves one place either way', () => {
  render(
    <SectionReorderButtons tabId="tab-1" index={1} count={3} name="Offense" />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Move Offense up' }))
  expect(reorderCustomSection).toHaveBeenCalledWith('tab-1', 1, 0)

  fireEvent.click(screen.getByRole('button', { name: 'Move Offense down' }))
  expect(reorderCustomSection).toHaveBeenCalledWith('tab-1', 1, 2)
})

test('the last section can move up but not down', () => {
  render(
    <SectionReorderButtons tabId="tab-1" index={2} count={3} name="Offense" />,
  )

  expect(screen.getByRole('button', { name: 'Move Offense up' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Move Offense down' })).toBeDisabled()
})

test('a tab with one section shows both arrows disabled', () => {
  render(
    <SectionReorderButtons tabId="tab-1" index={0} count={1} name="Offense" />,
  )

  // The pair stays visible (the heading row never reflows) but neither arrow
  // can start a move.
  expect(screen.getByRole('button', { name: 'Move Offense up' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Move Offense down' })).toBeDisabled()
  expect(reorderCustomSection).not.toHaveBeenCalled()
})

test('a disabled arrow is inert when clicked', () => {
  render(
    <SectionReorderButtons tabId="tab-1" index={0} count={2} name="Offense" />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Move Offense up' }))

  expect(reorderCustomSection).not.toHaveBeenCalled()
})
