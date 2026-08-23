/**
 * useModalDialog — shared behavior for every Grimoire modal dialog.
 *
 * Bundles the standard modal interactions in one place so all dialogs
 * behave uniformly:
 *
 *   1. Body scroll lock — the page behind the overlay cannot scroll or
 *      rubber-band while a modal is open. Counter-based, so stacked/nested
 *      modals keep the lock until the last one closes, with scrollbar-width
 *      compensation on desktop to avoid layout shift.
 *   2. Escape to close — replaces a standalone useEscapeKey call.
 *   3. Focus management — focus moves into the dialog on open (unless the
 *      dialog already auto-focused something, e.g. React autoFocus inputs),
 *      Tab / Shift+Tab cycle inside the overlay (nested confirms included),
 *      and focus returns to the previously-focused element on close. This
 *      makes the existing aria-modal="true" honest for keyboard users too.
 *
 * Usage:
 *   const dialogRef = useModalDialog(onClose, open)
 *   ...
 *   <div
 *     className="modal-content …"
 *     ref={dialogRef}
 *     tabIndex={-1}
 *     role="dialog"
 *     aria-modal="true"
 *   >
 *
 * The ref goes on the dialog panel (.modal-content); the focus trap scopes
 * itself to the enclosing .modal-overlay so stacked dialogs (e.g. a
 * ConfirmModal rendered over ExportDialog) participate in the same cycle.
 */

import { useEffect, useRef } from 'react'

/** Selector for elements that can receive keyboard focus. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/** How many open dialogs currently hold the body scroll lock. */
let openDialogCount = 0

function lockBodyScroll() {
  if (openDialogCount === 0) {
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    // Reserve the scrollbar's width so the page doesn't visibly shift when
    // the bar disappears (desktop only — mobile browsers overlay it).
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
  }
  openDialogCount += 1
}

function unlockBodyScroll() {
  openDialogCount = Math.max(0, openDialogCount - 1)
  if (openDialogCount === 0) {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}

export function useModalDialog(onClose: () => void, active = true) {
  /** Attach to the dialog panel (`.modal-content`). */
  const dialogRef = useRef<HTMLDivElement>(null)

  // Keep the latest callback reachable from the effect below without
  // re-running it (parents pass inline arrows whose identity changes every
  // render — re-running would re-lock scroll and yank focus mid-typing).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) return

    lockBodyScroll()

    // Remember where focus came from so it can be restored on close.
    const previousFocus = document.activeElement as HTMLElement | null

    // Move focus into the dialog. Skip if something inside is already
    // focused (components with React autoFocus inputs focus them during
    // mount, before this effect runs).
    const focusFrame = requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog || dialog.contains(document.activeElement)) return
      dialog.focus()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab') return

      // Trap Tab inside the overlay (not just this panel) so nested
      // dialogs — e.g. a ConfirmModal rendered over ExportDialog — are
      // part of the cycle.
      const dialog = dialogRef.current
      const scope = dialog?.closest('.modal-overlay')
      if (!dialog || !scope) return

      const focusable = Array.from(
        scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement
      const insideScope =
        current instanceof Node && scope.contains(current)

      if (e.shiftKey) {
        if (current === first || !insideScope) {
          e.preventDefault()
          last.focus()
        }
      } else if (current === last || !insideScope) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      cancelAnimationFrame(focusFrame)
      unlockBodyScroll()
      if (previousFocus && previousFocus.isConnected) {
        previousFocus.focus()
      }
    }
  }, [active])

  return dialogRef
}
