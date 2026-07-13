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
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface AbilityBlockCardProps {
  ability: AbilityBlock
  mode?: SheetMode
  /** Optional action buttons rendered inside the card footer (edit-mode only). */
  actions?: React.ReactNode
}

export default function AbilityBlockCard({ ability, mode = 'view', actions }: AbilityBlockCardProps) {
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
              <DiceHighlighter text={damage} mode={mode} />
            </span>
          )}
        </div>
      )}

      {description && (
        <MarkdownText className="ability-card__description">
          {description}
        </MarkdownText>
      )}

      {overcharge && (
        <div className="ability-card__overcharge">
          <span className="ability-card__section-label">Overcharge</span>
          <MarkdownText className="ability-card__overcharge-body">
            {overcharge}
          </MarkdownText>
        </div>
      )}

      {flavorText && <p className="ability-card__flavor">{flavorText}</p>}

      {actions && <div className="ability-card__actions">{actions}</div>}
    </article>
  )
}