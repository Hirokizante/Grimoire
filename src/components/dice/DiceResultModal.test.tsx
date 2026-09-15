/**
 * Component tests for the dice result modal's two shapes.
 *
 * The store decides which one is open: a single click-to-roll expression, or an
 * activation — every roll one Activate press performed, which must read as ONE
 * action (accuracy, damage, then the author's own rolls) rather than a stack of
 * modals to dismiss.
 */

import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  putRollLogEntry: vi.fn(async () => {}),
  getAllCharacters: vi.fn(async () => []),
  getAllStatuses: vi.fn(async () => []),
  getAllScreens: vi.fn(async () => []),
  getAllVersionSnapshots: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
}))

vi.mock('@/store/rollLogStore', () => ({
  useRollLogStore: { getState: () => ({ logRoll: vi.fn() }) },
}))

import DiceResultModal from '@/components/dice/DiceResultModal'
import { useDiceRollStore } from '@/store/diceRollStore'
import { rollNotation } from '@/lib/diceRoller'
import { createDefaultNPC } from '@/constants/gameData'
import type { RollResult } from '@/lib/diceRoller'

const bandit = {
  ...createDefaultNPC(),
  id: 'npc-1',
  name: 'Bandit',
  attributes: { MAR: 3, POW: 1, AGI: 0, VIT: 0, GRT: 0 },
}

/** An activation part as the activation hook hands it to the store. */
function part(
  kind: 'accuracy' | 'damage' | 'custom',
  notation: string,
  result: RollResult = rollNotation(notation, bandit),
) {
  return {
    notation,
    kind,
    groupLabel:
      kind === 'custom' ? 'Custom' : kind === 'accuracy' ? 'Accuracy' : 'Damage',
    hidden: false,
    result,
  }
}

function openActivation(
  rolls: ReturnType<typeof part>[],
  abilityName = 'Cleave',
) {
  useDiceRollStore.setState({
    isVisible: true,
    activation: { abilityName, abilityId: 'ab-1', character: bandit, rolls },
    result: null,
    notation: '',
    source: null,
  })
}

beforeEach(() => {
  dbMap.clear()
  useDiceRollStore.setState({
    isVisible: false,
    result: null,
    notation: '',
    source: null,
    ability: null,
    rollCharacter: null,
    activation: null,
  })
})

test('an activation shows every roll together, in the order they were rolled', () => {
  openActivation([
    part('accuracy', 'd20+MAR', {
      notation: 'd20+MAR',
      total: 18,
      terms: [
        { term: { type: 'dice', count: 1, sides: 20 }, value: 15, label: '1d20', rolls: [15] },
        { term: { type: 'variable', name: 'MAR', sign: 1 }, value: 3, label: '+MAR(3)' },
      ],
      breakdown: 'd20+MAR → 15 + 3 = 18',
    }),
    part('damage', '2d6+1', {
      notation: '2d6+1',
      total: 9,
      terms: [
        { term: { type: 'dice', count: 2, sides: 6 }, value: 8, label: '2d6', rolls: [4, 4] },
        { term: { type: 'constant', value: 1, sign: 1 }, value: 1, label: '+1' },
      ],
      breakdown: '2d6+1 → 4 + 4 + 1 = 9',
    }),
    { ...part('custom', '1d6'), label: 'Burn' },
  ])

  render(<DiceResultModal onClose={vi.fn()} />)

  // The ability names the window.
  expect(screen.getByRole('heading', { name: 'Cleave' })).toBeInTheDocument()

  const group = screen.getByRole('status', { name: /activation rolls for/i })
  const cards = within(group).getAllByRole('article')
  expect(cards).toHaveLength(3)

  // Each card reads: which part, the notation, the total, the breakdown.
  expect(within(cards[0]).getByText('Accuracy')).toBeInTheDocument()
  expect(within(cards[0]).getByText('d20+MAR')).toBeInTheDocument()
  expect(within(cards[0]).getByText('18')).toBeInTheDocument()
  expect(within(cards[0]).getByText('d20+MAR → 15 + 3 = 18')).toBeInTheDocument()

  expect(within(cards[1]).getByText('Damage')).toBeInTheDocument()
  expect(within(cards[1]).getByText('9')).toBeInTheDocument()
  // Individual dice are shown, exactly as a hand-clicked roll shows them.
  expect(within(cards[1]).getAllByText('4')).toHaveLength(2)

  expect(within(cards[2]).getByText('Custom')).toBeInTheDocument()
  expect(within(cards[2]).getByText('Burn')).toBeInTheDocument()

  // Order is the roll order.
  expect(
    within(group)
      .getAllByRole('article')
      .map((card) => within(card).getAllByText(/Accuracy|Damage|Custom/)[0].textContent),
  ).toEqual(['Accuracy', 'Damage', 'Custom'])
})

test('a natural 20 on the accuracy die is badged', () => {
  openActivation([
    part('accuracy', 'd20+MAR', {
      notation: 'd20+MAR',
      total: 23,
      terms: [
        { term: { type: 'dice', count: 1, sides: 20 }, value: 20, label: '1d20', rolls: [20] },
        { term: { type: 'variable', name: 'MAR', sign: 1 }, value: 3, label: '+MAR(3)' },
      ],
      breakdown: 'd20+MAR → 20 + 3 = 23',
    }),
  ])

  render(<DiceResultModal onClose={vi.fn()} />)
  expect(screen.getByText(/NAT 20/)).toBeInTheDocument()
})

test('a hidden custom roll starts collapsed and can be revealed', () => {
  openActivation([{ ...part('custom', '1d6'), label: 'Bleed', hidden: true }])

  render(<DiceResultModal onClose={vi.fn()} />)

  // The roll happened and its total is visible; only the working is folded away.
  expect(screen.getByText('Bleed')).toBeInTheDocument()
  expect(screen.queryByText(/1d6 →/)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Show result' }))
  expect(screen.getByText(/1d6 →/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hide result' })).toBeInTheDocument()
})

test('a visible custom roll offers no reveal toggle', () => {
  openActivation([part('custom', '1d6')])

  render(<DiceResultModal onClose={vi.fn()} />)

  expect(screen.queryByRole('button', { name: /result$/ })).toBeNull()
  expect(screen.getByText(/1d6 →/)).toBeInTheDocument()
})

test('Done closes the modal', () => {
  const onClose = vi.fn()
  openActivation([part('accuracy', 'd20+MAR')])

  render(<DiceResultModal onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))

  expect(onClose).toHaveBeenCalledTimes(1)
})

test('a single roll still renders as one big total', () => {
  useDiceRollStore.setState({
    isVisible: true,
    result: rollNotation('2d6', bandit),
    notation: '2d6',
    source: { type: 'ability-damage', abilityName: 'Cleave', abilityId: 'ab-1' },
    rollCharacter: bandit,
    activation: null,
  })

  render(<DiceResultModal onClose={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'Damage: Cleave' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: /activation rolls for/i })).toBeNull()
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
})
