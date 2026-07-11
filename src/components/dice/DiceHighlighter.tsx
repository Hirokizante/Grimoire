/**
 * DiceHighlighter — renders text with inline dice notation highlighted as
 * clickable elements.
 *
 * Scans the input string for dice notation patterns (e.g. "2d6+POW", "d20+3")
 * using `findDiceNotation` from the parser. Non-notation text is rendered as-is;
 * notation segments are rendered as clickable spans that trigger a dice roll
 * via the `useDiceRollStore`.
 *
 * In edit mode, highlighting is disabled (the text is just shown plainly).
 */

import { findDiceNotation } from '@/lib/diceParser'
import { useDiceRollStore } from '@/store/diceRollStore'
import { useCharacterStore } from '@/store/characterStore'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface DiceHighlighterProps {
  /** The text to scan for dice notation. */
  text: string
  /** Whether to enable clickable dice. In edit mode, set to false. */
  mode?: SheetMode
  /** Optional CSS class for the container. */
  className?: string
}

export default function DiceHighlighter({
  text,
  mode = 'view',
  className,
}: DiceHighlighterProps) {
  const roll = useDiceRollStore((s) => s.roll)
  const character = useCharacterStore((s) => s.currentCharacter)

  if (!text) return null

  const isView = mode === 'view'
  const matches = isView ? findDiceNotation(text) : []

  // No matches and not view mode — just render the text.
  if (matches.length === 0) {
    return <span className={className}>{text}</span>
  }

  // Build segments: plain text and clickable dice notation.
  const segments: React.ReactNode[] = []
  let lastIndex = 0

  matches.forEach((match, i) => {
    // Plain text before this match.
    if (match.start > lastIndex) {
      segments.push(
        <span key={`text-${i}`}>
          {text.slice(lastIndex, match.start)}
        </span>,
      )
    }

    // The dice notation match (clickable in view mode).
    segments.push(
      <button
        key={`dice-${i}`}
        type="button"
        className="dice-notation"
        onClick={() => {
          if (character) {
            roll(match.match, character)
          }
        }}
        title={isView ? `Roll ${match.match}` : undefined}
        disabled={!isView || !character}
      >
        {match.match}
      </button>,
    )

    lastIndex = match.end
  })

  // Trailing text.
  if (lastIndex < text.length) {
    segments.push(
      <span key="text-end">{text.slice(lastIndex)}</span>,
    )
  }

  return <span className={className}>{segments}</span>
}
