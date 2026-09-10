/**
 * AbilityModifierToggle — the modifier switch + summary chips rendered on an
 * ability card.
 *
 * Shown only when the Ability actually declares modifiers. In **view mode**
 * the switch is interactive: switching it on applies the Ability's modifiers
 * to the sheet's attributes / combat stats, switching it off removes them.
 * The switch is completely independent from Activate — it costs nothing and
 * neither button affects the other.
 *
 * In **edit mode** the modifiers are listed without a switch (they are
 * configured in the ability editor instead).
 */

import { useCharacterStore } from '@/store/characterStore'
import {
  abilityModifiers,
  areAbilityModifiersActive,
  describeModifier,
} from '@/lib/abilityModifiers'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface AbilityModifierToggleProps {
  ability: AbilityBlock
  mode?: SheetMode
  /**
   * Persist the switch for an ability that does not live on the store's
   * current character (e.g. an NPC attached to a character sheet tab). When
   * omitted, the toggle updates the current character wherever the ability is.
   */
  onToggle?: (abilityId: string, active: boolean) => void
  /** Extra classes (spacing differs between cards and sub-ability blocks). */
  className?: string
}

export default function AbilityModifierToggle({
  ability,
  mode = 'view',
  onToggle,
  className,
}: AbilityModifierToggleProps) {
  const storeToggle = useCharacterStore((s) => s.setAbilityModifiersActive)

  const modifiers = abilityModifiers(ability)
  if (modifiers.length === 0) return null

  const active = areAbilityModifiersActive(ability)
  const isView = mode === 'view'
  const name = ability.name || 'Untitled Ability'

  const handleToggle = () => {
    if (onToggle) onToggle(ability.id, !active)
    else storeToggle(ability.id, !active)
  }

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
          aria-label={`Apply ${name} modifiers`}
          title={
            active
              ? 'Modifiers applied — switch off to remove them'
              : 'Modifiers not applied — switch on to apply them'
          }
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
