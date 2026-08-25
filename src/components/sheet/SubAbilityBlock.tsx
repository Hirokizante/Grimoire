/**
 * SubAbilityBlock — renders a nested Sub-Ability inside an AbilityBlockCard.
 *
 * Sub-Abilities are visually subordinate to their parent Ability: they render
 * as indented, compact cards with a "Sub-Ability" label. They share all the
 * same fields as a regular AbilityBlock (name, traits, cost, damage,
 * description, overcharge, flavor text) but cannot be Minor and do not
 * consume Ability Slots.
 *
 * In view mode, when `showActivate` is true, an Activate button is rendered
 * (same logic as {@link AbilityActivation}). In edit mode, the `actions` prop
 * injects Edit / Remove buttons instead.
 */

import DiceHighlighter from '@/components/dice/DiceHighlighter'
import MarkdownText from '@/components/ui/MarkdownText'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { SUB_ABILITY_ACCENT_OPTIONS } from '@/lib/themeUtils'
import type { AbilityBlock, Character } from '@/types'
import type { RollSource } from '@/types/rollLog'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface SubAbilityBlockProps {
  ability: AbilityBlock
  mode?: SheetMode
  /** Optional action buttons rendered inside the block footer (edit-mode only). */
  actions?: React.ReactNode
  /** Character for dice notation variable resolution (same as AbilityBlockCard). */
  character?: Character
}

export default function SubAbilityBlock({
  ability,
  mode = 'view',
  actions,
  character,
}: SubAbilityBlockProps) {
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const spendAP = useCharacterStore((s) => s.spendAP)
  const spendEND = useCharacterStore((s) => s.spendEND)
  const spendFP = useCharacterStore((s) => s.spendFP)
  const { notify } = useNotification()

  const { name, traits, cost, damage, description, overcharge, flavorText } =
    ability

  const hasCost = cost.ap != null || cost.end != null || cost.fp != null
  const isView = mode === 'view'

  // Dice rolls from the damage field are "Damage: [name]"; rolls from
  // description/overcharge/flavor text are generic "Roll: [name]".
  const subAbilityName = name || 'Untitled Sub-Ability'
  const damageSource: RollSource = {
    type: 'ability-damage',
    abilityName: subAbilityName,
    abilityId: ability.id,
  }
  const rollSource: RollSource = {
    type: 'ability-roll',
    abilityName: subAbilityName,
    abilityId: ability.id,
  }

  // Resolve the character for both dice notation and resource spending.
  const activeCharacter = character ?? storeCharacter

  // Resolve colorOverride (a SheetColors key) to a CSS variable name for
  // inline styling of the block's border and background.
  const colorVar = ability.colorOverride
    ? SUB_ABILITY_ACCENT_OPTIONS.find((o) => o.key === ability.colorOverride)
        ?.cssVar ?? null
    : null

  const blockStyle: React.CSSProperties | undefined = colorVar
    ? {
        borderColor: `color-mix(in srgb, var(${colorVar}) 50%, transparent)`,
        background: `color-mix(in srgb, var(${colorVar}) 12%, var(--bg-surface-raised))`,
      }
    : undefined

  // -- Activate logic (view mode only) ----------------------------------------
  const canShowActivate = isView && ability.showActivate && activeCharacter

  let activateBtn: React.ReactNode = null
  if (canShowActivate) {
    const exhaustionMod =
      activeCharacter.mortalWounds.includes('Exhaustion') ? 1 : 0
    const apCost = cost.ap ?? 0
    const endCost =
      (cost.end ?? 0) + (cost.end != null ? exhaustionMod : 0)
    const fpCost = cost.fp ?? 0

    const canAfford =
      activeCharacter.currentAP >= apCost &&
      activeCharacter.currentEND >= endCost &&
      activeCharacter.currentFP >= fpCost

    const insufficientParts: string[] = []
    if (activeCharacter.currentAP < apCost)
      insufficientParts.push(`${apCost - activeCharacter.currentAP} AP`)
    if (activeCharacter.currentEND < endCost)
      insufficientParts.push(`${endCost - activeCharacter.currentEND} END`)
    if (activeCharacter.currentFP < fpCost)
      insufficientParts.push(`${fpCost - activeCharacter.currentFP} FP`)
    const tooltip =
      insufficientParts.length > 0
        ? `Need ${insufficientParts.join(', ')}`
        : `Activate: ${apCost} AP, ${endCost} END, ${fpCost} FP`

    const handleActivate = () => {
      let ok = true
      if (apCost > 0) ok = spendAP(apCost) && ok
      if (endCost > 0) ok = spendEND(endCost) && ok
      if (fpCost > 0) ok = spendFP(fpCost) && ok
      if (ok) {
        notify(`Activated ${name}`, 'success')
      } else {
        notify('Insufficient resources to activate ability.', 'error')
      }
    }

    activateBtn = (
      <button
        type="button"
        className="btn btn--primary ability-activation__btn"
        onClick={handleActivate}
        disabled={!canAfford}
        title={tooltip}
      >
        Activate
      </button>
    )
  }

  return (
    <article className="sub-ability-block" style={blockStyle}>
      <header className="sub-ability-block__head">
        <span className="sub-ability-block__label">Sub-Ability</span>
        <h5 className="sub-ability-block__name">
          {name || 'Untitled Sub-Ability'}
        </h5>
      </header>

      {traits.length > 0 && (
        <ul className="sub-ability-block__traits" role="list">
          {traits.map((trait, i) => (
            <li key={i} className="sub-ability-block__trait">
              {trait}
            </li>
          ))}
        </ul>
      )}

      {(hasCost || damage) && (
        <div className="sub-ability-block__meta">
          {hasCost && (
            <span className="sub-ability-block__costs">
              {cost.ap != null && (
                <span className="cost-badge cost-badge--ap">{cost.ap} AP</span>
              )}
              {cost.end != null && (
                <span className="cost-badge cost-badge--end">
                  {cost.end} END
                </span>
              )}
              {cost.fp != null && (
                <span className="cost-badge cost-badge--fp">{cost.fp} FP</span>
              )}
            </span>
          )}
          {damage && (
            <span className="sub-ability-block__damage">
              <span className="sub-ability-block__meta-label">Dmg</span>{' '}
              <DiceHighlighter text={damage} mode={mode} character={character} source={damageSource} />
            </span>
          )}
        </div>
      )}

      {flavorText && (
        <MarkdownText
          className="sub-ability-block__flavor"
          mode={mode}
          character={character}
          source={rollSource}
        >
          {flavorText}
        </MarkdownText>
      )}

      {description && (
        <MarkdownText
          className="sub-ability-block__description"
          mode={mode}
          character={character}
          source={rollSource}
        >
          {description}
        </MarkdownText>
      )}

      {overcharge && (
        <div className="sub-ability-block__overcharge">
          <span className="sub-ability-block__section-label">Overcharge</span>
          <MarkdownText
            className="sub-ability-block__overcharge-body"
            mode={mode}
            character={character}
            source={rollSource}
          >
            {overcharge}
          </MarkdownText>
        </div>
      )}

      {activateBtn && (
        <div className="ability-activation__footer">
          {activateBtn}
        </div>
      )}

      {actions && <div className="sub-ability-block__actions">{actions}</div>}
    </article>
  )
}
