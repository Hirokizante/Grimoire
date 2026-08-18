/**
 * ExportDialog — version-aware export modal with optional manual version override.
 *
 * DESIGN.md "Sheet Export" & "Automatic Sheet Versioning":
 *   - Shows current version, an Export button that creates a versioned JSON
 *     file, and a version history list with restore/download/delete per row.
 *
 * Export flow:
 *   1. Call the store's `saveVersion(versionOverride?)` action, which bumps
 *      the version to the chosen value (or auto-bumps the patch level if
 *      the user didn't provide one) and stores a full snapshot.
 *   2. Initiates a browser download of `{Name} v{MAJOR.MINOR.PATCH}.json`.
 *   3. The version history list updates immediately so the new row appears.
 */

import { useEffect, useState } from 'react'
import { ArrowUpFromLine, Hash, RotateCcw, Trash2 } from 'lucide-react'

import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { bumpSemver, downloadJson, serializeSemver, versionedFilename } from '@/lib/exportImport'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import type { Semver } from '@/types'

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

  const [versionOverrideText, setVersionOverrideText] = useState('')
  const [pendingRestore, setPendingRestore] = useState<{ id: string; version: Semver } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; version: Semver } | null>(null)

  useEscapeKey(onClose, open && !pendingRestore && !pendingDelete)

  // Reload history whenever the dialog opens.
  useEffect(() => {
    if (open) {
      void loadVersions()
      setVersionOverrideText('')
    }
  }, [open, loadVersions])

  if (!currentCharacter || !open) return null

  const parsedOverride = serializeSemver(versionOverrideText)
  const nextVersion = bumpSemver(currentCharacter.version)

  const handleExport = async () => {
    const snap = await saveVersion(parsedOverride ?? undefined)
    if (snap) {
      notify(`✓ Saved v${snap.version} and started download.`, 'success')
      setVersionOverrideText('')
    } else {
      notify('Failed to save version.', 'error')
    }
  }

  const handleRestore = async (snapshotId: string, version: Semver) => {
    setPendingRestore({ id: snapshotId, version })
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return
    await restoreVersion(pendingRestore.id)
    notify(`Restored v${pendingRestore.version}.`, 'success')
    setPendingRestore(null)
  }

  const handleDelete = async (snapshotId: string, version: Semver) => {
    setPendingDelete({ id: snapshotId, version })
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    await deleteVersion(pendingDelete.id)
    notify(`Deleted v${pendingDelete.version}.`, 'warning')
    setPendingDelete(null)
  }

  const handleDownload = (snap: { data: { name: string }, version: Semver }) => {
    const fn = versionedFilename(snap.data.name, snap.version)
    downloadJson(snap.data, fn)
    notify(`Downloaded v${snap.version}.`, 'info')
  }

  const isInvalidOverride = versionOverrideText.trim() !== '' && parsedOverride === null

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
              disabled={isSaving || isInvalidOverride}
              title={isInvalidOverride ? 'Enter a valid version like 9.1.2' : undefined}
            >
              <ArrowUpFromLine size={14} />
              {isSaving ? 'Saving…' : 'Export & Snapshot'}
            </button>
          </div>

          {/* Optional version override */}
          <div className="export-dialog__version-row">
            <label className="export-dialog__label" htmlFor="export-version-override">
              <Hash size={10} />
              Version number (optional)
            </label>
            <input
              id="export-version-override"
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
                Use MAJOR.MINOR.PATCH (e.g. 9.1.2)
              </span>
            )}
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
                        className="btn btn--icon version-row__btn"
                        onClick={() => handleDownload(snap)}
                        title="Download this version as JSON"
                        >
                        <ArrowUpFromLine size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--icon version-row__btn"
                        onClick={() => handleRestore(snap.id, snap.version)}
                        disabled={isRestoring}
                        title="Restore this version (creates a new version with this data)"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--icon version-row__btn"
                        onClick={() => handleDelete(snap.id, snap.version)}
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

      {pendingRestore && (
        <ConfirmModal
          title="Restore Version?"
          message={
            <span>
              Restoring <strong>v{pendingRestore.version}</strong> will replace
              the current character data. This creates a new version snapshot —
              the current version will remain in history.
            </span>
          }
          confirmLabel="Restore"
          cancelLabel="Cancel"
          variant="warning"
          onConfirm={() => void handleConfirmRestore()}
          onClose={() => setPendingRestore(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete Version?"
          message={
            <span>
              Are you sure you want to delete version{' '}
              <strong>v{pendingDelete.version}</strong>? This snapshot and its
              data will be permanently removed.
            </span>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
