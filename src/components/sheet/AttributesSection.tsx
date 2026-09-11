/**
 * AttributesSection — displays the five Divergence Attributes (MAR, POW, AGI,
 * VIT, GRT) with their full names and descriptions, using the canonical
 * metadata from `ATTRIBUTE_LIST` (gameData.ts).
 *
 * Each attribute is **clickable** in view mode to roll a d20 + modifier
 * check, logged to the RollLogDrawer as an `attribute-check` source.
 *
 * In **flat variant** (inside the hero section), each attribute is rendered as
 * a D&D 5e-style box: abbreviation label on top, large modifier value in a
 * circular badge, and the full name underneath.
 *
 * In **section variant** (standalone), a compact row-based list is used.
 */

import { ATTRIBUTE_LIST } from '@/constants/gameData'
import { effectiveAttributes } from '@/lib/abilityModifiers'
import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import type { AttributeKey, Attributes, Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface AttributesSectionProps {
  character: Character
  attributes: Attributes
  mode?: SheetMode
  /**
   * "section" (default) wraps in a full `.sheet-section` card.
   * "flat" renders without a section wrapper for embedding in the hero.
   * "cards" renders D&D 5e-style attribute boxes in a responsive grid,
   *   wrapped in a sheet section — used by standalone NPC sheets.
   * "flat-row" renders D&D 5e-style attribute boxes in a horizontal row,
   *   wrapped in a flat block — used inside the NPC hero section.
   */
  variant?: 'section' | 'flat' | 'cards' | 'flat-row'
}

function formatAttr(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export default function AttributesSection({
  character,
  attributes,
  mode = 'view',
  variant = 'section',
}: AttributesSectionProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter)
  const update = (updater: (c: Character) => Character) =>
    updateCharacter(character.id, updater)
  const roll = useDiceRollStore((s) => s.roll)
  const isEdit = mode === 'edit'

  // View mode shows the *effective* value — base Attributes plus any ability
  // modifiers currently switched on. Edit mode always shows (and edits) the
  // base value, so nothing is ever silently baked into the stored sheet.
  const effective = effectiveAttributes(character)

  const setAttr = (key: AttributeKey, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    update((c) => ({
      ...c,
      attributes: { ...c.attributes, [key]: n },
    }))
  }

  const onClickAttr = (key: AttributeKey, name: string) => {
    if (isEdit) return
    const value = effective[key]
    roll({
      notation: `d20${value >= 0 ? '+' : ''}${value}`,
      character,
      source: { type: 'attribute-check', attributeKey: key, attributeName: name },
    })
  }

  /**
   * Render one attribute value. In view mode this is the effective value with
   * a small modifier badge when an active ability changed it.
   */
  const renderValue = (key: AttributeKey, className: string, title?: string) => {
    const base = attributes[key]
    const value = effective[key]
    const delta = value - base
    if (delta === 0) {
      return (
        <span className={className} title={title}>
          {formatAttr(value)}
        </span>
      )
    }
    return (
      <span
        className={className + ' attribute-value--modified'}
        title={`${title ? `${title} — ` : ''}${formatAttr(base)} base, ${delta > 0 ? '+' : '−'}${Math.abs(delta)} from active ability modifiers`}
      >
        {formatAttr(value)}
        <span className="attribute-value__delta">
          {delta > 0 ? `+${delta}` : `${delta}`}
        </span>
      </span>
    )
  }

  const sectionClass =
    variant === 'flat'
      ? 'attr-block--flat'
      : 'sheet-section sheet-section--attributes'
  const headingClass =
    variant === 'flat'
      ? 'attr-block__heading'
      : 'sheet-section__heading'

  if (variant === 'flat' || variant === 'cards' || variant === 'flat-row') {
    const sectionClass =
      variant === 'cards'
        ? 'sheet-section sheet-section--attributes'
        : 'attr-block--flat'
    const headingClass =
      variant === 'cards'
        ? 'sheet-section__heading'
        : 'attr-block__heading'
    const listClass =
      variant === 'cards'
        ? 'attr-boxes--grid'
        : variant === 'flat-row'
          ? 'attr-boxes--row'
          : undefined
    return (
      <section className={sectionClass}>
        <h3 className={headingClass}>Attributes</h3>
        <ul className={'attr-boxes' + (listClass ? ` ${listClass}` : '')} role="list">
          {ATTRIBUTE_LIST.map((attr) => (
            <li
              key={attr.key}
              className={'attr-box' + (isEdit ? '' : ' attr-box--clickable')}
              title={attr.description}
              onClick={isEdit ? undefined : () => onClickAttr(attr.key, attr.name)}
            >
              <span className="attr-box__abbr">{attr.abbreviation}</span>
              {isEdit ? (
                <input
                  type="number"
                  className="sheet-input attr-box__input"
                  min={-1}
                  max={8}
                  value={attributes[attr.key]}
                  onChange={(e) => setAttr(attr.key, e.target.value)}
                />
              ) : (
                renderValue(attr.key, 'attr-box__value')
              )}
              <span className="attr-box__name">{attr.name}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>Attributes</h3>
      <ul className="attribute-list" role="list">
        {ATTRIBUTE_LIST.map((attr) => (
          <li
            key={attr.key}
            className={'attribute-list__item' + (isEdit ? '' : ' attribute-list__item--clickable')}
            onClick={isEdit ? undefined : () => onClickAttr(attr.key, attr.name)}
          >
            <div className="attribute-list__main">
              <span
                className="attribute-list__abbr"
                title={attr.description}
              >
                {attr.abbreviation}
              </span>
              <span className="attribute-list__name">{attr.name}</span>
            </div>
            {isEdit ? (
              <input
                type="number"
                className="sheet-input sheet-input--num attribute-list__value-input"
                min={-1}
                max={8}
                value={attributes[attr.key]}
                onChange={(e) => setAttr(attr.key, e.target.value)}
              />
            ) : (
              renderValue(attr.key, 'attribute-list__value', attr.description)
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
