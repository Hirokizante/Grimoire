/**
 * NPCSelectorModal — lets the user attach an existing saved NPC to a custom
 * tab (or create a new one from scratch).
 *
 * Shown after the user picks "NPC Sheet" in the Add Section chooser. Presents
 * a scrolling list of every saved NPC record (kind === 'npc'); clicking one
 * attaches it by reference. A "Create New NPC" action at the top lets the user
 * name and create a fresh blank NPC instead.
 *
 * Follows the project's modal convention: overlay click or ✕ closes, Esc
 * closes via useEscapeKey, footer has Cancel.
 */

import { User, UserPlus } from 'lucide-react'

import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'

export interface NPCSelectorModalProps {
  open: boolean
  /** Called with the id of the NPC the user chose to attach. */
  onSelect: (npcId: string) => void
  /** Called when the user wants to create a brand-new NPC. */
  onCreateNew: () => void
  onClose: () => void
}

export default function NPCSelectorModal({
  open,
  onSelect,
  onCreateNew,
  onClose,
}: NPCSelectorModalProps) {
  useEscapeKey(onClose, open)

  const npcs = useCharacterStore((s) => s.characters).filter(
    (c) => c.kind === 'npc',
  )

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content npc-selector-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose an NPC"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Choose an NPC</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="npc-selector-modal__body">
          <button
            type="button"
            className="npc-selector-modal__create"
            onClick={onCreateNew}
          >
            <UserPlus size={18} />
            <span className="npc-selector-modal__create-text">
              Create New NPC
            </span>
          </button>

          {npcs.length === 0 ? (
            <p className="npc-selector-modal__empty muted">
              No saved NPCs yet. Create one to attach it here.
            </p>
          ) : (
            <ul className="npc-selector-modal__list" role="list">
              {npcs.map((npc: Character) => (
                <li key={npc.id}>
                  <button
                    type="button"
                    className="npc-selector-modal__item"
                    onClick={() => onSelect(npc.id)}
                  >
                    <span className="npc-selector-modal__icon">
                      {npc.portrait ? (
                        <img
                          className="npc-selector-modal__portrait"
                          src={npc.portrait}
                          alt={npc.name}
                        />
                      ) : (
                        <User size={18} />
                      )}
                    </span>
                    <span className="npc-selector-modal__name">{npc.name}</span>
                    <span className="npc-selector-modal__meta">
                      {npc.npcStats?.hp ?? 0} HP
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
