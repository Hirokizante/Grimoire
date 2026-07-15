/**
 * useImportedFonts — injects Google Fonts `<link>` tags into <head> for every
 * imported font in the character config.
 *
 * Each imported font carries a Google Fonts CSS2 `apiParams` string. We build
 * the URL and inject a `<link rel="stylesheet" href="…">` into <head>. The link
 * is added/removed as the imported-fonts list changes, so the sheet always has
 * access to whatever fonts the user has imported.
 *
 * The hook also warms the font URLs with a `preconnect` hint so the browser
 * starts fetching them early.
 */

import { useEffect } from 'react'
import type { ImportedFont } from '@/types'

const GOOGLE_FONTS_BASE = 'https://fonts.googleapis.com/css2'

function buildLinkHref(font: ImportedFont): string {
  return `${GOOGLE_FONTS_BASE}?${font.apiParams}&display=swap`
}

export function useImportedFonts(fonts: ImportedFont[]): void {
  useEffect(() => {
    if (!fonts || fonts.length === 0) return

    // Inject a single preconnect hint.
    const preconnect = document.createElement('link')
    preconnect.rel = 'preconnect'
    preconnect.href = 'https://fonts.googleapis.com'
    preconnect.setAttribute('data-grimoire-fonts', 'preconnect')
    document.head.appendChild(preconnect)

    const preconnect2 = document.createElement('link')
    preconnect2.rel = 'preconnect'
    preconnect2.href = 'https://fonts.gstatic.com'
    preconnect2.crossOrigin = 'anonymous'
    preconnect2.setAttribute('data-grimoire-fonts', 'preconnect-gstatic')
    document.head.appendChild(preconnect2)

    // Inject link tags for each font.
    const linkElements: HTMLLinkElement[] = fonts.map((font) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = buildLinkHref(font)
      link.setAttribute('data-grimoire-fonts', `font-${font.id}`)
      document.head.appendChild(link)
      return link
    })

    return () => {
      linkElements.forEach((el) => el.remove())
      preconnect.remove()
      preconnect2.remove()
    }
  }, [fonts])
}
