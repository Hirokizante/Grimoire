/**
 * NPCListPage — the NPC gallery list page.
 *
 * Mirrors CharacterListPage's structure but filters for NPC records
 * (kind === 'npc'). Supports grid/list view, create, import, and delete.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowDownFromLine, LayoutGrid, List, Plus } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import {
  matchesFacet,
  useListPrefsStore,
  type ListPageId,
  type ListSortKey,
} from '@/store/listPrefsStore'
import CreateCharacterModal from '@/components/sheet/CreateCharacterModal'
import ConfirmDeleteModal from '@/components/sheet/ConfirmDeleteModal'
import UpdateCharacterModal from '@/components/sheet/UpdateCharacterModal'
import SheetLabelPills from '@/components/sheet/SheetLabelPills'
import FilterDropdown, { type FilterGroup } from '@/components/ui/FilterDropdown'
import SortDropdown, { type SortOption } from '@/components/ui/SortDropdown'

import { parseCharacterJSON } from '@/lib/exportImport'
import type { Character } from '@/types'

type ViewMode = 'grid' | 'list'

const SORT_OPTIONS: SortOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Date created' },
  { value: 'modified', label: 'Date modified' },
]

/** Format an ISO timestamp into a short, human-readable label. */
function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Parse imported JSON once to check for conflicts before acting on it. */
function parseImport(text: string): Character {
  return parseCharacterJSON(text)
}

export default function NPCListPage() {
  const characters = useCharacterStore((s) => s.characters)
  const isLoaded = useCharacterStore((s) => s.isLoaded)
  const isSaving = useCharacterStore((s) => s.isSaving)
  const selectCharacter = useCharacterStore((s) => s.selectCharacter)
  const importNPCFile = useCharacterStore((s) => s.importNPCFile)
  const updateExistingNPCFromImportFile = useCharacterStore(
    (s) => s.updateExistingNPCFromImportFile,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  /** Sort + filter prefs live in listPrefsStore (persisted to localStorage). */
  const sortKey = useListPrefsStore((s) => s.npcSortKey)
  const setSortKey = useListPrefsStore((s) => s.setNpcSortKey)
  const filterSelection = useListPrefsStore((s) => s.npcFilters)
  const toggleFilterPref = useListPrefsStore((s) => s.toggleFilter)
  const clearFilterPrefs = useListPrefsStore((s) => s.clearFilters)
  const PAGE_ID: ListPageId = 'npcs'
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [npcToDelete, setNpcToDelete] = useState<Character | null>(null)
  /** Pending import JSON file that has a matching NPC by name. */
  const [pendingImport, setPendingImport] = useState<{
    existing: Character
    imported: Character
    rawText: string
  } | null>(null)

  /** Filter to only NPC records. */
  const npcs = characters.filter((c) => c.kind === 'npc')

  /** Handle file import with conflict detection for existing NPCs. */
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const isJson =
        file.type.startsWith('application/json') ||
        file.type.startsWith('text/') ||
        file.name.endsWith('.json')
      if (!isJson) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        try {
          const imported = parseImport(reader.result)
          const existing = npcs.find(
            (c) => c.name.toLowerCase() === imported.name.toLowerCase(),
          )
          if (existing) {
            setPendingImport({ existing, imported, rawText: reader.result })
          } else {
            void importNPCFile(reader.result)
          }
        } catch {
          // Invalid JSON or shape — ignore silently.
        }
      }
      reader.readAsText(file)
    },
    [npcs, importNPCFile],
  )

  /** Auto-detect all unique labels across all NPC sheets. */
  const filterGroups = useMemo<FilterGroup[]>(() => {
    const labelMap = new Map<string, string>()
    for (const c of npcs) {
      for (const lbl of c.labels) {
        const name = lbl.name.trim()
        if (!name) continue
        const key = name.toLowerCase()
        if (!labelMap.has(key)) labelMap.set(key, name)
      }
    }
    const labelOptions = Array.from(labelMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ label, value }))
    return [{ id: 'label', title: 'Labels', options: labelOptions }]
  }, [npcs])

  /** Apply active filters to the NPC list. */
  const filteredNpcs = useMemo(() => {
    const labelSel = filterSelection.label ?? {}
    if (Object.keys(labelSel).length === 0) return npcs
    return npcs.filter((c) => {
      const charLabels = new Set(
        c.labels.map((l) => l.name.trim().toLowerCase()),
      )
      return matchesFacet(labelSel, (value) =>
        charLabels.has(value.toLowerCase()),
      )
    })
  }, [npcs, filterSelection])

  function handleFilterToggle(groupId: string, value: string) {
    toggleFilterPref(PAGE_ID, groupId, value)
  }

  function handleFilterClear() {
    clearFilterPrefs(PAGE_ID)
  }

  /** Sort the filtered NPCs by the selected key. */
  const sortedNpcs = useMemo(() => {
    const list = [...filteredNpcs]
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
  }, [filteredNpcs, sortKey])

  if (!isLoaded) {
    return (
      <div className="page">
        <p className="muted">Loading NPCs…</p>
      </div>
    )
  }

  if (npcs.length === 0) {
    return (
      <div className="page page--empty">
        <div className="empty-state">
          <h2 className="empty-title">No NPCs yet</h2>
          <p className="muted">
            Create your first NPC to use as a static reference.
          </p>
          <div className="empty-state__actions">
            <button
              className="btn btn--primary page-head__btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <ArrowDownFromLine size={14} />
              Import NPC
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => setShowCreateModal(true)}
            >
              Create New NPC
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={handleImport}
          />
          {showCreateModal && (
            <CreateCharacterModal
              onCreate={(name) => {
                void useCharacterStore.getState().createNPC(name)
                setShowCreateModal(false)
              }}
              onClose={() => setShowCreateModal(false)}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <span className="page-count">
          {sortedNpcs.length} NPC{sortedNpcs.length === 1 ? '' : 's'}
        </span>
        {isSaving && <span className="muted saving-badge">saving…</span>}
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
            label="Sort NPCs"
          />
          <div
            className="mode-toggle mode-toggle--compact"
            role="tablist"
            aria-label="NPC list view"
          >
            <button
              className={
                'mode-toggle__btn' +
                (viewMode === 'grid' ? ' mode-toggle__btn--active' : '')
              }
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid'}
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={
                'mode-toggle__btn' +
                (viewMode === 'list' ? ' mode-toggle__btn--active' : '')
              }
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </button>
          </div>
          <button
            className="btn btn--primary page-head__btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <ArrowDownFromLine size={14} />
            <span className="page-head__btn-label">Import</span>
          </button>
          <button
            className="btn btn--primary page-head__btn"
            type="button"
            onClick={() => setShowCreateModal(true)}
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
        onChange={handleImport}
      />

      {viewMode === 'grid' ? (
        <ul className="card-grid" role="list">
          {sortedNpcs.map((c) => (
            <li key={c.id} className="card">
              <button
                className="card-main"
                type="button"
                onClick={() => selectCharacter(c.id)}
              >
                {c.portrait ? (
                  <img
                    className="card-portrait"
                    src={c.portrait}
                    alt={c.name}
                  />
                ) : (
                  <div
                    className="card-portrait card-portrait--empty"
                    aria-hidden
                  />
                )}
                <span className="card-name">{c.name}</span>
                <span className="card-meta">
                  {c.npcStats?.hp ?? 0} HP ·{' '}
                  {formatUpdatedAt(c.updatedAt)}
                </span>
                <SheetLabelPills labels={c.labels} size="sm" />
              </button>
              <button
                className="card-delete"
                type="button"
                aria-label={`Delete ${c.name}`}
                onClick={() => setNpcToDelete(c)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="character-list" role="list">
          {sortedNpcs.map((c) => (
            <li key={c.id} className="character-list__item">
              <button
                className="character-list__main"
                type="button"
                onClick={() => selectCharacter(c.id)}
              >
                {c.portrait ? (
                  <img
                    className="character-list__portrait"
                    src={c.portrait}
                    alt={c.name}
                  />
                ) : (
                  <div
                    className="character-list__portrait character-list__portrait--empty"
                    aria-hidden
                  />
                )}
                <div className="character-list__info">
                  <span className="character-list__name">{c.name}</span>
                  <span className="character-list__meta">
                    {c.npcStats?.hp ?? 0} HP ·{' '}
                    {formatUpdatedAt(c.updatedAt)}
                  </span>
                  <SheetLabelPills labels={c.labels} size="sm" />
                </div>
              </button>
              <button
                className="character-list__delete"
                type="button"
                aria-label={`Delete ${c.name}`}
                onClick={() => setNpcToDelete(c)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreateModal && (
        <CreateCharacterModal
          onCreate={(name) => {
            void useCharacterStore.getState().createNPC(name)
            setShowCreateModal(false)
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {npcToDelete && (
        <ConfirmDeleteModal
          itemName={npcToDelete.name}
          onConfirm={() => {
            void useCharacterStore.getState().deleteCharacter(npcToDelete.id)
            setNpcToDelete(null)
          }}
          onClose={() => setNpcToDelete(null)}
        />
      )}

      {pendingImport && (
        <UpdateCharacterModal
          characterName={pendingImport.existing.name}
          existingVersion={pendingImport.existing.version}
          importedVersion={pendingImport.imported.version}
          onUpdate={() => {
            void updateExistingNPCFromImportFile(
              pendingImport.existing,
              pendingImport.rawText,
            )
            setPendingImport(null)
          }}
          onImportAsNew={() => {
            void importNPCFile(pendingImport.rawText)
            setPendingImport(null)
          }}
          onClose={() => setPendingImport(null)}
        />
      )}
    </div>
  )
}
