/**
 * Shared helpers for mapping SheetColors onto CSS custom properties.
 *
 * Used by CharacterSheet, DiceRollOverlay, and RollLogDrawer so they all
 * inherit the active character's theme consistently.
 */

import type { SheetColors } from '@/types'

/**
 * Map a SheetColors object onto CSS custom properties. This is the single
 * injection point that drives the entire per-character theme.
 */
export function colorVars(colors: SheetColors): Record<string, string> {
  return {
    '--bg-base': colors.bgBase,
    '--bg-surface': colors.bgSurface,
    '--bg-surface-raised': colors.bgSurfaceRaised,
    '--bg-surface-hover': colors.bgSurfaceHover,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-muted': colors.textMuted,
    '--border': colors.border,
    '--border-soft': colors.borderSoft,
    '--accent-violet': colors.accent,
    '--accent-violet-soft': colors.accentSoft,
    '--accent-blush': colors.hpBar,
    '--danger': colors.danger,
    '--color-minor-ability': colors.minorAbility,
    '--color-success': colors.success,
    '--hp-bar-color': colors.hpBar,
    '--fp-bar-color': colors.fpBar,
    '--ap-bar-color': colors.apBar,
    '--end-bar-color': colors.endBar,
  }
}
