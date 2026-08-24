/**
 * StatusHighlighter — renders text with matched `[StatusName]` references
 * turned into clickable pills, composing with the existing dice-notation
 * highlighting.
 *
 * Text is scanned for two kinds of annotations:
 *   - dice notation (e.g. "1d6+POW") — delegated to {@link DiceHighlighter}
 *   - status references in brackets (e.g. "[Poisoned]") — matched against the
 *     status store and rendered as {@link StatusReference} pills; unmatched
 *     brackets stay as literal text.
 *
 * In edit mode both are disabled and the text renders plainly so the editor
 * shows the raw source.
 */

import { findDiceNotation } from '@/lib/diceParser'
import { findStatusReferences, statusByName } from '@/lib/statusReference'
import { useStatusStore } from '@/store/statusStore'
import DiceHighlighter from '@/components/dice/DiceHighlighter'
import StatusReference from '@/components/status/StatusReference'
import type { Character } from '@/types/character'
import type { RollSource } from '@/types/rollLog'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface StatusHighlighterProps {
  /** The text to scan for status references and dice notation. */
  text: string
  /** Whether to enable clickable pills/rolls. In edit mode, set to false. */
  mode?: SheetMode
  /** Explicit character for dice variable substitution. */
  character?: Character
  /** The roll source to record with dice rolls (e.g. ability-damage). */
  source?: RollSource
}

type DiceSegment = {
  start: number
  end: number
  kind: 'dice'
  match: string
}

type StatusSegment = {
  start: number
  end: number
  kind: 'status'
  name: string
}

type Segment = DiceSegment | StatusSegment

export default function StatusHighlighter({
  text,
  mode = 'view',
  character,
  source,
}: StatusHighlighterProps) {
  const statuses = useStatusStore((s) => s.statuses)

  if (!text) return null

  const isView = mode === 'view'
  const statusRefs = isView ? findStatusReferences(text) : []

  // No status references — just delegate to dice highlighting.
  if (statusRefs.length === 0) {
    return <DiceHighlighter text={text} mode={mode} character={character} source={source} />
  }

  // Collect and merge both annotation kinds, ordered by position. In the
  // unlikely event that a dice match overlaps a bracket, the earlier-starting
  // segment wins so text is never double-rendered.
  const segments: Segment[] = [
    ...findDiceNotation(text).map<DiceSegment>((d) => ({
      start: d.start,
      end: d.end,
      kind: 'dice',
      match: d.match,
    })),
    ...statusRefs.map<StatusSegment>((r) => ({
      start: r.start,
      end: r.end,
      kind: 'status',
      name: r.name,
    })),
  ].sort((a, b) => a.start - b.start)

  const merged: Segment[] = []
  let lastEnd = 0
  for (const seg of segments) {
    if (seg.start < lastEnd) continue
    merged.push(seg)
    lastEnd = seg.end
  }

  const nodes: React.ReactNode[] = []
  let cursor = 0
  merged.forEach((seg, i) => {
    if (seg.start > cursor) {
      nodes.push(<span key={`t${i}`}>{text.slice(cursor, seg.start)}</span>)
    }

    if (seg.kind === 'dice') {
      nodes.push(
        <DiceHighlighter
          key={`d${i}`}
          text={seg.match}
          mode={mode}
          character={character}
          source={source}
        />,
      )
    } else {
      const status = statusByName(statuses, seg.name)
      nodes.push(
        status ? (
          <StatusReference key={`s${i}`} status={status} />
        ) : (
          <span key={`s${i}`}>{text.slice(seg.start, seg.end)}</span>
        ),
      )
    }

    cursor = seg.end
  })

  if (cursor < text.length) {
    nodes.push(<span key="tail">{text.slice(cursor)}</span>)
  }

  return <span>{nodes}</span>
}
