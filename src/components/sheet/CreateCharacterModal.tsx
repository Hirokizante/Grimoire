/**
 * CreateCharacterModal — a styled modal for naming a new character.
 *
 * Replaces the native `window.prompt` in CharacterListPage. Follows the
 * project's modal convention: overlay click or ✕ dismisses, footer has the
 * primary action, Esc closes via useEscapeKey.
 */

import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

export interface CreateCharacterModalProps {
  /** Called when the user confirms the name. Empty/blank names are not passed. */
  onCreate: (name: string) => void
  /** Called when the user cancels (Esc, overlay, or close button). */
  onClose: () => void
}

export default function CreateCharacterModal({
  onCreate,
  onClose,
}: CreateCharacterModalProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEscapeKey(onClose)

  useEffect(() => {
    // Auto-focus the input when the modal opens.
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content create-character-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create new character"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>New Character</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="create-character-modal__body">
            <label className="create-character-modal__field">
              <span className="create-character-modal__label">Character Name</span>
              <input
                ref={inputRef}
                type="text"
                className="sheet-input"
                placeholder="Enter a name…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
              />
            </label>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!name.trim()}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
