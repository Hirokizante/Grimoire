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
 * The six combat stats on an NPC sheet's "Combat Stats" row.
 *
 * Deliberately NOT `keyof SheetColors`: the NPC row shows HP and Mortal Wounds
 * where the player sheet shows Milestones and END Recovery, so it needs its own
 * palette (see {@link NPC_STAT_TOKEN_COLORS}).
 */
export type NPCStatColorKey =
  | 'evasion'
  | 'armor'
  | 'movement'
  | 'saveDC'
  | 'hp'
  | 'mortalWounds'

/**
 * Accents for the NPC Combat Stats token row — one palette per app theme.
 *
 * Standalone NPC sheets have no per-sheet customization, so they follow the app
 * theme (see {@link appThemeSheetColors}). Their stat row is not the player
 * sheet's row though: it swaps Milestones/END Recovery for HP/Mortal Wounds, so
 * reusing the sheet palette's token colors left the row muddled — Evasion and
 * HP were the same blush in Midnight and Parchment, HP and Mortal Wounds were
 * the same red in Mikami, and Armor/Movement were both grays in Pitch Black
 * (the Mortal Wounds token could also end up colorless entirely, since records
 * stored before that color key existed have no value to read).
 *
 * Each theme therefore gets its own tuned six-hue set, mapped by meaning:
 *   Evasion       — cool cyan/teal (air, dodging)
 *   Armor         — steel blue/slate (metal)
 *   Movement      — green/moss (motion)
 *   Save DC       — violet/plum/cream (arcane)
 *   HP            — the theme's HP bar color, matching the rest of the app
 *   Mortal Wounds — deep blood red/orange, always distinct from HP
 *
 * Distinctness is a requirement, not a nicety: the six stripes have to be
 * tellable at a glance even at 3px tall, so themeUtils.test.ts enforces a floor
 * of ΔE(CIE76) >= 16 between every pair and >= 3.5:1 contrast against the card
 * surface. The shipped palettes sit at >= 18 ΔE and >= 3.7:1.
 */
export const NPC_STAT_TOKEN_COLORS: Record<
  AppTheme,
  Record<NPCStatColorKey, string>
> = {
  // Dark indigo. Cyan Evasion, steel-blue Armor and green Movement keep the
  // row's three cool stats apart; HP keeps the app's signature blush so it
  // matches every HP bar, with Mortal Wounds pushed to a deeper blood red.
  midnight: {
    evasion: '#5ec8d8',
    armor: '#7ba7d6',
    movement: '#a9e6a0',
    saveDC: '#9b7ed6',
    hp: '#e8a0bf',
    mortalWounds: '#e0574f',
  },
  // Warm charcoal with parchment highlights. Muted and low-saturation to sit
  // in the theme: sage teal, slate blue and moss green for the cool stats, a
  // dusty plum for the arcane Save DC, terracotta HP and a brick-red wound.
  parchment: {
    evasion: '#93b5ad',
    armor: '#9aa8bd',
    movement: '#a8cfa0',
    saveDC: '#b390a8',
    hp: '#c98f74',
    mortalWounds: '#cf6363',
  },
  // Nord on near-black: the aurora set, using the deeper frost blue (#5e81ac)
  // for Armor so it no longer reads as a twin of the cyan Evasion token, and
  // burnt orange for Mortal Wounds so it stays distinct from the red HP.
  mikami: {
    evasion: '#88c0d0',
    armor: '#5e81ac',
    movement: '#a3be8c',
    saveDC: '#b48ead',
    hp: '#bf616a',
    mortalWounds: '#d08770',
  },
  // Pure black with cream, gold and muted teal. Armor and Movement leave the
  // gray band they shared (slate vs moss) and Mortal Wounds is lifted off the
  // theme's near-black surface so its stripe stays visible.
  'pitch-black': {
    evasion: '#5f8787',
    armor: '#9aa8b5',
    movement: '#8fa87c',
    saveDC: '#f3ecd4',
    hp: '#eecc6c',
    mortalWounds: '#b4655c',
  },
}

/** NPC Combat Stats accents for the given app theme. */
export function appThemeNpcStatColors(
  theme: AppTheme,
): Record<NPCStatColorKey, string> {
  return NPC_STAT_TOKEN_COLORS[theme]
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
    '--color-token-mortal-wounds': colors.tokenMortalWounds,
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
  { key: 'tokenMortalWounds', label: 'Mortal Wounds', cssVar: '--color-token-mortal-wounds' },
]
