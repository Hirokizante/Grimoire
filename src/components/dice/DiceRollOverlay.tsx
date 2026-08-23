/**
 * DiceRollOverlay.tsx — simple wrapper that mounts the dice result modal.
 */

import DiceResultModal from '@/components/dice/DiceResultModal'
import { useDiceRollStore, themeEntity } from '@/store/diceRollStore'
import { colorVars } from '@/lib/themeUtils'

export default function DiceRollOverlay() {
  const isVisible = useDiceRollStore((s) => s.isVisible)
  const dismiss = useDiceRollStore((s) => s.dismiss)
  const rollCharacter = useDiceRollStore((s) => s.rollCharacter)

  if (!isVisible) return null

  // themeEntity resolves whose palette the modal renders with: player sheets
  // use their own colors; standalone NPC sheets follow the app theme;
  // embedded NPC sections inherit the host player sheet's palette.
  const entity = rollCharacter ? (themeEntity() ?? rollCharacter) : null
  const style = entity ? colorVars(entity.config.colors) : undefined

  return <DiceResultModal onClose={dismiss} style={style} />
}
