/**
 * CaptureButton tests.
 *
 * The button's contract: it snapshots the nearest ancestor matching its
 * selector, reports progress in place, raises a toast when a provider exists
 * (and quietly works without one), and never inserts a toggle into the
 * snapshot — it carries the hide attribute instead.
 */

import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { NotificationProvider } from '@/context/NotificationContext'

const { copyElementImage } = vi.hoisted(() => ({ copyElementImage: vi.fn() }))

vi.mock('@/lib/elementCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/elementCapture')>()
  return { ...actual, copyElementImage }
})

import CaptureButton from '@/components/ui/CaptureButton'
import { CAPTURE_HIDE_ATTRIBUTE } from '@/lib/elementCapture'

function renderInCard(ui?: React.ReactNode) {
  return render(
    <div className="ability-card" data-testid="card">
      <CaptureButton
        targetSelector=".ability-card"
        target="ability"
        fileName="grimoire-ability-test.png"
      />
      {ui}
    </div>,
  )
}

const clickCapture = (name = 'Copy ability image') =>
  fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  copyElementImage.mockReset()
})

test('snapshots the nearest matching ancestor and labels its states', async () => {
  let resolveCapture: (value: { method: 'clipboard' | 'download' }) => void = () => {}
  copyElementImage.mockReturnValue(
    new Promise((resolve) => {
      resolveCapture = resolve
    }),
  )

  renderInCard()
  const button = screen.getByRole('button', { name: 'Copy ability image' })
  expect(button).toHaveAttribute(CAPTURE_HIDE_ATTRIBUTE)

  fireEvent.click(button)

  const card = screen.getByTestId('card')
  expect(copyElementImage).toHaveBeenCalledWith(
    card,
    'grimoire-ability-test.png',
  )
  expect(screen.getByRole('button', { name: 'Capturing ability…' })).toBeDisabled()

  resolveCapture({ method: 'clipboard' })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument(),
  )
})

test('toasts the outcome when a notification provider is present', async () => {
  copyElementImage.mockResolvedValue({ method: 'clipboard' })

  render(
    <NotificationProvider>
      <div className="ability-card">
        <CaptureButton
          targetSelector=".ability-card"
          target="ability"
          fileName="shot.png"
        />
      </div>
    </NotificationProvider>,
  )
  clickCapture()

  await waitFor(() =>
    expect(
      screen.getByText('Copied the ability image to the clipboard.'),
    ).toBeInTheDocument(),
  )
})

test('a download outcome is reported as a warning', async () => {
  copyElementImage.mockResolvedValue({ method: 'download' })

  render(
    <NotificationProvider>
      <div className="ability-card">
        <CaptureButton
          targetSelector=".ability-card"
          target="roll result"
          fileName="shot.png"
        />
      </div>
    </NotificationProvider>,
  )
  clickCapture('Copy roll result image')

  await waitFor(() =>
    expect(
      screen.getByText(
        'Clipboard unavailable — the roll result image was saved to your device.',
      ),
    ).toBeInTheDocument(),
  )
})

test('a failed capture shows the warning state and toast', async () => {
  copyElementImage.mockRejectedValue(new Error('boom'))

  render(
    <NotificationProvider>
      <div className="ability-card">
        <CaptureButton
          targetSelector=".ability-card"
          target="ability"
          fileName="shot.png"
        />
      </div>
    </NotificationProvider>,
  )
  clickCapture()

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Capture failed' })).toBeInTheDocument(),
  )
  expect(screen.getByText('Could not capture the ability image.')).toBeInTheDocument()
})

test('works without a notification provider', async () => {
  copyElementImage.mockResolvedValue({ method: 'clipboard' })

  renderInCard()
  clickCapture()

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument(),
  )
})

test('does nothing when the target is missing', () => {
  copyElementImage.mockResolvedValue({ method: 'clipboard' })

  render(
    <CaptureButton
      targetSelector=".ability-card"
      target="ability"
      fileName="shot.png"
    />,
  )

  clickCapture()
  expect(copyElementImage).not.toHaveBeenCalled()
})
