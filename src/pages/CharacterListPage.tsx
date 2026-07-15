import { useCallback, useRef, useState } from 'react'
import { ArrowDownFromLine, LayoutGrid, List } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import CreateCharacterModal from '@/components/sheet/CreateCharacterModal'
import ConfirmDeleteModal from '@/components/sheet/ConfirmDeleteModal'
import UpdateCharacterModal from '@/components/sheet/UpdateCharacterModal'

import { parseCharacterJSON } from '@/lib/exportImport'
import type { Character } from '@/types'

type ViewMode = 'grid' | 'list'

/** Format an ISO timestamp into a short, human-readable relative-ish label. */
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

export default function CharacterListPage() {
  const characters = useCharacterStore((s) => s.characters)
  const isLoaded = useCharacterStore((s) => s.isLoaded)
  const isSaving = useCharacterStore((s) => s.isSaving)
  const selectCharacter = useCharacterStore((s) => s.selectCharacter)
  const importCharacterFile = useCharacterStore((s) => s.importCharacterFile)
  const updateExistingCharacterFromImportFile = useCharacterStore(
    (s) => s.updateExistingCharacterFromImportFile,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null)
  /** Pending import JSON file that has a matching character by name. */
  const [pendingImport, setPendingImport] = useState<{
    existing: Character
    imported: Character
    rawText: string
  } | null>(null)

  /** Handle file import with conflict detection for existing characters. */
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Reset so re-selecting the same file still fires change.
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
          const existing = characters.find(
            (c) => c.name.toLowerCase() === imported.name.toLowerCase(),
          )
          if (existing) {
            setPendingImport({ existing, imported, rawText: reader.result })
          } else {
            void importCharacterFile(reader.result)
          }
        } catch {
          // Invalid JSON or shape — ignore silently (no toast yet).
        }
      }
      reader.readAsText(file)
    },
    [characters, importCharacterFile],
  )

  if (!isLoaded) {
    return (
      <div className="page">
        <p className="muted">Loading characters…</p>
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="page page--empty">
        <div className="empty-state">
          <h2 className="empty-title">No characters yet</h2>
          <p className="muted">
            Create your first Divergence character to begin.
          </p>
          <div className="empty-state__actions">
            <button
              className="btn btn--primary page-head__btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <ArrowDownFromLine size={14} />
              Import Character
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => setShowCreateModal(true)}
            >
              Create New Character
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
                void useCharacterStore.getState().createCharacter(name)
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
          {characters.length} character{characters.length === 1 ? '' : 's'}
        </span>
        {isSaving && <span className="muted saving-badge">saving…</span>}
        <div className="page-head__actions">
          <div
            className="mode-toggle mode-toggle--compact"
            role="tablist"
            aria-label="Character list view"
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
            Import
          </button>
          <button
            className="btn btn--primary page-head__btn"
            type="button"
            onClick={() => setShowCreateModal(true)}
          >
            + New
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
          {characters.map((c) => (
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
                  {c.milestones}{' '}
                  {c.milestones === 1 ? 'milestone' : 'milestones'} ·{' '}
                  {formatUpdatedAt(c.updatedAt)}
                </span>
              </button>
              <button
                className="card-delete"
                type="button"
                aria-label={`Delete ${c.name}`}
                onClick={() => setCharacterToDelete(c)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="character-list" role="list">
          {characters.map((c) => (
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
                    {c.milestones}{' '}
                    {c.milestones === 1 ? 'milestone' : 'milestones'} ·{' '}
                    {formatUpdatedAt(c.updatedAt)}
                  </span>
                </div>
              </button>
              <button
                className="character-list__delete"
                type="button"
                aria-label={`Delete ${c.name}`}
                onClick={() => setCharacterToDelete(c)}
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
            void useCharacterStore.getState().createCharacter(name)
            setShowCreateModal(false)
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {characterToDelete && (
        <ConfirmDeleteModal
          itemName={characterToDelete.name}
          onConfirm={() => {
            void useCharacterStore.getState().deleteCharacter(characterToDelete.id)
            setCharacterToDelete(null)
          }}
          onClose={() => setCharacterToDelete(null)}
        />
      )}

      {pendingImport && (
        <UpdateCharacterModal
          characterName={pendingImport.existing.name}
          existingVersion={pendingImport.existing.version}
          importedVersion={pendingImport.imported.version}
          onUpdate={() => {
            void updateExistingCharacterFromImportFile(
              pendingImport.existing,
              pendingImport.rawText,
            )
            setPendingImport(null)
          }}
          onImportAsNew={() => {
            void importCharacterFile(pendingImport.rawText)
            setPendingImport(null)
          }}
          onClose={() => setPendingImport(null)}
        />
      )}
    </div>
  )
}
