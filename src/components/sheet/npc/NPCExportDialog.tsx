/**
 * NPCExportDialog — export modal for NPC sheets.
 *
 * Simpler than the character ExportDialog: NPCs are static references, so
 * there is no version history browsing. The dialog shows the current version,
 * an optional version override, and an Export button that downloads the NPC
 * as a versioned JSON file and stores a snapshot (so re-imports can resolve
 * version conflicts).
 */

import { useState } from 'react'
import { ArrowUpFromLine, Hash } from 'lucide-react'

import { useModalDialog } from '@/hooks/useModalDialog'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import {
  bumpSemver,
  serializeSemver,
} from '@/lib/exportImport'

export interface NPCExportDialogProps {
  open: boolean
  onClose: () => void
}

export default function NPCExportDialog({
  open,
  onClose,
}: NPCExportDialogProps) {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const saveVersion = useCharacterStore((s) => s.saveVersion)
  const { notify } = useNotification()

  const [versionOverrideText, setVersionOverrideText] = useState('')

  const dialogRef = useModalDialog(onClose, open)

  if (!currentCharacter || !open) return null

  const parsedOverride = serializeSemver(versionOverrideText)
  const nextVersion = bumpSemver(currentCharacter.version)

  const handleExport = async () => {
    const snap = await saveVersion(parsedOverride ?? undefined)
    if (snap) {
      notify(`✓ Saved v${snap.version} and started download.`, 'success')
      setVersionOverrideText('')
    } else {
      notify('Failed to export NPC.', 'error')
    }
  }

  const isInvalidOverride =
    versionOverrideText.trim() !== '' && parsedOverride === null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content export-dialog"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Export NPC</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="export-dialog__body">
          {/* Current version info */}
          <div className="export-dialog__current">
            <div className="export-dialog__version-info">
              <span className="export-dialog__label">Current version</span>
              <span className="export-dialog__version">
                v{currentCharacter.version}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--primary export-dialog__export-btn"
              onClick={handleExport}
              disabled={isInvalidOverride}
              title={
                isInvalidOverride
                  ? 'Enter a valid version like 1.0.0'
                  : undefined
              }
            >
              <ArrowUpFromLine size={14} />
              Export
            </button>
          </div>

          {/* Optional version override */}
          <div className="export-dialog__version-row">
            <label
              className="export-dialog__label"
              htmlFor="npc-export-version-override"
            >
              <Hash size={10} />
              Version number (optional)
            </label>
            <input
              id="npc-export-version-override"
              type="text"
              inputMode="numeric"
              pattern="[0-9.]*"
              className="export-dialog__version-input"
              placeholder={`auto (next: v${nextVersion})`}
              value={versionOverrideText}
              onChange={(e) => setVersionOverrideText(e.target.value)}
              maxLength={11}
            />
            {isInvalidOverride && (
              <span className="export-dialog__version-error">
                Use MAJOR.MINOR.PATCH (e.g. 1.0.0)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
