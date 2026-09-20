/**
 * StatusCompendiumPage — the reference gallery of Divergence status conditions.
 *
 * Shows a scrolling three-column grid of status cards (icon, name, truncated
 * description, and a one-row preview of reference tags), a "create new status"
 * button, and sorting by name / date created / date modified. Clicking a card
 * opens the global StatusModal for details and editing, including the full list
 * of sheets that reference the status. The page head also imports status files
 * (a single condition, or a whole compendium that OVERWRITES the current one)
 * and exports the entire compendium.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowDownFromLine, ArrowUpFromLine, Plus } from '@/components/ui/icons'

import ConfirmModal from '@/components/sheet/ConfirmModal'
import CreateStatusModal from '@/components/status/CreateStatusModal'
import StatusIcon from '@/components/status/StatusIcon'
import FilterDropdown, { type FilterGroup } from '@/components/ui/FilterDropdown'
import SortDropdown, { type SortOption } from '@/components/ui/SortDropdown'
import { useNotification } from '@/context/NotificationContext'
import { downloadJson } from '@/lib/exportImport'
import { plainTextFromMarkdown } from '@/lib/markdown'
import { collectCharacterStatusNames, referencingCharacters } from '@/lib/statusReference'
import {
  buildStatusCompendiumFile,
  parseStatusImport,
  statusCompendiumFilename,
} from '@/lib/statusTransfer'
import { useCharacterStore } from '@/store/characterStore'
import {
  matchesFacet,
  useListPrefsStore,
  type ListPageId,
  type ListSortKey,
} from '@/store/listPrefsStore'
import { useStatusStore } from '@/store/statusStore'
import { DEFAULT_STATUS_TAG } from '@/types/status'
import type { StatusCondition } from '@/types'

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
  const importStatus = useStatusStore((s) => s.importStatus)
  const replaceStatuses = useStatusStore((s) => s.replaceStatuses)
  const characters = useCharacterStore((s) => s.characters)
  const { notify } = useNotification()
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** Sort + filter prefs live in listPrefsStore (persisted to localStorage). */
  const sortKey = useListPrefsStore((s) => s.statusSortKey)
  const setSortKey = useListPrefsStore((s) => s.setStatusSortKey)
  const filterSelection = useListPrefsStore((s) => s.statusFilters)
  const toggleFilterPref = useListPrefsStore((s) => s.toggleFilter)
  const clearFilterPrefs = useListPrefsStore((s) => s.clearFilters)
  const PAGE_ID: ListPageId = 'statuses'
  const [showCreate, setShowCreate] = useState(false)
  const [statusToDelete, setStatusToDelete] =
    useState<StatusCondition | null>(null)
  /** Parsed compendium awaiting confirmation — importing it replaces everything. */
  const [pendingCompendium, setPendingCompendium] = useState<
    StatusCondition[] | null
  >(null)

  /**
   * Read a picked JSON file. Single conditions merge (a same-named condition
   * is updated in place); a compendium is staged behind a confirmation,
   * because importing it overwrites the whole compendium.
   */
  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Reset so re-selecting the same file still fires change.
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        try {
          const parsed = parseStatusImport(reader.result)
          if (parsed.kind === 'compendium') {
            setPendingCompendium(parsed.statuses)
            return
          }
          void importStatus(parsed.status)
            .then((outcome) => {
              const name = parsed.status.name.trim() || 'Untitled'
              notify(
                outcome === 'updated'
                  ? `✓ Updated “${name}”.`
                  : `✓ Imported “${name}”.`,
                'success',
              )
            })
            .catch(() => notify('Could not save the imported status.', 'error'))
        } catch (err) {
          notify(
            err instanceof Error ? err.message : 'Could not read status file.',
            'error',
            5000,
          )
        }
      }
      reader.onerror = () => notify('Could not read status file.', 'error')
      reader.readAsText(file)
    },
    [importStatus, notify],
  )

  /** Download every condition in the compendium as one JSON file. */
  const handleExportCompendium = useCallback(() => {
    downloadJson(
      buildStatusCompendiumFile(statuses),
      statusCompendiumFilename(),
    )
    notify(
      `✓ Exported ${statuses.length} status${statuses.length === 1 ? '' : 'es'}.`,
      'success',
    )
  }, [statuses, notify])

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
    const typeSel = filterSelection.type ?? {}
    const sheetSel = filterSelection.sheet ?? {}
    if (
      Object.keys(typeSel).length === 0 &&
      Object.keys(sheetSel).length === 0
    ) {
      return statuses
    }
    return statuses.filter((s) => {
      // Type: include = must be that type; exclude = must not be.
      const isDefault = s.tags.includes(DEFAULT_STATUS_TAG)
      const typeOk = matchesFacet(typeSel, (value) =>
        value === 'default' ? isDefault : !isDefault,
      )
      if (!typeOk) return false
      // Sheet: any included sheet must reference it; excluded sheets must not.
      const lowerName = s.name.trim().toLowerCase()
      return matchesFacet(sheetSel, (charId) =>
        Boolean(charStatusMap.get(charId)?.has(lowerName)),
      )
    })
  }, [statuses, filterSelection, charStatusMap])

  function handleFilterToggle(groupId: string, value: string) {
    toggleFilterPref(PAGE_ID, groupId, value)
  }

  function handleFilterClear() {
    clearFilterPrefs(PAGE_ID)
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
            onChange={(v) => setSortKey(v as ListSortKey)}
            label="Sort statuses"
          />
          <button
            className="btn btn--primary page-head__btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import a status or a whole status compendium"
          >
            <ArrowDownFromLine size={14} />
            <span className="page-head__btn-label">Import</span>
          </button>
          {statuses.length > 0 && (
            <button
              className="btn btn--primary page-head__btn"
              type="button"
              onClick={handleExportCompendium}
              title="Export the entire status compendium as JSON"
            >
              <ArrowUpFromLine size={14} />
              <span className="page-head__btn-label">Export</span>
            </button>
          )}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={handleImportFile}
      />

      {statuses.length === 0 ? (
        <div className="empty-state">
          <h2 className="empty-title">No statuses yet</h2>
          <p className="muted">
            Create your first status condition to reference in your sheets, or
            import a status compendium file.
          </p>
          <div className="empty-state__actions">
            <button
              className="btn btn--primary page-head__btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <ArrowDownFromLine size={14} />
              Import Statuses
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              Create New Status
            </button>
          </div>
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

      {pendingCompendium && (
        <ConfirmModal
          title="Import Status Compendium?"
          message={
            <span>
              Importing <strong>{pendingCompendium.length}</strong> status
              {pendingCompendium.length === 1 ? '' : 'es'} will{' '}
              <strong>replace your entire compendium</strong> (currently{' '}
              {statuses.length}). Sheets that reference statuses not in the file
              will show the name as plain text. This can’t be undone.
            </span>
          }
          confirmLabel="Replace Compendium"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => {
            const incoming = pendingCompendium
            setPendingCompendium(null)
            void replaceStatuses(incoming)
              .then(() =>
                notify(
                  `✓ Imported ${incoming.length} status${incoming.length === 1 ? '' : 'es'}.`,
                  'success',
                ),
              )
              .catch(() =>
                notify(
                  'Import failed — your compendium was left unchanged.',
                  'error',
                ),
              )
          }}
          onClose={() => setPendingCompendium(null)}
        />
      )}
    </div>
  )
}
