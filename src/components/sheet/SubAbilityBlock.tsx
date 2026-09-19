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
import CaptureButton from '@/components/ui/CaptureButton'
import AbilityModifierToggle from '@/components/sheet/AbilityModifierToggle'
import AbilityUsesMeter from '@/components/sheet/AbilityUsesMeter'
import { captureFileName } from '@/lib/elementCapture'
import { useCharacterStore } from '@/store/characterStore'
import {
  useAbilityActivation,
  type AbilityActivationOverride,
  type AbilityActivationOverrideResolver,
} from '@/hooks/useAbilityActivation'
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
   * Persist the stat/attribute modifier switch for an entity the store does not
   * own (a GM Screen NPC instance, whose switches live on the panel). When
   * omitted, the switch updates the current player character — and is read-only
   * everywhere else. Same contract as `AbilityBlockCard`'s prop of the same
   * name.
   */
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  /**
   * Persist a manual adjustment of a limited Sub-Ability's remaining uses for
   * an entity the store does not own (a GM screen NPC instance's panel budget).
   * When omitted, the adjustment updates the current player character — but only
   * if the block's character *is* that character, so a read-only block renders
   * no steppers. Same contract as `AbilityBlockCard`'s `onSetUses`.
   */
  onSetUses?: (abilityId: string, remaining: number) => void
  /**
   * Per-ability activation override (GM Screen NPC instances): its presence
   * gives the sub-ability an Activate button even when `showActivate` is off,
   * redirects the costs to the panel's own AP, and adds the Recharge badge.
   * A resolver that answers "no" for everything means the opposite — no button
   * at all, whatever this sub-ability's own flag says — which is how surfaces
   * that activate nothing (the Ability Pool, an NPC sheet outside the GM
   * Screen) keep their nested cards quiet. Same contract as
   * {@link AbilityActivation}'s prop of the same name.
   */
  activateOverride?: AbilityActivationOverrideResolver
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
  override,
}: {
  ability: AbilityBlock
  character: Character
  override: AbilityActivationOverride | null
}) {
  const plan = useAbilityActivation(ability, character, override?.options)
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
  activateOverride,
}: SubAbilityBlockProps) {
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const storeSetUses = useCharacterStore((s) => s.setAbilityUsesRemaining)
  const storeToggleModifiers = useCharacterStore((s) => s.setAbilityModifiersActive)

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
   * A limited Sub-Ability gets its own uses stepper — even when it (or its
   * parent) has no Activate button, since the count is still a number the
   * player tracks while playing. Same writer contract as the parent card: the
   * parent's handler wins (a GM panel's instance writer, an
   * {@link AbilityBlockCard}'s own prop), otherwise the store is used only when
   * this block's character is the store's current **player** character — an NPC
   * base record is a static reference and a GM panel's entity is not the store's
   * character, so both keep a read-only meter and render no steppers.
   */
  const storeAdjuster =
    storeCharacter &&
    activeCharacter?.id === storeCharacter.id &&
    activeCharacter.kind !== 'npc'
      ? (abilityId: string, next: number) =>
          storeSetUses(activeCharacter.id, abilityId, next)
      : undefined

  const adjustUses = onSetUses ?? storeAdjuster

  /**
   * The modifier switch's writer. Same contract as the parent card's: the
   * surface's handler wins (a GM Screen instance's, threaded down through
   * {@link AbilityBlockCard}), otherwise the store action only for a current
   * **player** character — an NPC base record and a GM panel's entity render
   * the switch read-only.
   */
  const storeToggle =
    storeCharacter &&
    activeCharacter?.id === storeCharacter.id &&
    activeCharacter.kind !== 'npc'
      ? (abilityId: string, active: boolean) =>
          storeToggleModifiers(abilityId, active)
      : undefined

  const toggleModifiers = onToggleModifiers ?? storeToggle

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
  // ability card. A GM NPC panel supplies a resolver, and then the resolver is
  // the last word: it returns an override only for the sub-abilities that
  // should activate (a cost, a Recharge value, or activation rolls that will
  // really run), so the `showActivate` flag — which the NPC editor does not
  // offer — cannot re-enable one the panel skipped.
  // The same contract silences a Sub-Ability whose parent is *not* in play: a
  // pooled ability and an NPC sheet outside the GM Screen both pass a resolver
  // that answers "no", so the parent's slot state — not this block's own flag —
  // decides whether an Activate button appears.
  const override = activateOverride?.(ability) ?? null
  const canShowActivate =
    isView &&
    activeCharacter != null &&
    (activateOverride ? override != null : ability.showActivate)
  const activateCharacter = canShowActivate ? activeCharacter : null
  const activateBtn: React.ReactNode = activateCharacter ? (
    <SubAbilityActivateButton
      ability={ability}
      character={activateCharacter}
      override={override}
    />
  ) : null

  return (
    <article className="sub-ability-block" style={blockStyle}>
      {isView && (
        <CaptureButton
          className="sub-ability-block__capture"
          targetSelector=".sub-ability-block"
          target="sub-ability"
          fileName={captureFileName('sub-ability', subAbilityName)}
        />
      )}

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
              {override?.renderTrait?.(trait) ?? trait}
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
        onToggle={toggleModifiers}
        character={activeCharacter}
        className="ability-modifiers--sub"
      />

      {actions && <div className="sub-ability-block__actions">{actions}</div>}
    </article>
  )
}
