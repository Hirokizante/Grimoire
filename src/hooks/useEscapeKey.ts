/**
 * useEscapeKey — registers a keydown listener that fires `onClose` when the
 * Escape key is pressed. The listener is only active while `active` is true,
 * and is cleaned up on unmount or when `active` flips to false.
 *
 * All modal dialogs in Grimoire use this hook for consistent Escape-to-close
 * behavior.
 */
import { useEffect } from 'react'

export function useEscapeKey(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, onClose])
}
