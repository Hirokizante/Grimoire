/**
 * UpdateCharacterModal — a dialog that appears when the user imports a
 * version of an existing character sheet.
 *
 * Shows the version change context and offers two actions:
 *   - Update Existing — merge the imported data into the existing character
 *     (preserving id, name, and live-play resources).
 *   - Import as New — add the imported sheet as a separate character.
 *
 * Follows the project's modal convention: overlay click or ✕ closes, Esc closes
 * via useEscapeKey, footer has the action buttons.
 */

import { useEscapeKey } from '@/hooks/useEscapeKey'
import { compareSemver } from '@/lib/exportImport'

export interface UpdateCharacterModalProps {
  /** Name of the existing character being matched. */
  characterName: string
  /** Version of the existing character. */
  existingVersion: string
  /** Version of the imported JSON file. */
  importedVersion: string
  /** Called when the user chooses to update the existing character. */
  onUpdate: () => void
  /** Called when the user chooses to import as a new character. */
  onImportAsNew: () => void
  /** Called when the user cancels (Esc, overlay, or close button). */
  onClose: () => void
}

export default function UpdateCharacterModal({
  characterName,
  existingVersion,
  importedVersion,
  onUpdate,
  onImportAsNew,
  onClose,
}: UpdateCharacterModalProps) {
  useEscapeKey(onClose)

  const comparison = compareSemver(importedVersion, existingVersion)
  const isNewer = comparison > 0
  const isSame = comparison === 0
  const directionLabel = isNewer
    ? 'newer'
    : comparison < 0
      ? 'older'
      : 'same'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content update-character-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import existing character"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Character Already Exists</h3>
        </div>

        <div className="update-character-modal__body">
          <p className="update-character-modal__message">
            You're importing{' '}
            <strong className="update-character-modal__item-name">
              "{characterName}"
            </strong>{' '}
            ({isSame ? 'same version' : `${directionLabel} version`} — existing v{existingVersion}, imported v{importedVersion}).
          </p>
          <p className="update-character-modal__hint">
            Would you like to update the existing character, or import it as a new sheet?
          </p>
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
            type="button"
            className="btn btn--ghost"
            onClick={onImportAsNew}
          >
            Import as New
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onUpdate}
          >
            Update Existing
          </button>
        </div>
      </div>
    </div>
  )
}
