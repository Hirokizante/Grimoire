/**
 * AbilityBlockCard — renders a single AbilityBlock as a styled card.
 *
 * Used by the Core Ability, Slotted Abilities, and Ability Pool sections.
 * The description and overcharge fields hold HTML strings produced by a rich
 * text editor (DESIGN.md "Rich Text Editor in Ability Blocks"), so they are
 * rendered with `dangerouslySetInnerHTML`.
 */

import type { AbilityBlock } from '@/types'

export interface AbilityBlockCardProps {
  ability: AbilityBlock
}

export default function AbilityBlockCard({ ability }: AbilityBlockCardProps) {
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

  const hasCost = cost.ap != null || cost.end != null || cost.fp != null

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
                {trait}
              </li>
            ))}
          </ul>
        )}
      </header>

      {(hasCost || damage) && (
        <div className="ability-card__meta">
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
            </span>
          )}
          {damage && (
            <span className="ability-card__damage">
              <span className="ability-card__meta-label">Dmg</span>{' '}
              {damage}
            </span>
          )}
        </div>
      )}

      {description && (
        <div
          className="ability-card__description"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      )}

      {overcharge && (
        <div className="ability-card__overcharge">
          <span className="ability-card__section-label">Overcharge</span>
          <div
            className="ability-card__overcharge-body"
            dangerouslySetInnerHTML={{ __html: overcharge }}
          />
        </div>
      )}

      {flavorText && <p className="ability-card__flavor">{flavorText}</p>}
    </article>
  )
}