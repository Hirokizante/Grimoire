/**
 * Component tests for the stat/attribute modifier editor rows.
 *
 * `AbilityModifierFields` is fully controlled, so these tests drive it through
 * a small stateful harness and assert both the emitted modifier list and the
 * rendered controls (target picker, +/− toggle, amount, remove).
 */

import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import AbilityModifierFields from '@/components/sheet/AbilityModifierFields'
import type { AbilityStatModifier } from '@/types'

/** Stateful wrapper so the controlled component behaves like in the editor. */
function Harness({
  initial = [],
  npcMode = false,
  onChange,
}: {
  initial?: AbilityStatModifier[]
  npcMode?: boolean
  onChange?: (mods: AbilityStatModifier[]) => void
}) {
  const [mods, setMods] = useState<AbilityStatModifier[]>(initial)
  return (
    <AbilityModifierFields
      modifiers={mods}
      npcMode={npcMode}
      onChange={(next) => {
        setMods(next)
        onChange?.(next)
      }}
    />
  )
}

test('checking the box seeds a first modifier row', () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)

  expect(screen.queryByRole('list')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('checkbox'))
  expect(onChange).toHaveBeenCalledWith([{ target: 'evasion', value: 1 }])
  // The seeded row is rendered with its own +/− control and amount input.
  expect(screen.getByRole('group', { name: /evasion: add or subtract/i })).toBeInTheDocument()
  expect(screen.getByLabelText('Evasion amount')).toHaveValue(1)
})

test('unchecking the box clears every modifier', () => {
  const onChange = vi.fn()
  render(
    <Harness
      initial={[
        { target: 'evasion', value: 2 },
        { target: 'MAR', value: -1 },
      ]}
      onChange={onChange}
    />,
  )

  fireEvent.click(screen.getByRole('checkbox'))
  expect(onChange).toHaveBeenCalledWith([])
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('the +/− control flips the stored sign', () => {
  render(<Harness initial={[{ target: 'evasion', value: 2 }]} />)

  fireEvent.click(screen.getByRole('button', { name: '−' }))
  expect(screen.getByLabelText('Evasion amount')).toHaveValue(2)
  expect(
    screen.getByRole('button', { name: '−' }),
  ).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(screen.getByRole('button', { name: '+' }))
  expect(screen.getByRole('button', { name: '+' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('the amount input stores a magnitude and keeps the current sign', () => {
  const onChange = vi.fn()
  render(
    <Harness initial={[{ target: 'armor', value: -1 }]} onChange={onChange} />,
  )

  fireEvent.change(screen.getByLabelText('Armor amount'), {
    target: { value: '3' },
  })
  expect(onChange).toHaveBeenLastCalledWith([{ target: 'armor', value: -3 }])
})

test('a second modifier can be added and the first one removed', () => {
  render(<Harness initial={[{ target: 'evasion', value: 1 }]} />)

  fireEvent.click(screen.getByRole('button', { name: /add stat or attribute modifier/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Armor' }))

  expect(screen.getByLabelText('Evasion amount')).toBeInTheDocument()
  expect(screen.getByLabelText('Armor amount')).toHaveValue(1)

  const row = screen.getByRole('group', { name: /evasion: add or subtract/i })
    .parentElement as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: /remove evasion modifier/i }))

  expect(screen.queryByLabelText('Evasion amount')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Armor amount')).toBeInTheDocument()
})

test('NPC sheets cannot target END Recovery', () => {
  render(<Harness npcMode initial={[{ target: 'evasion', value: 1 }]} />)

  fireEvent.click(screen.getByRole('button', { name: /add stat or attribute modifier/i }))

  const panel = screen.getByRole('dialog', { name: 'Add Modifier' })
  expect(within(panel).queryByRole('button', { name: 'END Recovery' })).toBeNull()
  expect(within(panel).getByRole('button', { name: 'Max HP' })).toBeInTheDocument()
})
