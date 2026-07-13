import { useRef } from 'react'
import { ArrowDownFromLine } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'

import type { Character } from '@/types'

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

function handleCreate() {
  const name = window.prompt('Character name?')?.trim()
  if (!name) return
  void useCharacterStore.getState().createCharacter(name)
}

function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
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
    if (typeof reader.result === 'string') {
      void useCharacterStore.getState().importCharacterFile(reader.result)
    }
  }
  reader.readAsText(file)
}

function handleDelete(character: Character) {
  const confirmed = window.confirm(
    `Delete "${character.name}"? This cannot be undone.`,
  )
  if (!confirmed) return
  void useCharacterStore.getState().deleteCharacter(character.id)
}

export default function CharacterListPage() {
  const characters = useCharacterStore((s) => s.characters)
  const isLoaded = useCharacterStore((s) => s.isLoaded)
  const isSaving = useCharacterStore((s) => s.isSaving)
  const selectCharacter = useCharacterStore((s) => s.selectCharacter)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
              onClick={handleCreate}
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
            onClick={handleCreate}
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

      <ul className="card-grid" role="list">
        {characters.map((c) => (
          <li key={c.id} className="card">
            <button
              className="card-main"
              type="button"
              onClick={() => selectCharacter(c.id)}
            >
              {c.portrait ? (
                <img className="card-portrait" src={c.portrait} alt={c.name} />
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
              onClick={() => handleDelete(c)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
