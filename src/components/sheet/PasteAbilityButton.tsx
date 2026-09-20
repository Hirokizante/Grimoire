/**
 * PasteAbilityButton — the "Paste" affordance rendered beside a section's
 * "+ Add Ability" button.
 *
 * Reads the app's one-slot ability clipboard and renders **nothing** while it
 * is empty: there is nothing to paste, and a permanently disabled button would
 * be noise. A click hands the caller a **fresh clone** of the copied block —
 * new ids, live-play state reset (see lib/abilityClone.ts) — because only the
 * section knows where the block goes: a slotted/pool list appends through the
 * store's `addAbilityBlock`, a custom section through `addCustomAbility`, an
 * NPC's list through `updateCharacter`.
 *
 * Shared by every ability section so the control, its tooltip, and the
 * empty-clipboard rule cannot drift between them.
 */

import { useAbilityClipboard } from '@/hooks/useAbilityClipboard'
import type { AbilityBlock } from '@/types'

export interface PasteAbilityButtonProps {
  /** Insert the fresh clone into this section. */
  onPaste: (ability: AbilityBlock) => void
}

export default function PasteAbilityButton({
  onPaste,
}: PasteAbilityButtonProps) {
  const { copied, pasteAbility } = useAbilityClipboard()
  if (!copied) return null

  return (
    <button
      type="button"
      className="btn btn--ghost section-add-btn"
      onClick={() => {
        const copy = pasteAbility()
        if (copy) onPaste(copy)
      }}
      title={`Paste “${copied.name || 'Untitled Ability'}”`}
    >
      Paste
    </button>
  )
}
