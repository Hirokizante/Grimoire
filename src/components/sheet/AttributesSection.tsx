/**
 * AttributesSection — displays the five Divergence Attributes (MAR, POW, AGI,
 * VIT, GRT) with their full names and descriptions, using the canonical
 * metadata from `ATTRIBUTE_LIST` (gameData.ts).
 *
 * In edit mode each attribute value becomes a number input (min -1, max 8) that
 * persists immediately via `updateCurrentCharacter`.
 */

import { ATTRIBUTE_LIST } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import type { AttributeKey, Attributes } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface AttributesSectionProps {
  attributes: Attributes
  mode?: SheetMode
}

function formatAttr(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export default function AttributesSection({
  attributes,
  mode = 'view',
}: AttributesSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const setAttr = (key: AttributeKey, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    update((c) => ({
      ...c,
      attributes: { ...c.attributes, [key]: n },
    }))
  }

  return (
    <section className="sheet-section sheet-section--attributes">
      <h3 className="sheet-section__heading">Attributes</h3>
      <ul className="attribute-list" role="list">
        {ATTRIBUTE_LIST.map((attr) => (
          <li key={attr.key} className="attribute-list__item">
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
