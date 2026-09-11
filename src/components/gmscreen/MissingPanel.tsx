/**
 * MissingPanel — placeholder for a panel whose referenced record was deleted.
 *
 * Placeholder state is DERIVED at render time (the record lookup fails), never
 * stored: there is no orphan cleanup and no cascade delete of screens, so the
 * GM decides when to drop the panel. Rolls are impossible from here because
 * there is no entity to resolve notation against.
 */

import { CircleSlash } from 'lucide-react'

export interface MissingPanelProps {
  /** Which kind of panel lost its record (drives the message). */
  kind: 'character' | 'npc-instance'
  onRemove: () => void
}

export default function MissingPanel({ kind, onRemove }: MissingPanelProps) {
  return (
    <div className="gm-panel gm-panel--missing">
      <div className="gm-panel__missing-body">
        <CircleSlash size={20} className="gm-panel__missing-icon" aria-hidden="true" />
        <p className="gm-panel__missing-text">
          {kind === 'character'
            ? 'Missing character — the sheet was deleted.'
            : 'Missing NPC — the base record was deleted.'}
        </p>
        <button type="button" className="btn btn--ghost" onClick={onRemove}>
          Remove panel
        </button>
      </div>
    </div>
  )
}
