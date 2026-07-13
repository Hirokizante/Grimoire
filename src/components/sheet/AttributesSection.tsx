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
   */
  variant?: 'section' | 'flat'
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
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const roll = useDiceRollStore((s) => s.roll)
  const isEdit = mode === 'edit'

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
    const value = attributes[key]
    roll({
      notation: `d20${value >= 0 ? '+' : ''}${value}`,
      character,
      source: { type: 'attribute-check', attributeKey: key, attributeName: name },
    })
  }

  const sectionClass =
    variant === 'flat'
      ? 'attr-block--flat'
      : 'sheet-section sheet-section--attributes'
  const headingClass =
    variant === 'flat'
      ? 'attr-block__heading'
      : 'sheet-section__heading'

  if (variant === 'flat') {
    return (
      <section className={sectionClass}>
        <h3 className={headingClass}>Attributes</h3>
        <ul className="attr-boxes" role="list">
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
                <span className="attr-box__value">
                  {formatAttr(attributes[attr.key])}
                </span>
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
              <span
                className="attribute-list__value"
                title={attr.description}
              >
                {formatAttr(attributes[attr.key])}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
