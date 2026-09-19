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
  useRollLogStore: {
    getState: () => ({
      logRoll: vi.fn(),
      updateEntryResult: vi.fn(),
    }),
  },
}))

/** Deterministic d6s for advantage rolls, consumed in roll order. */
const rollQueue: number[] = []
vi.mock('@/lib/dice', () => ({
  rollDie: () => rollQueue.shift() ?? 1,
}))

import DiceResultModal from '@/components/dice/DiceResultModal'
import { useDiceRollStore, type ActivationRollRequest } from '@/store/diceRollStore'
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
): ActivationRollRequest {
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
  rolls: ActivationRollRequest[],
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
  rollQueue.length = 0
  useDiceRollStore.setState({
    isVisible: false,
    result: null,
    notation: '',
    source: null,
    ability: null,
    rollCharacter: null,
    activation: null,
    rollLogEntryId: null,
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

test('the modal offers a capture button for the whole roll result', () => {
  openActivation([part('accuracy', 'd20+MAR')])

  render(<DiceResultModal onClose={vi.fn()} />)

  const button = screen.getByRole('button', { name: 'Copy roll result image' })
  // The snapshot target is the dialog itself, and the control keeps itself
  // out of the shot.
  expect(button.closest('.dice-modal')).not.toBeNull()
  expect(button).toHaveAttribute('data-capture-hide')
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

// ---- Advantage / Disadvantage -----------------------------------------------

test('a single roll can roll advantage and fold it into the total', () => {
  useDiceRollStore.setState({
    isVisible: true,
    result: {
      notation: 'd20+MAR',
      total: 10,
      terms: [
        { term: { type: 'dice', count: 1, sides: 20 }, value: 7, label: '1d20', rolls: [7] },
        { term: { type: 'variable', name: 'MAR', sign: 1 }, value: 3, label: '+MAR(3)' },
      ],
      breakdown: 'd20+MAR → 7 + 3 = 10',
    },
    notation: 'd20+MAR',
    source: { type: 'attribute-check', attributeKey: 'MAR', attributeName: 'Martial' },
    rollCharacter: bandit,
    activation: null,
    rollLogEntryId: 'log-1',
  })

  render(<DiceResultModal onClose={vi.fn()} />)

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Roll advantage' }), {
    target: { value: '2' },
  })
  rollQueue.push(3, 6)
  fireEvent.click(screen.getByRole('button', { name: 'Roll Advantage' }))

  // The new total already includes the highest d6, and the adjustment is shown.
  expect(screen.getByRole('heading', { name: '16' })).toBeInTheDocument()
  expect(screen.getByText('Advantage +2')).toBeInTheDocument()
  expect(screen.getByText('+6')).toBeInTheDocument()
})

test('clearing advantage from the modal restores the base total', () => {
  useDiceRollStore.setState({
    isVisible: true,
    result: {
      notation: '1d20',
      total: 13,
      terms: [
        { term: { type: 'dice', count: 1, sides: 20 }, value: 3, label: '1d20', rolls: [3] },
      ],
      breakdown: '1d20 → 3 = 3',
      advantage: {
        kind: 'advantage',
        dice: 1,
        rolls: [10],
        modifier: 10,
        baseTotal: 3,
        advantage: 1,
        disadvantage: 0,
      },
    },
    notation: '1d20',
    source: { type: 'manual' },
    rollCharacter: bandit,
    activation: null,
    rollLogEntryId: 'log-1',
  })

  render(<DiceResultModal onClose={vi.fn()} />)

  // The applied value is pre-filled so the user can see (and change) it.
  expect(screen.getByRole('spinbutton', { name: 'Roll advantage' })).toHaveValue(1)

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Roll advantage' }), {
    target: { value: '0' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

  expect(screen.getByRole('heading', { name: '3' })).toBeInTheDocument()
  expect(screen.queryByText(/Advantage \+1/)).toBeNull()
})

test('an activation roll can roll its own advantage', () => {
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
  ])
  render(<DiceResultModal onClose={vi.fn()} />)

  const card = screen.getByRole('article')
  fireEvent.change(
    within(card).getByRole('spinbutton', { name: 'Accuracy advantage' }),
    { target: { value: '1' } },
  )
  rollQueue.push(5)
  fireEvent.click(within(card).getByRole('button', { name: 'Roll Advantage' }))

  expect(within(card).getByText('23')).toBeInTheDocument()
  expect(within(card).getByText('Advantage +1')).toBeInTheDocument()
})

test('an authored activation advantage arrives pre-filled and applied', () => {
  const applied = {
    kind: 'advantage' as const,
    dice: 1,
    rolls: [5],
    modifier: 5,
    baseTotal: 13,
    advantage: 1,
    disadvantage: 0,
  }
  openActivation([
    {
      ...part('accuracy', 'd20+MAR', {
        notation: 'd20+MAR',
        total: 18,
        terms: [
          { term: { type: 'dice', count: 1, sides: 20 }, value: 10, label: '1d20', rolls: [10] },
          { term: { type: 'variable', name: 'MAR', sign: 1 }, value: 3, label: '+MAR(3)' },
        ],
        breakdown: 'd20+MAR → 10 + 3 = 13',
        advantage: applied,
      }),
      advantage: 1,
      disadvantage: 0,
    },
  ])

  render(<DiceResultModal onClose={vi.fn()} />)

  expect(
    screen.getByRole('spinbutton', { name: 'Accuracy advantage' }),
  ).toHaveValue(1)
  expect(screen.getByText('Advantage +1')).toBeInTheDocument()
  expect(screen.getByText('18')).toBeInTheDocument()
})

// ---- Critical hits -----------------------------------------------------------

test('a manual damage roll offers the critical control instead of advantage', () => {
  useDiceRollStore.setState({
    isVisible: true,
    result: {
      notation: '2d6',
      total: 7,
      terms: [
        { term: { type: 'dice', count: 2, sides: 6 }, value: 7, label: '2d6', rolls: [3, 4] },
      ],
      breakdown: '2d6 → 3 + 4 = 7',
    },
    notation: '2d6',
    source: { type: 'ability-damage', abilityName: 'Cleave', abilityId: 'ab-1' },
    rollCharacter: bandit,
    activation: null,
    rollLogEntryId: 'log-1',
  })

  render(<DiceResultModal onClose={vi.fn()} />)

  // Damage replaces Advantage/Disadvantage with the critical control.
  expect(screen.queryByRole('spinbutton', { name: 'Roll advantage' })).toBeNull()
  const toggle = screen.getByRole('button', { name: 'Critical Hit' })
  expect(toggle).toBeInTheDocument()

  // Marking it rolls the damage again and keeps the higher result.
  rollQueue.push(5, 6)
  fireEvent.click(toggle)

  expect(screen.getByRole('heading', { name: '11' })).toBeInTheDocument()
  expect(screen.getByText('Critical hit')).toBeInTheDocument()
  expect(screen.getByText('keeps 11')).toBeInTheDocument()
  const chips = document.querySelectorAll('.dice-critical__roll')
  expect([...chips].map((chip) => chip.textContent)).toEqual(['7', '11'])
  expect(document.querySelector('.dice-critical__roll--kept')?.textContent).toBe(
    '11',
  )

  // Removing it restores the first roll.
  fireEvent.click(screen.getByRole('button', { name: 'Remove Critical' }))
  expect(screen.getByRole('heading', { name: '7' })).toBeInTheDocument()
  expect(document.querySelector('.dice-critical__result')).toBeNull()
})

test('a damage activation card carries the critical control', () => {
  openActivation([
    part('damage', '2d6', {
      notation: '2d6',
      total: 7,
      terms: [
        { term: { type: 'dice', count: 2, sides: 6 }, value: 7, label: '2d6', rolls: [3, 4] },
      ],
      breakdown: '2d6 → 3 + 4 = 7',
    }),
  ])
  render(<DiceResultModal onClose={vi.fn()} />)

  const card = screen.getByRole('article')
  expect(within(card).queryByRole('spinbutton')).toBeNull()

  rollQueue.push(5, 6)
  fireEvent.click(within(card).getByRole('button', { name: 'Critical Hit' }))

  expect(within(card).getByText('Critical hit')).toBeInTheDocument()
  expect(within(card).getByText('keeps 11')).toBeInTheDocument()
  expect(
    within(card).getByText('11', { selector: '.dice-activation__roll-total' }),
  ).toBeInTheDocument()
})

test('an auto-critical damage roll arrives marked and can be removed', () => {
  openActivation([
    part('damage', '2d6', {
      notation: '2d6',
      total: 11,
      terms: [
        { term: { type: 'dice', count: 2, sides: 6 }, value: 11, label: '2d6', rolls: [5, 6] },
      ],
      breakdown: '2d6 → 5 + 6 = 11',
      critical: {
        chosen: 1,
        rolls: [
          {
            total: 7,
            terms: [
              { term: { type: 'dice', count: 2, sides: 6 }, value: 7, label: '2d6', rolls: [3, 4] },
            ],
            breakdown: '2d6 → 3 + 4 = 7',
          },
          {
            total: 11,
            terms: [
              { term: { type: 'dice', count: 2, sides: 6 }, value: 11, label: '2d6', rolls: [5, 6] },
            ],
            breakdown: '2d6 → 5 + 6 = 11',
          },
        ],
      },
    }),
  ])
  render(<DiceResultModal onClose={vi.fn()} />)

  const card = screen.getByRole('article')
  expect(within(card).getByText('✦ CRIT')).toBeInTheDocument()
  expect(
    within(card).getByRole('button', { name: 'Remove Critical' }),
  ).toBeInTheDocument()

  fireEvent.click(within(card).getByRole('button', { name: 'Remove Critical' }))

  expect(within(card).queryByText('✦ CRIT')).toBeNull()
  expect(
    within(card).getByText('7', { selector: '.dice-activation__roll-total' }),
  ).toBeInTheDocument()
})
