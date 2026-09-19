/**
 * CaptureButton — a small ghost icon button that snapshots the element it
 * lives in and copies the image to the clipboard.
 *
 * It finds its target with a CSS selector resolved against itself, so a card
 * can drop it anywhere inside its own markup without threading a ref: an
 * Ability Block asks for `.ability-card`, a Sub-Ability for
 * `.sub-ability-block`, the roll result for `.dice-modal`.
 *
 * The button hides itself for the shot (see {@link CAPTURE_HIDE_ATTRIBUTE}),
 * reports progress in place (spinner → check → idle; warning triangle on
 * failure), and raises the usual toast when a notification provider is around
 * — which it is not in every test surface, hence the optional hook.
 *
 * Deliberately tiny and quiet: an icon-only `.btn--icon` with a muted resting
 * color, meant to be discovered rather than to compete with the card.
 */

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Loader2, TriangleAlert } from 'lucide-react'

import { CAPTURE_HIDE_ATTRIBUTE, copyElementImage } from '@/lib/elementCapture'
import { useOptionalNotification } from '@/context/NotificationContext'

type CaptureStatus = 'idle' | 'capturing' | 'copied' | 'error'

/** How long the result icon stays up before returning to the camera. */
const FEEDBACK_MS = 1600

export interface CaptureButtonProps {
  /** CSS selector, resolved against the button, for the element to snapshot. */
  targetSelector: string
  /** Human-readable target for labels and toasts, e.g. "ability". */
  target: string
  /** File name used when the clipboard is unavailable and the image downloads. */
  fileName: string
  className?: string
}

export default function CaptureButton({
  targetSelector,
  target,
  fileName,
  className,
}: CaptureButtonProps) {
  const [status, setStatus] = useState<CaptureStatus>('idle')
  const feedbackTimer = useRef<number | null>(null)
  const notify = useOptionalNotification()

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
    },
    [],
  )

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (status === 'capturing') return
    const element = event.currentTarget.closest<HTMLElement>(targetSelector)
    if (!element) return

    setStatus('capturing')
    void copyElementImage(element, fileName)
      .then(({ method }) => {
        setStatus('copied')
        notify?.notify(
          method === 'clipboard'
            ? `Copied the ${target} image to the clipboard.`
            : `Clipboard unavailable — the ${target} image was saved to your device.`,
          method === 'clipboard' ? 'success' : 'warning',
        )
      })
      .catch(() => {
        setStatus('error')
        notify?.notify(`Could not capture the ${target} image.`, 'error')
      })
      .finally(() => {
        if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
        feedbackTimer.current = window.setTimeout(() => setStatus('idle'), FEEDBACK_MS)
      })
  }

  const label =
    status === 'capturing'
      ? `Capturing ${target}…`
      : status === 'copied'
        ? 'Copied!'
        : status === 'error'
          ? 'Capture failed'
          : `Copy ${target} image`
  const Icon =
    status === 'capturing'
      ? Loader2
      : status === 'copied'
        ? Check
        : status === 'error'
          ? TriangleAlert
          : Camera

  return (
    <button
      type="button"
      className={`btn btn--icon capture-btn capture-btn--${status}${
        className ? ` ${className}` : ''
      }`}
      onClick={handleClick}
      disabled={status === 'capturing'}
      title={label}
      aria-label={label}
      {...{ [CAPTURE_HIDE_ATTRIBUTE]: '' }}
    >
      <Icon
        size={14}
        className={status === 'capturing' ? 'capture-btn__spin' : undefined}
        aria-hidden="true"
      />
    </button>
  )
}
