/**
 * SectionReorderButtons — the ↑/↓ pair that shifts a custom-tab section one
 * position within its tab.
 *
 * One component for all three custom section kinds (ability, NPC, text), so
 * their heading rows cannot drift apart. The parent passes the section's index
 * and the tab's section count; the first section's ↑ and the last section's ↓
 * render **disabled rather than hidden**, so the control keeps its place and
 * the heading row never reflows as a section walks the tab. A disabled arrow
 * is also the read-out of "nothing above/below to trade with" without asking
 * the store to no-op.
 */

import { ArrowDown, ArrowUp } from '@/components/ui/icons'

import { useCharacterStore } from '@/store/characterStore'

export interface SectionReorderButtonsProps {
  tabId: string
  /** Zero-based position of this section within its tab. */
  index: number
  /** Total number of sections in the tab. */
  count: number
  /** Section name, used in the accessible labels. */
  name: string
}

export default function SectionReorderButtons({
  tabId,
  index,
  count,
  name,
}: SectionReorderButtonsProps) {
  const reorderCustomSection = useCharacterStore((s) => s.reorderCustomSection)

  const canMoveUp = index > 0
  const canMoveDown = index < count - 1

  return (
    <div className="section-reorder" role="group" aria-label={`Reorder ${name}`}>
      <button
        type="button"
        className="btn btn--icon section-reorder__btn"
        onClick={() => reorderCustomSection(tabId, index, index - 1)}
        disabled={!canMoveUp}
        aria-label={`Move ${name} up`}
      >
        <ArrowUp size={16} />
      </button>
      <button
        type="button"
        className="btn btn--icon section-reorder__btn"
        onClick={() => reorderCustomSection(tabId, index, index + 1)}
        disabled={!canMoveDown}
        aria-label={`Move ${name} down`}
      >
        <ArrowDown size={16} />
      </button>
    </div>
  )
}
