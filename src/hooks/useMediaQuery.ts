/**
 * useMediaQuery — subscribe to a CSS media query from React.
 *
 * Used by the GM Screen to pick its column count (3 / 2 / 1) so the panel
 * distribution matches the CSS breakpoints exactly. Falls back to `false`
 * when `matchMedia` is unavailable (jsdom in tests, very old browsers).
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}

export default useMediaQuery
