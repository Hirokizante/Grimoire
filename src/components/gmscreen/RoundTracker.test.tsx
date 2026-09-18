/**
 * Component tests for the GM Screen's round tracker.
 *
 * The tracker is two controls in one pill group: a directly editable round
 * number and the **New Round** action. These tests pin the split — typing
 * writes the round (on blur/Enter, never per keystroke, so a mid-edit value is
 * not clamped while it is being typed) and the button runs the encounter
 * action, which is what starts every panel's turn.
 */

import { test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import RoundTracker from '@/components/gmscreen/RoundTracker'

test('RoundTracker: shows the committed round', () => {
  render(<RoundTracker round={4} onRoundChange={() => {}} onNewRound={() => {}} />)
  expect(screen.getByLabelText('Round')).toHaveValue(4)
})

test('RoundTracker: typing a value commits on blur, not per keystroke', () => {
  const onRoundChange = vi.fn()
  render(<RoundTracker round={2} onRoundChange={onRoundChange} onNewRound={() => {}} />)

  const input = screen.getByLabelText('Round')
  fireEvent.change(input, { target: { value: '7' } })
  // The write happens on commit — a per-keystroke write would clamp the field
  // mid-edit (an emptied field snapping back to the current round).
  expect(onRoundChange).not.toHaveBeenCalled()

  fireEvent.blur(input)
  expect(onRoundChange).toHaveBeenCalledTimes(1)
  expect(onRoundChange).toHaveBeenCalledWith(7)
})

test('RoundTracker: Enter commits, and an unreadable value writes nothing', () => {
  const onRoundChange = vi.fn()
  render(<RoundTracker round={3} onRoundChange={onRoundChange} onNewRound={() => {}} />)

  const input = screen.getByLabelText('Round')
  input.focus()
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onRoundChange).not.toHaveBeenCalled()
  // The empty draft is dropped: the field reads the committed value again.
  expect(input).toHaveValue(3)

  input.focus()
  fireEvent.change(input, { target: { value: '5' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onRoundChange).toHaveBeenCalledTimes(1)
  expect(onRoundChange).toHaveBeenCalledWith(5)
})

test('RoundTracker: New Round runs the encounter action, not a manual edit', () => {
  const onRoundChange = vi.fn()
  const onNewRound = vi.fn()
  render(<RoundTracker round={1} onRoundChange={onRoundChange} onNewRound={onNewRound} />)

  fireEvent.click(screen.getByRole('button', { name: 'New Round' }))

  expect(onNewRound).toHaveBeenCalledTimes(1)
  expect(onRoundChange).not.toHaveBeenCalled()
})
