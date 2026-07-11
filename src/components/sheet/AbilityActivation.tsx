/**
 * AbilityActivation — wraps an AbilityBlockCard with an "Activate" button
 * in view mode, deducting the ability's AP/END/FP costs from the character.
 *
 * Per DESIGN.md "Automatic Resource Tracking": the player selects what
 * Abilities they want to perform, and the costs are automatically deducted
 * from their AP, END, and FP.
 *
 * If the character has insufficient resources, the button is disabled and
 * shows a tooltip explaining why.
 *
 * Exhaustion mortal wound: all END costs are 1 more than usual.
 */

import { useState } from 'react'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { useCharacterStore } from '@/store/characterStore'
import type { AbilityBlock } from '@/types'

export interface AbilityActivationProps {
  ability: AbilityBlock
}

export default function AbilityActivation({ ability }: AbilityActivationProps) {
  const character = useCharacterStore((s) => s.currentCharacter)
  const spendAP = useCharacterStore((s) => s.spendAP)
  const spendEND = useCharacterStore((s) => s.spendEND)
  const spendFP = useCharacterStore((s) => s.spendFP)
  const [message, setMessage] = useState('')

  if (!character) return null

  // Exhaustion: +1 END cost
  const exhaustionMod = character.mortalWounds.includes('Exhaustion') ? 1 : 0
  const apCost = ability.cost.ap ?? 0
  const endCost = (ability.cost.end ?? 0) + (ability.cost.end != null ? exhaustionMod : 0)
  const fpCost = ability.cost.fp ?? 0

  const canAfford =
    character.currentAP >= apCost &&
    character.currentEND >= endCost &&
    character.currentFP >= fpCost

  const insufficientParts: string[] = []
  if (character.currentAP < apCost) insufficientParts.push(`${apCost - character.currentAP} AP`)
  if (character.currentEND < endCost) insufficientParts.push(`${endCost - character.currentEND} END`)
  if (character.currentFP < fpCost) insufficientParts.push(`${fpCost - character.currentFP} FP`)
  const tooltip = insufficientParts.length > 0
    ? `Need ${insufficientParts.join(', ')}`
    : `Activate: ${apCost} AP, ${endCost} END, ${fpCost} FP`

  const handleActivate = () => {
    // Deduct costs (order matters: check all first, then deduct).
    let ok = true
    if (apCost > 0) ok = spendAP(apCost) && ok
    if (endCost > 0) ok = spendEND(endCost) && ok
    if (fpCost > 0) ok = spendFP(fpCost) && ok

    if (ok) {
      setMessage(`Activated ${ability.name}`)
    } else {
      setMessage('Insufficient resources')
    }
    setTimeout(() => setMessage(''), 2500)
  }

  return (
    <div className="ability-activation">
      <AbilityBlockCard ability={ability} />
      <div className="ability-activation__footer">
        <button
          type="button"
          className="btn btn--primary ability-activation__btn"
          onClick={handleActivate}
          disabled={!canAfford}
          title={tooltip}
        >
          {apCost > 0 && `${apCost}AP `}
          {endCost > 0 && `${endCost}END `}
          {fpCost > 0 && `${fpCost}FP `}
          {(apCost === 0 && endCost === 0 && fpCost === 0) && 'Free '}
          Activate
        </button>
        {message && <span className="ability-activation__msg">{message}</span>}
      </div>
    </div>
  )
}
