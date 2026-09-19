/**
 * DiceHighlighter — renders text with inline dice notation highlighted as
 * clickable elements.
 *
 * Scans the input string for dice notation patterns (e.g. "2d6+POW", "d20+3")
 * using `findDiceNotation` from the parser. Non-notation text is rendered as-is;
 * notation segments are rendered as clickable spans that trigger a dice roll
 * via the `useDiceRollStore`.
 *
 * The character's custom attributes are part of the scanned vocabulary: their
 * shorthands and full names are matched exactly (see
 * `customAttributeVariableNames`), so a homebrew stat rolls like a built-in one.
 *
 * Badge label: Settings → Dice → "Display dice notation as min-max values"
 * makes each badge read as the range its expression can roll with the
 * character's current stats (`1d6+3` → `4-9`). Display only — the click always
 * rolls the original notation, and without a character to resolve stat names
 * against the notation itself is shown.
 *
 * In edit mode, highlighting is disabled (the text is just shown plainly).
 */

import { findDiceNotation } from '@/lib/diceParser'
import { notationRange } from '@/lib/diceRoller'
import { customAttributeVariableNames } from '@/lib/customAttributes'
import { useDiceDisplayStore } from '@/store/diceDisplayStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types/character'
import type { RollSource } from '@/types/rollLog'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface DiceHighlighterProps {
  /** The text to scan for dice notation. */
  text: string
  /** Whether to enable clickable dice. In edit mode, set to false. */
  mode?: SheetMode
  /** Optional CSS class for the container. */
  className?: string
  /**
   * Explicit character whose stats resolve variables when a notation button is
   * clicked. When omitted, falls back to the store's `currentCharacter`.
   * Useful for NPC sheets where the rolled NPC may differ from the character
   * stored in `currentCharacter`.
   */
  character?: Character
  /**
   * The roll source to record with this roll (e.g. ability-damage). When
   * omitted, the roll defaults to a manual source.
   */
  source?: RollSource
}

export default function DiceHighlighter({
  text,
  mode = 'view',
  className,
  character: explicitCharacter,
  source,
}: DiceHighlighterProps) {
  const roll = useDiceRollStore((s) => s.roll)
  const showRanges = useDiceDisplayStore((s) => s.showRanges)
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const character = explicitCharacter ?? currentCharacter

  if (!text) return null

  const isView = mode === 'view'
  // The character's custom attributes are first-class notation tokens: their
  // shorthands and names are handed to the matcher so `2d6+FOO` (or a
  // multi-word name) is detected as one variable and resolved by the roller.
  const matches = isView
    ? findDiceNotation(text, customAttributeVariableNames(character?.customAttributes))
    : []

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
    // The badge shows the notation, or the range it can roll when the display
    // preference is on. A range needs a character to resolve stat names (an
    // unknown name would read 0 and lie about e.g. `1d6+POW`), so without one
    // the notation stays — exactly the badge a disabled click would offer.
    const range =
      isView && showRanges && character
        ? notationRange(match.match, character)
        : null
    segments.push(
      <button
        key={`dice-${i}`}
        type="button"
        className="dice-notation"
        onClick={() => {
          if (character) {
            roll({ notation: match.match, character, source })
          }
        }}
        title={isView ? `Roll ${match.match}` : undefined}
        // A range label hides the notation, so the button keeps naming the
        // roll it performs for assistive tech (and for stable test queries).
        aria-label={range ? `Roll ${match.match}` : undefined}
        disabled={!isView || !character}
      >
        {range ? `${range.min}-${range.max}` : match.match}
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
