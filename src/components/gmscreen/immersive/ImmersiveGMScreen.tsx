/**
 * ImmersiveGMScreen — the immersive list view's layout: the character list
 * drawer on the left and the selected character's encounter sheet filling the
 * rest of the screen.
 *
 * Selection is view-local state (session-level — it is not part of the screen
 * record), defaulting to the first panel and falling back to it whenever the
 * selected panel disappears (switched screen, removed panel, deleted record).
 * The drawer, the round tracker above (rendered by the page), and the main
 * area together read as one surface: the drawer is where characters enter,
 * the main area is where one of them runs.
 */

import { useState } from 'react'
import { Users } from '@/components/ui/icons'

import CharacterDrawer from './CharacterDrawer'
import EncounterSheet from './EncounterSheet'
import { useGMScreenStore } from '@/store/gmScreenStore'
import type { GMScreen } from '@/types'
import type { ResolvedPanel } from '@/lib/gmScreenUtils'

export interface ImmersiveGMScreenProps {
  screen: GMScreen
  /** Every panel of the screen resolved against the live character list. */
  resolved: ResolvedPanel[]
  /** Open a player character's (or an NPC base's) normal sheet page. */
  onOpenSheet: (characterId: string) => void
  /** Open the page's Add Character picker. */
  onAddCharacter: () => void
  /** Open the page's Add NPC picker. */
  onAddNpc: () => void
}

export default function ImmersiveGMScreen({
  screen,
  resolved,
  onOpenSheet,
  onAddCharacter,
  onAddNpc,
}: ImmersiveGMScreenProps) {
  const movePanel = useGMScreenStore((s) => s.movePanel)
  const removePanel = useGMScreenStore((s) => s.removePanel)
  /** Null while the GM has not picked one; the first panel stands in. */
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The effective selection: the GM's pick while it still exists, otherwise
  // the first panel — so a removed or missing record can never leave the main
  // area dangling, and switching screens lands on the new screen's first
  // panel.
  const selectedEntry =
    resolved.find((r) => r.panel.id === selectedId) ?? resolved[0] ?? null

  return (
    <div className="gm-immersive">
      <CharacterDrawer
        resolved={resolved}
        selectedPanelId={selectedEntry?.panel.id ?? null}
        onSelectPanel={setSelectedId}
        onMovePanel={(fromIndex, toIndex) =>
          movePanel(screen.id, fromIndex, toIndex)
        }
        onRemovePanel={(panelId) => removePanel(screen.id, panelId)}
        onAddCharacter={onAddCharacter}
        onAddNpc={onAddNpc}
      />

      {selectedEntry ? (
        <div className="gm-immersive__main">
          <EncounterSheet
            screenId={screen.id}
            entry={selectedEntry}
            onOpenSheet={onOpenSheet}
            onRemove={() => removePanel(screen.id, selectedEntry.panel.id)}
          />
        </div>
      ) : (
        <div className="gm-immersive__main gm-immersive__empty">
          <Users size={40} className="gm-screen__empty-icon" aria-hidden="true" />
          <h3 className="empty-title">No character selected</h3>
          <p className="muted">
            Pick a character from the drawer — or add one — to run their sheet
            here.
          </p>
        </div>
      )}
    </div>
  )
}
