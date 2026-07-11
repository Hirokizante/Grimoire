/**
 * AttributesSection — displays the five Divergence Attributes (MAR, POW, AGI,
 * VIT, GRT) with their full names and descriptions, using the canonical
 * metadata from `ATTRIBUTE_LIST` (gameData.ts).
 */

import { ATTRIBUTE_LIST } from '@/constants/gameData'
import type { Attributes } from '@/types'

export interface AttributesSectionProps {
  attributes: Attributes
}

function formatAttr(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

export default function AttributesSection({
  attributes,
}: AttributesSectionProps) {
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
            <span
              className="attribute-list__value"
              title={attr.description}
            >
              {formatAttr(attributes[attr.key])}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}