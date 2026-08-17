/**
 * StatusIcon — renders a status condition's icon from its stored payload.
 *
 * Supports all three icon kinds via `iconType`:
 *   - 'emoji' — the raw emoji character(s) in `icon`
 *   - 'pack'  — a lucide key in `icon` (resolved via the catalog)
 *   - 'image' — an SVG/PNG data URL in `icon`, rendered as an <img>
 *
 * Empty/missing icons fall back to a placeholder glyph so layout never breaks.
 */

import type { CSSProperties } from 'react'

import { statusIconByName } from '@/constants/statusIcons'
import type { StatusIconType } from '@/types'

export interface StatusIconProps {
  /** The icon payload. */
  icon: string
  /** How to interpret/render `icon`. */
  iconType: StatusIconType
  /** Rendered size in pixels (icons + images). */
  size?: number
  /** Optional extra class for layout context. */
  className?: string
}

export default function StatusIcon({
  icon,
  iconType,
  size = 16,
  className,
}: StatusIconProps) {
  const boxStyle: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
  }

  if (iconType === 'image' && icon) {
    return (
      <img
        className={className}
        src={icon}
        alt=""
        aria-hidden
        draggable={false}
        style={{ ...boxStyle, objectFit: 'contain', display: 'inline-block' }}
      />
    )
  }

  if (iconType === 'pack') {
    const Icon = statusIconByName(icon)
    if (Icon) {
      return <Icon size={size} className={className} aria-hidden />
    }
  }

  // Emoji (or the placeholder glyph when no emoji is set).
  const glyph = iconType === 'emoji' && icon ? icon : '§'
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}
      aria-hidden
    >
      {glyph}
    </span>
  )
}
