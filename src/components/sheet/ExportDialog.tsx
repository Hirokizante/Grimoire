/**
 * ExportDialog — version-aware export modal.
 *
 * DESIGN.md "Sheet Export" & "Automatic Sheet Versioning":
 *   - Shows current version, an Export button that creates a versioned JSON
 *     file, and a version history list with restore/download/delete per row.
 *
 * Export flow:
 *   1. Call the store's `saveVersion` action, which bumps the version counter
 *      and stores a full snapshot of the character.
 *   2. Initiates a browser download of `{Name} v{N}.json`.
 *   3. The version history list updates immediately so the new row appears.
 */

import { useEffect } from 'react'
import { ArrowUpFromLine, RotateCcw, Trash2 } from 'lucide-react'

import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { downloadJson, versionedFilename } from '@/lib/exportImport'

export interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

/** Format an ISO timestamp as a short locale-friendly date/time. */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const versionHistory = useCharacterStore((s) => s.versionHistory)
  const isSaving = useCharacterStore((s) => s.isSaving)
  const isRestoring = useCharacterStore((s) => s.isRestoring)

  const saveVersion = useCharacterStore((s) => s.saveVersion)
  const loadVersions = useCharacterStore((s) => s.loadVersions)
  const restoreVersion = useCharacterStore((s) => s.restoreVersion)
  const deleteVersion = useCharacterStore((s) => s.deleteVersion)
  const { notify } = useNotification()

  useEscapeKey(onClose, open)

  // Relocal history whenever the dialog opens.
  useEffect(() => {
    if (open) void loadVersions()
  }, [open, loadVersions])

  if (!currentCharacter || !open) return null

  const handleExport = async () => {
    const snap = await saveVersion()
    if (snap) {
      notify(`✓ Saved v${snap.version} and started download.`, 'success')
    } else {
      notify('Failed to save version.', 'error')
    }
  }

  const handleRestore = async (snapshotId: string, version: number) => {
    await restoreVersion(snapshotId)
    notify(`Restored v${version}.`, 'success')
  }

  const handleDelete = async (snapshotId: string) => {
    await deleteVersion(snapshotId)
    notify('Version deleted.', 'warning')
  }

  const handleDownload = (snap: { data: { name: string }, version: number }) => {
    const fn = versionedFilename(snap.data.name, snap.version)
    downloadJson(snap.data, fn)
    notify(`Downloaded v${snap.version}.`, 'info')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content export-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Export &amp; Version History</h3>
          <button
            type="button"
            className="btn btn--ghost modal-close"
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
              disabled={isSaving}
            >
              <ArrowUpFromLine size={14} />
              {isSaving ? 'Saving…' : 'Export & Snapshot'}
            </button>
          </div>

          {/* Version history list */}
          <div className="export-dialog__history">
            <h4 className="export-dialog__history-title">Previous versions</h4>

            {!versionHistory || versionHistory.length === 0 ? (
              <p className="export-dialog__empty">
                No previous versions. Export to create a versioned snapshot.
              </p>
            ) : (
              <ul className="export-dialog__list">
                {versionHistory.map((snap) => (
                  <li key={snap.id} className="version-row">
                    <div className="version-row__info">
                      <span className="version-row__version">
                        v{snap.version}
                      </span>
                      <span className="version-row__date">
                        {formatDate(snap.createdAt)}
                      </span>
                    </div>
                    <div className="version-row__actions">
                      <button
                        type="button"
                        className="btn btn--ghost version-row__btn"
                        onClick={() => handleDownload(snap)}
                        title="Download this version as JSON"
                        >
                        <ArrowUpFromLine size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost version-row__btn"
                        onClick={() => handleRestore(snap.id, snap.version)}
                        disabled={isRestoring}
                        title="Restore this version (creates a new version with this data)"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost version-row__btn"
                        onClick={() => handleDelete(snap.id)}
                        title="Delete this version"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
