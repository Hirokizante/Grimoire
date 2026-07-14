/**
 * DiceRollOverlay.tsx — simple wrapper that mounts the dice result modal.
 */

import DiceResultModal from '@/components/dice/DiceResultModal'
import { useDiceRollStore } from '@/store/diceRollStore'
import { colorVars } from '@/lib/themeUtils'

export default function DiceRollOverlay() {
  const isVisible = useDiceRollStore((s) => s.isVisible)
  const dismiss = useDiceRollStore((s) => s.dismiss)
  const rollCharacter = useDiceRollStore((s) => s.rollCharacter)

  if (!isVisible) return null

  const style = rollCharacter ? colorVars(rollCharacter.config.colors) : undefined

  return <DiceResultModal onClose={dismiss} style={style} />
}
