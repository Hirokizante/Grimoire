/**
 * AbilityBlockCard — renders a single AbilityBlock as a styled card.
 *
 * Used by the Core Ability, Slotted Abilities, and Ability Pool sections.
 * The description and overcharge fields support Markdown formatting (with
 * GFM tables/strikethrough and raw HTML for backward-compat), rendered via
 * the shared {@link MarkdownText} component.
 *
 * The damage field is scanned for dice notation and rendered with the
 * {@link DiceHighlighter} so players can click to roll in view mode.
 */

import DiceHighlighter from '@/components/dice/DiceHighlighter'
import MarkdownText from '@/components/ui/MarkdownText'
import AbilityModifierToggle from '@/components/sheet/AbilityModifierToggle'
import AbilityUsesMeter from '@/components/sheet/AbilityUsesMeter'
import SubAbilityBlock from '@/components/sheet/SubAbilityBlock'
import { useCharacterStore } from '@/store/characterStore'
import { resolveCustomAbilityCosts } from '@/lib/abilityCosts'
import { isLimitedAbility } from '@/lib/abilityUses'
import type { AbilityActivationOverrideResolver } from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character } from '@/types'
import type { RollSource } from '@/types/rollLog'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface AbilityBlockCardProps {
  ability: AbilityBlock
  mode?: SheetMode
  /** Optional action buttons rendered inside the card footer (edit-mode only). */
  actions?: React.ReactNode
  /**
   * Optional render function for sub-ability action buttons (edit-mode only).
   * Called once per sub-ability (both under-description and under-overcharge);
   * receives the sub-ability and its parent ability, returns the React node
   * for the sub-ability's footer.
   */
  subAbilityActions?: (sub: AbilityBlock, parent: AbilityBlock) => React.ReactNode
  /**
   * Explicit character whose stats resolve variables in dice notation (the
   * damage field and any dice embedded in description/overcharge/flavor text).
   * Falls back to the store's `currentCharacter` when omitted. Needed for NPC
   * sheets embedded in a character sheet custom tab, where the rolled entity
   * is the NPC — not the player character stored in `currentCharacter`.
   */
  character?: Character
  /**
   * Persist the stat/attribute modifier switch for an ability that does not
   * live on the store's current character (attached NPC sections). When
   * omitted, the switch updates the current character.
   */
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  /**
   * Persist a manual adjustment of a limited ability's remaining uses for an
   * ability that does not live on the store's current character (attached NPC
   * sections). When omitted, the adjustment updates the current character —
   * but only if the card's character *is* that character, so a read-only card
   * (a GM panel's entity, a drag overlay) renders no steppers at all.
   */
  onSetUses?: (abilityId: string, remaining: number) => void
  /**
   * Per-ability activation override, threaded to this card's **sub-abilities**
   * (a card never activates itself — that is {@link AbilityActivation}'s job).
   * GM Screen NPC panels pass the instance's resolver so a Recharge
   * sub-ability gets the same Activate button and cooldown tracking as a
   * top-level one. A surface where *nothing* activates passes
   * {@link NO_ACTIVATION} instead — the Ability Pool (its abilities are not
   * slotted) and attached/standalone NPC sheets (static references). Because a
   * resolver is the last word, that is what stops a sub-ability from falling
   * back to its own `showActivate` flag and growing a button there.
   */
  activateOverride?: AbilityActivationOverrideResolver
}

export default function AbilityBlockCard({
  ability,
  mode = 'view',
  actions,
  subAbilityActions,
  character,
  onToggleModifiers,
  onSetUses,
  activateOverride,
}: AbilityBlockCardProps) {
  const {
    name,
    traits,
    cost,
    damage,
    description,
    overcharge,
    flavorText,
    isMinor,
  } = ability

  // Resolve custom resource costs against the sheet's own bars (the explicit
  // character prop wins for NPC sheets embedded in a character sheet tab).
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const storeSetUses = useCharacterStore((s) => s.setAbilityUsesRemaining)
  const costCharacter = character ?? storeCharacter
  const customCosts = resolveCustomAbilityCosts(
    cost.custom,
    costCharacter?.customResourceBars ?? [],
  )

  const hasCustomCosts = customCosts.length > 0
  const hasCost =
    cost.ap != null || cost.end != null || cost.fp != null || hasCustomCosts

  // Limited-use abilities show their remaining uses in the meta row, alongside
  // the cost badges (the budget itself is authored in the editor — see
  // AbilityBlockEditor).
  const hasUses = isLimitedAbility(ability)

  /**
   * Manual use adjustment needs exactly one thing: a writer for the entity the
   * card belongs to. It is deliberately NOT gated on `showActivate` — a limited
   * ability may have its Activate button switched off and still be a counter the
   * player tracks by hand (and an ability whose *sub-abilities* are activatable
   * while the parent is not still needs its own uses moved). It is not gated on
   * the sheet mode either: a use count is a live-play number a player adjusts
   * while building a sheet just as often as during play.
   *
   * An attached-NPC section supplies its own writer; otherwise the store action
   * only helps when the card's character *is* the store's current character, so
   * GM-panel entities stay read-only.
   *
   * `adjustUses` stays undefined in those read-only cases, which is exactly what
   * suppresses the steppers (a control that cannot write must not look
   * clickable).
   */
  const storeAdjuster =
    storeCharacter && costCharacter?.id === storeCharacter.id
      ? (abilityId: string, next: number) =>
          storeSetUses(costCharacter.id, abilityId, next)
      : undefined

  const adjustUses = onSetUses ?? storeAdjuster

  /**
   * The resolved activation override for THIS ability (the GM panel's live-play
   * state). Resolved here as well as in the activation wrapper because the
   * override can also *replace a trait chip*: an ability whose Recharge trait is
   * being tracked shows the live cooldown badge in the trait's own slot instead
   * of a second copy of the same information below the card.
   */
  const activationOverride = activateOverride?.(ability) ?? null

  // Dice rolls from the damage field are "Damage: [name]"; rolls from
  // description/overcharge/flavor text are generic "Roll: [name]".
  const abilityName = name || 'Untitled Ability'
  const damageSource: RollSource = {
    type: 'ability-damage',
    abilityName,
    abilityId: ability.id,
  }
  const rollSource: RollSource = {
    type: 'ability-roll',
    abilityName,
    abilityId: ability.id,
  }

  return (
    <article className={'ability-card' + (isMinor ? ' ability-card--minor' : '')}>
      <header className="ability-card__head">
        <h4 className="ability-card__name">
          {name || 'Untitled Ability'}
          {isMinor && <span className="ability-card__minor-badge">Minor</span>}
        </h4>

        {traits.length > 0 && (
          <ul className="ability-card__traits" role="list">
            {traits.map((trait, i) => (
              <li key={i} className="ability-card__trait">
                {activationOverride?.renderTrait?.(trait) ?? trait}
              </li>
            ))}
          </ul>
        )}
      </header>

      {(hasCost || damage || hasUses) && (
        <div className="ability-card__meta">
          {hasUses && (
            <AbilityUsesMeter
              ability={ability}
              onAdjust={
                adjustUses
                  ? (next) => adjustUses(ability.id, next)
                  : undefined
              }
            />
          )}
          {hasCost && (
            <span className="ability-card__costs">
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
            <span className="ability-card__damage">
              <span className="ability-card__meta-label">Dmg</span>{' '}
              <DiceHighlighter text={damage} mode={mode} character={character} source={damageSource} />
            </span>
          )}
        </div>
      )}

      {/* Modifier switch — appears only when the ability declares modifiers.
          Independent from Activate: switching costs nothing. */}
      <AbilityModifierToggle
        ability={ability}
        mode={mode}
        onToggle={onToggleModifiers}
      />

      {flavorText && (
        <MarkdownText className="ability-card__flavor" mode={mode} character={character} source={rollSource}>
          {flavorText}
        </MarkdownText>
      )}

      {description && (
        <MarkdownText className="ability-card__description" mode={mode} character={character} source={rollSource}>
          {description}
        </MarkdownText>
      )}

      {ability.subAbilitiesUnderDescription?.length > 0 && (
        <div className="ability-card__sub-abilities">
          {ability.subAbilitiesUnderDescription.map((sub) => (
            <SubAbilityBlock
              key={sub.id}
              ability={sub}
              mode={mode}
              character={character}
              onToggleModifiers={onToggleModifiers}
              onSetUses={onSetUses}
              activateOverride={activateOverride}
              actions={subAbilityActions?.(sub, ability)}
            />
          ))}
        </div>
      )}

      {overcharge && (
        <div className="ability-card__overcharge">
          <span className="ability-card__section-label">Overcharge</span>
          <MarkdownText className="ability-card__overcharge-body" mode={mode} character={character} source={rollSource}>
            {overcharge}
          </MarkdownText>
        </div>
      )}

      {ability.subAbilitiesUnderOvercharge?.length > 0 && (
        <div className="ability-card__sub-abilities">
          {ability.subAbilitiesUnderOvercharge.map((sub) => (
            <SubAbilityBlock
              key={sub.id}
              ability={sub}
              mode={mode}
              character={character}
              onToggleModifiers={onToggleModifiers}
              onSetUses={onSetUses}
              activateOverride={activateOverride}
              actions={subAbilityActions?.(sub, ability)}
            />
          ))}
        </div>
      )}

      {actions && <div className="ability-card__actions">{actions}</div>}
    </article>
  )
}