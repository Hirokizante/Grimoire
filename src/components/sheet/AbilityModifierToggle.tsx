/**
 * AbilityModifierToggle — the modifier switch + summary chips rendered on an
 * ability card.
 *
 * Shown only when the Ability actually declares modifiers. In **view mode** the
 * switch is interactive: switching it on applies the Ability's modifiers to the
 * sheet's attributes / combat stats, switching it off removes them. The switch
 * is completely independent from Activate — it costs nothing and neither button
 * affects the other.
 *
 * In **edit mode** the modifiers are listed without a switch (they are
 * configured in the ability editor instead).
 *
 * **The switch follows the same writer contract as the use steppers**: it is
 * interactive exactly when it receives `onToggle`. `AbilityBlockCard` /
 * `SubAbilityBlock` resolve that writer — the parent surface's handler first
 * (a GM Screen instance passes its own), otherwise the store action when the
 * card's character is the current **player** character. Surfaces with no writer
 * (an NPC *base* record, which is a static reference the GM Screen spawns
 * instances from) still render the switch, so the ability's state and its
 * modifier list stay visible, but it is `disabled`: a control that cannot write
 * must not look clickable.
 */

import {
  abilityModifiers,
  areAbilityModifiersActive,
  describeModifier,
} from '@/lib/abilityModifiers'
import type { AbilityBlock, Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface AbilityModifierToggleProps {
  ability: AbilityBlock
  mode?: SheetMode
  /**
   * Persist the switch for an entity the character store does not own (a GM
   * Screen NPC instance, whose switches live on the panel). When omitted the
   * switch is read-only — see the module doc.
   */
  onToggle?: (abilityId: string, active: boolean) => void
  /**
   * The entity the card belongs to, used only to explain a read-only switch:
   * an NPC base record says so in its tooltip.
   */
  character?: Character | null
  /** Extra classes (spacing differs between cards and sub-ability blocks). */
  className?: string
}

export default function AbilityModifierToggle({
  ability,
  mode = 'view',
  onToggle,
  character,
  className,
}: AbilityModifierToggleProps) {
  const modifiers = abilityModifiers(ability)
  if (modifiers.length === 0) return null

  const active = areAbilityModifiersActive(ability)
  const isView = mode === 'view'
  const name = ability.name || 'Untitled Ability'
  const interactive = isView && onToggle != null

  const handleToggle = () => {
    onToggle?.(ability.id, !active)
  }

  const title = !interactive
    ? character?.kind === 'npc'
      ? 'NPC sheets are static references — switch this ability’s modifiers on a GM Screen instance of it'
      : 'Modifiers are switched on where this ability is in play'
    : active
      ? 'Modifiers applied — switch off to remove them'
      : 'Modifiers not applied — switch on to apply them'

  return (
    <div
      className={
        'ability-modifiers' +
        (active ? ' ability-modifiers--active' : '') +
        (className ? ` ${className}` : '')
      }
    >
      {isView ? (
        <button
          type="button"
          role="switch"
          aria-checked={active}
          className="modifier-switch"
          onClick={handleToggle}
          disabled={!interactive}
          aria-label={`Apply ${name} modifiers`}
          title={title}
        >
          <span className="modifier-switch__track" aria-hidden="true">
            <span className="modifier-switch__thumb" />
          </span>
          <span className="modifier-switch__label">Modifiers</span>
        </button>
      ) : (
        <span className="ability-modifiers__label">Modifiers</span>
      )}

      <ul className="ability-modifiers__list" role="list">
        {modifiers.map((mod) => (
          <li
            key={mod.target}
            className={
              'ability-modifiers__item' +
              (active ? ' ability-modifiers__item--on' : '')
            }
          >
            {describeModifier(mod)}
          </li>
        ))}
      </ul>
    </div>
  )
}
