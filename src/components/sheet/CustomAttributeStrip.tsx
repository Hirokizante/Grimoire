/**
 * CustomAttributeStrip — the player's own attributes, in the hero section.
 *
 * Rendered below the resource bars — and, in view mode, below the Recover /
 * End Turn row — and above the Mortal Wounds block, as a **horizontal** strip of
 * the same D&D-style attribute boxes the five Divergence Attributes use
 * (shorthand on top, value in the middle, full name underneath), centered so a
 * strip of two reads as deliberately placed rather than left-hanging.
 *
 * In **view mode**:
 *   - Clicking a box rolls `d20 + value`, exactly as the built-in attribute
 *     boxes do (logged as an `attribute-check`).
 *   - A box whose attribute was given steppers shows **− / +** buttons beside
 *     the value, so an attribute that changes often can be nudged without
 *     leaving live play.
 *
 * In **edit mode** the value becomes a number input and every box carries an
 * edit button that opens {@link CustomAttributeModal} (rename, re-value,
 * shorthand, steppers, delete).
 */

import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import type { Character, CustomAttribute } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CustomAttributeStripProps {
  character: Character
  mode?: SheetMode
  /** Open the edit dialog for one attribute (edit mode). */
  onEdit: (attribute: CustomAttribute) => void
}

/** Attribute values are modifiers: always show their sign. */
function formatValue(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export default function CustomAttributeStrip({
  character,
  mode = 'view',
  onEdit,
}: CustomAttributeStripProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter)
  const adjustCustomAttributeValue = useCharacterStore(
    (s) => s.adjustCustomAttributeValue,
  )
  const roll = useDiceRollStore((s) => s.roll)
  const isEdit = mode === 'edit'
  /**
   * The in-progress text of one box's edit-mode value input, or null when no
   * box is being typed into.
   *
   * The store is written on every keystroke that parses, but the input's text
   * has to survive the keystrokes that do not: a lone "-" reads as an empty
   * number input (`Number('')` is 0), so writing it would turn a "-3" in
   * progress into "03". A draft keeps what was typed on screen until the field
   * is left, and is dropped on blur so the box re-reads the stored number.
   */
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null)

  const attributes = character.customAttributes ?? []
  if (attributes.length === 0) return null

  const setValue = (attribute: CustomAttribute, raw: string) => {
    setDraft({ id: attribute.id, text: raw })
    if (raw.trim() === '') return
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    const value = Math.round(parsed)
    if (value === attribute.value) return
    updateCharacter(character.id, (c) => ({
      ...c,
      customAttributes: (c.customAttributes ?? []).map((a) =>
        a.id === attribute.id ? { ...a, value } : a,
      ),
    }))
  }

  const rollAttribute = (attribute: CustomAttribute) => {
    if (isEdit) return
    roll({
      notation: `d20${attribute.value >= 0 ? '+' : ''}${attribute.value}`,
      character,
      source: {
        type: 'attribute-check',
        attributeKey: attribute.id,
        attributeName: attribute.name,
      },
    })
  }

  return (
    <ul className="attr-boxes custom-attr-strip" role="list">
      {attributes.map((attribute) => {
        // The name is the box's own label when there is no shorthand, so a
        // nameless top line never shows. The CSS uppercases it, matching how
        // the built-in boxes print MAR / POW / ….
        const topLabel = attribute.shorthand.trim() || attribute.name
        const hasSteppers = !isEdit && attribute.showSteppers
        return (
          <li
            key={attribute.id}
            className={
              'attr-box custom-attr-box' +
              (isEdit ? '' : ' attr-box--clickable')
            }
            title={
              isEdit
                ? attribute.name
                : `${attribute.name} — click to roll d20${formatValue(attribute.value)}`
            }
            onClick={isEdit ? undefined : () => rollAttribute(attribute)}
          >
            <span className="attr-box__abbr custom-attr-box__abbr">
              {topLabel}
            </span>

            <div className="custom-attr-box__value-row">
              {hasSteppers && (
                <button
                  type="button"
                  className="btn btn--icon custom-attr-step"
                  aria-label={`Decrease ${attribute.name}`}
                  title={`Decrease ${attribute.name}`}
                  onClick={(e) => {
                    // The box itself rolls; a stepper must not.
                    e.stopPropagation()
                    adjustCustomAttributeValue(character.id, attribute.id, -1)
                  }}
                >
                  −
                </button>
              )}

              {isEdit ? (
                <input
                  type="number"
                  className="sheet-input attr-box__input custom-attr-box__input"
                  step={1}
                  aria-label={`${attribute.name} value`}
                  value={
                    draft?.id === attribute.id
                      ? draft.text
                      : String(attribute.value)
                  }
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setValue(attribute, e.target.value)}
                  onBlur={() => setDraft(null)}
                />
              ) : (
                <span className="attr-box__value custom-attr-box__value">
                  {formatValue(attribute.value)}
                </span>
              )}

              {hasSteppers && (
                <button
                  type="button"
                  className="btn btn--icon custom-attr-step"
                  aria-label={`Increase ${attribute.name}`}
                  title={`Increase ${attribute.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    adjustCustomAttributeValue(character.id, attribute.id, 1)
                  }}
                >
                  +
                </button>
              )}
            </div>

            {attribute.shorthand.trim() !== '' && (
              <span className="attr-box__name custom-attr-box__name">
                {attribute.name}
              </span>
            )}

            {isEdit && (
              <button
                type="button"
                className="btn btn--icon custom-attr-box__edit"
                aria-label={`Edit ${attribute.name}`}
                title={`Edit ${attribute.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(attribute)
                }}
              >
                <Pencil size={12} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
