/**
 * DiceRollOverlay.tsx — simple wrapper that mounts the dice result modal.
 */

import DiceResultModal from '@/components/dice/DiceResultModal'
import { useDiceRollStore } from '@/store/diceRollStore'
import type { SheetColors } from '@/types'

function colorVars(colors: SheetColors): Record<string, string> {
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

export default function DiceRollOverlay() {
  const isVisible = useDiceRollStore((s) => s.isVisible)
  const dismiss = useDiceRollStore((s) => s.dismiss)
  const rollCharacter = useDiceRollStore((s) => s.rollCharacter)

  if (!isVisible) return null

  const style = rollCharacter ? colorVars(rollCharacter.config.colors) : undefined

  return <DiceResultModal onClose={dismiss} style={style} />
}
