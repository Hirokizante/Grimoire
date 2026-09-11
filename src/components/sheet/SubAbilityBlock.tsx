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
import AbilityModifierToggle from '@/components/sheet/AbilityModifierToggle'
import AbilityUsesMeter from '@/components/sheet/AbilityUsesMeter'
import { useCharacterStore } from '@/store/characterStore'
import { useAbilityActivation } from '@/hooks/useAbilityActivation'
import { SUB_ABILITY_ACCENT_OPTIONS } from '@/lib/themeUtils'
import { resolveCustomAbilityCosts } from '@/lib/abilityCosts'
import { isLimitedAbility } from '@/lib/abilityUses'
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
  /**
   * Persist the stat/attribute modifier switch for an ability that does not
   * live on the store's current character (attached NPC sections). When
   * omitted, the switch updates the current character.
   */
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  /**
   * Persist a manual adjustment of a limited Sub-Ability's remaining uses for
   * an ability that does not live on the store's current character. When
   * omitted, the adjustment updates the current character — but only if the
   * block's character *is* that character, so a read-only block renders no
   * steppers. Same contract as `AbilityBlockCard`'s `onSetUses`.
   */
  onSetUses?: (abilityId: string, remaining: number) => void
}

/**
 * The Sub-Ability's own Activate button. Split into a child component so
 * {@link useAbilityActivation} is only mounted when the block is actually
 * view-mode, activatable, and has a character — hooks cannot be called
 * conditionally, and the plan is meaningless without an entity to spend from.
 */
function SubAbilityActivateButton({
  ability,
  character,
}: {
  ability: AbilityBlock
  character: Character
}) {
  const plan = useAbilityActivation(ability, character)
  return (
    <button
      type="button"
      className="btn btn--primary ability-activation__btn"
      onClick={plan.activate}
      disabled={!plan.canActivate}
      title={plan.tooltip}
    >
      Activate
    </button>
  )
}

export default function SubAbilityBlock({
  ability,
  mode = 'view',
  actions,
  character,
  onToggleModifiers,
  onSetUses,
}: SubAbilityBlockProps) {
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const storeSetUses = useCharacterStore((s) => s.setAbilityUsesRemaining)

  const { name, traits, cost, damage, description, overcharge, flavorText } =
    ability

  // Resolve custom resource costs against the sheet's own bars (the explicit
  // character prop wins for NPC sheets embedded in a character sheet tab).
  const activeCharacter = character ?? storeCharacter
  const customCosts = resolveCustomAbilityCosts(
    cost.custom,
    activeCharacter?.customResourceBars ?? [],
  )

  const hasCustomCosts = customCosts.length > 0
  const hasCost =
    cost.ap != null || cost.end != null || cost.fp != null || hasCustomCosts
  const hasUses = isLimitedAbility(ability)
  const isView = mode === 'view'

  /**
   * A Sub-Ability carries its own Activate button, so it also gets its own
   * uses stepper. Same writer contract as the parent card: the parent's
   * handler wins, otherwise the store is used only when this block's character
   * is the store's current character (a GM panel's entity stays read-only).
   */
  const canAdjustUses = isView && ability.showActivate

  const storeAdjuster =
    canAdjustUses && storeCharacter && activeCharacter?.id === storeCharacter.id
      ? (abilityId: string, next: number) =>
          storeSetUses(activeCharacter.id, abilityId, next)
      : undefined

  const adjustUses = canAdjustUses ? (onSetUses ?? storeAdjuster) : undefined

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
  // (activeCharacter is declared above for custom-cost resolution.)

  // Resolve colorOverride (a SheetColors key) to a CSS variable name for  // inline styling of the block's border and background.
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
  // Cost deduction, the Exhaustion penalty, and limited-use spending all live
  // in useAbilityActivation so a Sub-Ability behaves exactly like a regular
  // ability card.
  const canShowActivate = isView && ability.showActivate && activeCharacter != null
  const activateCharacter = canShowActivate ? activeCharacter : null
  const activateBtn: React.ReactNode = activateCharacter ? (
    <SubAbilityActivateButton
      ability={ability}
      character={activateCharacter}
    />
  ) : null

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

      {(hasCost || damage || hasUses) && (
        <div className="sub-ability-block__meta">
          {hasUses && (
            <AbilityUsesMeter
              ability={ability}
              className="ability-uses--sub"
              onAdjust={
                adjustUses ? (next) => adjustUses(ability.id, next) : undefined
              }
            />
          )}
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
              {customCosts.map((c) => (
                <span
                  key={c.barId}
                  className="cost-badge cost-badge--custom"
                  style={{
                    background: `color-mix(in srgb, ${c.color} 16%, transparent)`,
                    color: c.color,
                    borderColor: `color-mix(in srgb, ${c.color} 40%, transparent)`,
                  }}
                >
                  {c.amount} {c.name}
                </span>
              ))}
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

      {/* Modifier switch — independent from the Activate button above. */}
      <AbilityModifierToggle
        ability={ability}
        mode={mode}
        onToggle={onToggleModifiers}
        className="ability-modifiers--sub"
      />

      {actions && <div className="sub-ability-block__actions">{actions}</div>}
    </article>
  )
}
