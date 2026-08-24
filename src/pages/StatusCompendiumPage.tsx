/**
 * StatusCompendiumPage — the reference gallery of Divergence status conditions.
 *
 * Shows a scrolling three-column grid of status cards (icon, name, truncated
 * description, and reference tags), a "create new status" button, and sorting
 * by name / date created / date modified. Clicking a card opens the global
 * StatusModal for details and editing.
 */

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import ConfirmModal from '@/components/sheet/ConfirmModal'
import CreateStatusModal from '@/components/status/CreateStatusModal'
import StatusIcon from '@/components/status/StatusIcon'
import FilterDropdown, { type FilterGroup } from '@/components/ui/FilterDropdown'
import SortDropdown, { type SortOption } from '@/components/ui/SortDropdown'
import { plainTextFromMarkdown } from '@/lib/markdown'
import { collectCharacterStatusNames, referencingCharacters } from '@/lib/statusReference'
import { useCharacterStore } from '@/store/characterStore'
import { useStatusStore } from '@/store/statusStore'
import { DEFAULT_STATUS_TAG } from '@/types/status'
import type { StatusCondition } from '@/types'

type SortKey = 'name' | 'created' | 'modified'

const SORT_OPTIONS: SortOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Date created' },
  { value: 'modified', label: 'Date modified' },
]

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

  /** Active filter selections: groupId → set of selected values. */
  const [filterSelection, setFilterSelection] = useState<
    Record<string, Set<string>>
  >({ type: new Set(), sheet: new Set() })

  /**
   * Build filter groups:
   * - "type": Default (built-in) vs Custom
   * - "sheet": every character sheet name (statuses referenced in that sheet)
   */
  const filterGroups = useMemo<FilterGroup[]>(() => {
    const typeOptions = [
      { label: 'Default', value: 'default' },
      { label: 'Custom', value: 'custom' },
    ]
    const sheetOptions = characters
      .map((c) => ({ label: c.name, value: c.id }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return [
      { id: 'type', title: 'Type', options: typeOptions },
      { id: 'sheet', title: 'Referenced in sheet', options: sheetOptions },
    ]
  }, [characters])

  /** Map: characterId → set of lowercased status names that character references. */
  const charStatusMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of characters) {
      map.set(c.id, new Set(collectCharacterStatusNames(c)))
    }
    return map
  }, [characters])

  /** Apply active filters to the status list. */
  const filteredStatuses = useMemo(() => {
    const typeSel = filterSelection.type ?? new Set<string>()
    const sheetSel = filterSelection.sheet ?? new Set<string>()
    if (typeSel.size === 0 && sheetSel.size === 0) return statuses
    return statuses.filter((s) => {
      // Type filter
      if (typeSel.size > 0) {
        const isDefault = s.tags.includes(DEFAULT_STATUS_TAG)
        const matchesDefault = typeSel.has('default') && isDefault
        const matchesCustom = typeSel.has('custom') && !isDefault
        if (!matchesDefault && !matchesCustom) return false
      }
      // Sheet filter: status must be referenced in at least one selected sheet
      if (sheetSel.size > 0) {
        const lowerName = s.name.trim().toLowerCase()
        let found = false
        for (const charId of sheetSel) {
          const names = charStatusMap.get(charId)
          if (names?.has(lowerName)) {
            found = true
            break
          }
        }
        if (!found) return false
      }
      return true
    })
  }, [statuses, filterSelection, charStatusMap])

  function handleFilterToggle(groupId: string, value: string) {
    setFilterSelection((prev) => {
      const next = { ...prev }
      const set = new Set(next[groupId] ?? new Set<string>())
      if (set.has(value)) set.delete(value)
      else set.add(value)
      next[groupId] = set
      return next
    })
  }

  function handleFilterClear() {
    setFilterSelection({ type: new Set(), sheet: new Set() })
  }

  const sorted = useMemo(() => {
    const list = [...filteredStatuses]
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
    }
    return list
  }, [filteredStatuses, sortKey])

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
          {sorted.length} status{sorted.length === 1 ? '' : 'es'}
        </span>
        <div className="page-head__actions">
          <FilterDropdown
            groups={filterGroups}
            selected={filterSelection}
            onToggle={handleFilterToggle}
            onClear={handleFilterClear}
          />
          <SortDropdown
            options={SORT_OPTIONS}
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            label="Sort statuses"
          />
          <button
            className="btn btn--primary page-head__btn"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} />
            <span className="page-head__btn-label">New</span>
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
