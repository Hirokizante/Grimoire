/**
 * Style-aware icon set tests.
 *
 * Every icon in `components/ui/icons.tsx` wraps a Lucide component and a
 * Pixelarticons counterpart behind one name. These pin the contract call sites
 * rely on: the active UI style decides the pack, both packs get the requested
 * size, Lucide keeps its own class (and therefore its existing selectors),
 * `strokeWidth` is Lucide-only, and switching the style flips every rendered
 * icon without a remount.
 */

import { act, render, screen } from '@testing-library/react'
import { beforeEach, test, expect } from 'vitest'

import { Plus } from '@/components/ui/icons'
import { useUiStyleStore } from '@/store/uiStyleStore'

beforeEach(() => {
  useUiStyleStore.setState({ style: 'default' })
})

test('default style renders the Lucide icon with its own class and size', () => {
  const { container } = render(<Plus size={16} strokeWidth={3} />)
  const svg = container.querySelector('svg')!

  expect(svg).toHaveAttribute('data-icon-pack', 'lucide')
  expect(svg).toHaveClass('lucide-plus')
  expect(svg).toHaveAttribute('width', '16')
  expect(svg).toHaveAttribute('height', '16')
  expect(svg).toHaveAttribute('stroke-width', '3')
})

test('terminal style swaps the same component to Pixelarticons', () => {
  useUiStyleStore.setState({ style: 'terminal' })
  const { container } = render(<Plus size={16} strokeWidth={3} />)
  const svg = container.querySelector('svg')!

  expect(svg).toHaveAttribute('data-icon-pack', 'pixelarticons')
  expect(svg).not.toHaveClass('lucide-plus')
  expect(svg).toHaveAttribute('width', '16')
  expect(svg).toHaveAttribute('height', '16')
  // The pixel pack draws with fills; the Lucide-only prop must not leak.
  expect(svg).not.toHaveAttribute('stroke-width')
})

test('a style switch flips the rendered pack', () => {
  render(<Plus data-testid="icon" />)

  expect(screen.getByTestId('icon')).toHaveAttribute(
    'data-icon-pack',
    'lucide',
  )
  act(() => useUiStyleStore.getState().setStyle('terminal'))
  expect(screen.getByTestId('icon')).toHaveAttribute(
    'data-icon-pack',
    'pixelarticons',
  )
})
