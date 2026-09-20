/**
 * The app's one-slot ability clipboard.
 *
 * **Copy snapshots, paste clones.** {@link AbilityClipboardState.copyAbility}
 * stores a deep copy of the block, so editing the original after copying can
 * never change what a later paste inserts — the clipboard holds the block as it
 * was when Copy was pressed. Fresh ids and the clean live-play state a pasted
 * block needs are the cloner's job (lib/abilityClone.ts), applied at paste
 * time, so one clipboard entry can be pasted any number of times.
 *
 * The clipboard is deliberately **in memory only**: it is a scratchpad for
 * moving blocks between sections and tabs within a session, not data. It is
 * shared by the whole app, so it also carries a block from one character's
 * sheet to another's — custom cost bar ids are the one thing that does not
 * travel (see `cloneAbilityBlock`).
 */

import { create } from 'zustand'

import type { AbilityBlock } from '@/types'

export interface AbilityClipboardState {
  /** The copied block, or null when nothing has been copied. */
  copied: AbilityBlock | null
  /** Snapshot a block on the clipboard, replacing whatever was there. */
  copyAbility: (ability: AbilityBlock) => void
  /** Empty the clipboard. */
  clearClipboard: () => void
}

export const useAbilityClipboardStore = create<AbilityClipboardState>()((set) => ({
  copied: null,
  copyAbility: (ability) => set({ copied: structuredClone(ability) }),
  clearClipboard: () => set({ copied: null }),
}))
