/**
 * Shared helpers for mapping SheetColors onto CSS custom properties.
 *
 * Used by CharacterSheet, DiceRollOverlay, and RollLogDrawer so they all
 * inherit the active character's theme consistently.
 */

import type { SheetColors, SheetConfig } from '@/types'
import {
  DEFAULT_SHEET_COLORS,
  MIKAMI_SHEET_COLORS,
  PARCHMENT_SHEET_COLORS,
  PITCH_BLACK_SHEET_COLORS,
} from '@/constants/gameData'
import type { AppTheme } from '@/store/appThemeStore'

/**
 * Sheet palette that follows the app theme. Used by NPC sheets, which have
 * no per-sheet customization: a standalone NPC sheet matches the app chrome
 * (Midnight = the built-in defaults, every other theme = its own palette).
 *
 * Embedded NPC sections never call this — they inherit the player sheet's
 * own color variables, so the player sheet theme takes precedence there.
 */
export function appThemeSheetColors(theme: AppTheme): SheetColors {
  switch (theme) {
    case 'parchment':
      return PARCHMENT_SHEET_COLORS
    case 'mikami':
      return MIKAMI_SHEET_COLORS
    case 'pitch-black':
      return PITCH_BLACK_SHEET_COLORS
    default:
      return DEFAULT_SHEET_COLORS
  }
}

/**
 * Card background for a standalone sheet that follows the app theme.
 * Midnight keeps the character's own background (the historical look);
 * every other theme uses its surface color so the card matches the chrome.
 */
export function appThemeSheetCardBackground(
  theme: AppTheme,
  config: SheetConfig,
): string {
  return theme === 'midnight'
    ? config.backgroundColor
    : appThemeSheetColors(theme).bgSurface
}

/**
 * Page background for a standalone sheet that follows the app theme.
 * Midnight keeps the character's own page color; every other theme uses
 * its base color.
 */
export function appThemeSheetPageBackground(
  theme: AppTheme,
  config: SheetConfig,
): string {
  return theme === 'midnight'
    ? config.pageBackgroundColor
    : appThemeSheetColors(theme).bgBase
}

/**
 * CSS custom properties for a standalone sheet that follows the app theme.
 * NPCs have no per-sheet customization, so overlays that outlive the page
 * (dice result modal, roll log) use the theme's palette for them instead of
 * their midnight-default config colors.
 */
export function appThemeColorVars(theme: AppTheme): Record<string, string> {
  return colorVars(appThemeSheetColors(theme))
}

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
    '--color-token-milestone': colors.tokenMilestone,
    '--color-token-movement': colors.tokenMovement,
    '--color-token-evasion': colors.tokenEvasion,
    '--color-token-save-dc': colors.tokenSaveDC,
    '--color-token-armor': colors.tokenArmor,
    '--color-token-end-recovery': colors.tokenEndRecovery,
  }
}

/**
 * Accent color keys from {@link SheetColors} that can be chosen as a Sub-Ability
 * color override. Each entry maps a SheetColors key to a CSS variable name and a
 * human-readable label for the color picker swatches.
 */
export const SUB_ABILITY_ACCENT_OPTIONS: {
  key: string
  label: string
  cssVar: string
}[] = [
  { key: 'accent', label: 'Accent', cssVar: '--accent-violet' },
  { key: 'accentSoft', label: 'Accent Soft', cssVar: '--accent-violet-soft' },
  { key: 'danger', label: 'Danger', cssVar: '--danger' },
  { key: 'success', label: 'Success', cssVar: '--color-success' },
  { key: 'minorAbility', label: 'Minor', cssVar: '--color-minor-ability' },
  { key: 'hpBar', label: 'HP', cssVar: '--hp-bar-color' },
  { key: 'fpBar', label: 'FP', cssVar: '--fp-bar-color' },
  { key: 'apBar', label: 'AP', cssVar: '--ap-bar-color' },
  { key: 'endBar', label: 'END', cssVar: '--end-bar-color' },
  { key: 'tokenMilestone', label: 'Milestone', cssVar: '--color-token-milestone' },
  { key: 'tokenMovement', label: 'Movement', cssVar: '--color-token-movement' },
  { key: 'tokenEvasion', label: 'Evasion', cssVar: '--color-token-evasion' },
  { key: 'tokenSaveDC', label: 'Save DC', cssVar: '--color-token-save-dc' },
  { key: 'tokenArmor', label: 'Armor', cssVar: '--color-token-armor' },
  { key: 'tokenEndRecovery', label: 'END Recovery', cssVar: '--color-token-end-recovery' },
]
