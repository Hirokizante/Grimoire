/**
 * useAbilityClipboard — the sheet-side controls for the ability clipboard.
 *
 * Wraps {@link useAbilityClipboardStore} with the two things a card needs:
 *
 *   - `copyAbility` snapshots the block and confirms with a toast — the
 *     clipboard is invisible, so the copy needs feedback;
 *   - `pasteAbility` hands back a **fresh clone** of the clipboard (new ids,
 *     live-play state reset — see lib/abilityClone.ts), ready to insert into
 *     whichever section the Paste button belongs to. It returns null when the
 *     clipboard is empty.
 *
 * The caller owns the insertion, because each surface writes through its own
 * action: a slotted/pool section through `addAbilityBlock`, a custom section
 * through `addCustomAbility`, an NPC's list through `updateCharacter`.
 *
 * `copied` is the render-time snapshot: a section shows its Paste button only
 * while it is non-null.
 */

import { useCallback } from 'react'

import { useOptionalNotification } from '@/context/NotificationContext'
import { cloneAbilityBlock } from '@/lib/abilityClone'
import { useAbilityClipboardStore } from '@/store/abilityClipboardStore'
import type { AbilityBlock } from '@/types'

export interface AbilityClipboardControls {
  /** The copied block, or null when the clipboard is empty. */
  copied: AbilityBlock | null
  /** Snapshot an ability on the clipboard and confirm with a toast. */
  copyAbility: (ability: AbilityBlock) => void
  /**
   * A fresh, id-regenerated clone of the clipboard to insert — or null when
   * nothing has been copied.
   */
  pasteAbility: () => AbilityBlock | null
}

export function useAbilityClipboard(): AbilityClipboardControls {
  const copied = useAbilityClipboardStore((s) => s.copied)
  const storeCopy = useAbilityClipboardStore((s) => s.copyAbility)
  const notify = useOptionalNotification()?.notify

  const copyAbility = useCallback(
    (ability: AbilityBlock) => {
      storeCopy(ability)
      notify?.(`Copied “${ability.name || 'Untitled Ability'}”`, 'success')
    },
    [storeCopy, notify],
  )

  // Read the clipboard at click time rather than closing over `copied`, so a
  // paste always inserts what is on the clipboard *now*.
  const pasteAbility = useCallback((): AbilityBlock | null => {
    const snapshot = useAbilityClipboardStore.getState().copied
    return snapshot ? cloneAbilityBlock(snapshot) : null
  }, [])

  return { copied, copyAbility, pasteAbility }
}
