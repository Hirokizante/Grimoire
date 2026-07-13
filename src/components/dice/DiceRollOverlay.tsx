/**
 * DiceRollOverlay.tsx — simple wrapper that mounts the dice result modal.
 */

import DiceResultModal from '@/components/dice/DiceResultModal'
import { useDiceRollStore } from '@/store/diceRollStore'

export default function DiceRollOverlay() {
  const isVisible = useDiceRollStore((s) => s.isVisible)
  const dismiss = useDiceRollStore((s) => s.dismiss)

  if (!isVisible) return null

  return <DiceResultModal onClose={dismiss} />
}
