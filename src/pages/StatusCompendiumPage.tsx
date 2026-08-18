/**
 * StatusCompendiumPage — the reference gallery of Divergence status conditions.
 *
 * Shows a scrolling three-column grid of status cards (icon, name, truncated
 * description, and reference tags), a "create new status" button, and sorting
 * by name / date created / date modified / referenced sheets. Clicking a card
 * opens the global StatusModal for details and editing.
 */

import { useMemo, useState } from 'react'

import ConfirmModal from '@/components/sheet/ConfirmModal'
import CreateStatusModal from '@/components/status/CreateStatusModal'
import StatusIcon from '@/components/status/StatusIcon'
import { plainTextFromMarkdown } from '@/lib/markdown'
import { collectCharacterStatusNames, referencingCharacters } from '@/lib/statusReference'
import { useCharacterStore } from '@/store/characterStore'
import { useStatusStore } from '@/store/statusStore'
import { DEFAULT_STATUS_TAG } from '@/types/status'
import type { StatusCondition } from '@/types'

type SortKey = 'name' | 'created' | 'modified' | 'referenced'

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  created: 'Date created',
  modified: 'Date modified',
  referenced: 'Referenced sheets',
}

export default function StatusCompendiumPage() {
  const statuses = useStatusStore((s) => s.statuses)
  const isLoaded = useStatusStore((s) => s.isLoaded)
  const openStatus = useStatusStore((s) => s.openStatus)
  const deleteStatus = useStatusStore((s) => s.deleteStatus)
  const createStatus = useStatusStore((s) => s.createStatus)
  const characters = useCharacterStore((s) => s.characters)

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [showCreate, setShowCreate] = useState(false)
  const [statusToDelete, setStatusToDelete] =
    useState<StatusCondition | null>(null)

  // Precompute per-status reference counts (lowercased name → number of sheets).
  const referenceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of characters) {
      const names = new Set(collectCharacterStatusNames(c))
      for (const name of names) {
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
    }
    return counts
  }, [characters])

  const sorted = useMemo(() => {
    const list = [...statuses]
    switch (sortKey) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'created':
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        break
      case 'modified':
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        break
      case 'referenced':
        list.sort((a, b) => {
          const ra = referenceCounts.get(a.name.trim().toLowerCase()) ?? 0
          const rb = referenceCounts.get(b.name.trim().toLowerCase()) ?? 0
          if (ra !== rb) return rb - ra
          return a.name.localeCompare(b.name)
        })
        break
    }
    return list
  }, [statuses, sortKey, referenceCounts])

  function tagsFor(status: StatusCondition): string[] {
    if (status.tags.includes(DEFAULT_STATUS_TAG)) return [DEFAULT_STATUS_TAG]
    return referencingCharacters(status.name, characters).map((c) => c.name)
  }

  if (!isLoaded) {
    return (
      <div className="page">
        <p className="muted">Loading statuses…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <span className="page-count">
          {statuses.length} status{statuses.length === 1 ? '' : 'es'}
        </span>
        <div className="page-head__actions">
          <label className="sort-select">
            <span className="sort-select__label" aria-hidden>
              Sort
            </span>
            <select
              className="sort-select__input"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort statuses"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn--primary page-head__btn"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            + New
          </button>
        </div>
      </div>

      {statuses.length === 0 ? (
        <div className="empty-state">
          <h2 className="empty-title">No statuses yet</h2>
          <p className="muted">
            Create your first status condition to reference in your sheets.
          </p>
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            Create New Status
          </button>
        </div>
      ) : (
        <ul className="status-grid" role="list">
          {sorted.map((status) => {
            const tags = tagsFor(status)
            return (
              <li key={status.id} className="status-card">
                <button
                  className="status-card__main"
                  type="button"
                  onClick={() => openStatus(status.id)}
                >
                  <span className="status-card__head">
                    <StatusIcon
                      icon={status.icon}
                      iconType={status.iconType}
                      size={22}
                      className="status-card__icon"
                    />
                    <span className="status-card__name">
                      {status.name || 'Untitled'}
                    </span>
                  </span>
                  <span className="status-card__desc">
                    {status.description
                      ? plainTextFromMarkdown(status.description)
                      : 'No description yet.'}
                  </span>
                  {tags.length > 0 && (
                    <span className="status-card__tags">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className={
                            'status-tag' +
                            (tag === DEFAULT_STATUS_TAG
                              ? ' status-tag--default'
                              : '')
                          }
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
                <button
                  className="status-card__delete"
                  type="button"
                  aria-label={`Delete ${status.name}`}
                  onClick={() => setStatusToDelete(status)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {showCreate && (
        <CreateStatusModal
          onCreate={(name) => {
            void createStatus(name)
            setShowCreate(false)
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {statusToDelete && (
        <ConfirmModal
          title="Delete Status?"
          message={
            <span>
              Are you sure you want to delete{' '}
              <strong>{statusToDelete.name || 'this status'}</strong>? Sheets
              that referenced it will show the name as plain text.
            </span>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => {
            void deleteStatus(statusToDelete.id)
            setStatusToDelete(null)
          }}
          onClose={() => setStatusToDelete(null)}
        />
      )}
    </div>
  )
}
