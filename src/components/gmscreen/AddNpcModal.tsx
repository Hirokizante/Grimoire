/**
 * AddNpcModal — spawn NPC instances onto the GM screen from NPC base records.
 *
 * Every row spawns a fresh instance at full HP (labelled "Bandit", "Bandit 2",
 * …) and shows how many instances of that base are already on this screen.
 * The footer's "New NPC…" field creates a base record and immediately spawns
 * an instance of it in one step, without navigating away from the screen.
 *
 * Follows the modal conventions: header ✕ (dismiss) plus a footer Done.
 */

import { useMemo, useState } from 'react'
import { Plus, Search, Swords, X } from '@/components/ui/icons'

import { useModalDialog } from '@/hooks/useModalDialog'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useNotification } from '@/context/NotificationContext'

export interface AddNpcModalProps {
  screenId: string
  onClose: () => void
  /** Called after a successful spawn, with the new instance's label. */
  onSpawned?: (label: string) => void
}

export default function AddNpcModal({
  screenId,
  onClose,
  onSpawned,
}: AddNpcModalProps) {
  const characters = useCharacterStore((s) => s.characters)
  const screens = useGMScreenStore((s) => s.screens)
  const spawnInstance = useGMScreenStore((s) => s.addNpcInstancePanel)
  const createNpcBaseAndInstance = useGMScreenStore(
    (s) => s.createNpcBaseAndInstance,
  )
  const { notify } = useNotification()

  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const dialogRef = useModalDialog(onClose)

  const screen = screens.find((s) => s.id === screenId) ?? null

  /** How many instances of each base are already on this screen. */
  const instanceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const panel of screen?.panels ?? []) {
      if (panel.kind !== 'npc-instance') continue
      counts.set(panel.baseNpcId, (counts.get(panel.baseNpcId) ?? 0) + 1)
    }
    return counts
  }, [screen])

  const npcs = useMemo(() => {
    const list = characters.filter((c) => c.kind === 'npc')
    const q = query.trim().toLowerCase()
    const filtered = q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [characters, query])

  const spawn = (baseNpcId: string) => {
    const label = characters.find((c) => c.id === baseNpcId)?.name ?? 'NPC'
    spawnInstance(screenId, baseNpcId)
    onSpawned?.(label)
  }

  const handleQuickCreate = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const panelId = await createNpcBaseAndInstance(screenId, name)
      if (panelId) {
        notify(`Created ${name} and spawned an instance.`, 'success')
        setNewName('')
      } else {
        notify('Could not create that NPC.', 'error')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content gm-picker"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Add NPC instances to GM screen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Add NPC</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="gm-picker__body">
          <label className="gm-picker__search">
            <Search size={14} aria-hidden="true" />
            <input
              className="sheet-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search NPCs…"
              aria-label="Search NPCs"
            />
          </label>

          {npcs.length === 0 ? (
            <p className="muted gm-picker__empty">
              No NPCs yet — create one below, or from the NPCs page.
            </p>
          ) : (
            <ul className="gm-picker__list" role="list">
              {npcs.map((npc) => {
                const count = instanceCounts.get(npc.id) ?? 0
                return (
                  <li key={npc.id} className="gm-picker__row">
                    <button
                      type="button"
                      className="gm-picker__item"
                      onClick={() => spawn(npc.id)}
                    >
                      {npc.portrait ? (
                        <img className="gm-picker__portrait" src={npc.portrait} alt="" />
                      ) : (
                        <span className="gm-picker__portrait gm-picker__portrait--empty" aria-hidden="true" />
                      )}
                      <span className="gm-picker__info">
                        <span className="gm-picker__name">{npc.name}</span>
                        <span className="gm-picker__meta">
                          {npc.npcStats?.hp ?? 0} HP
                          {count > 0 && ` · ${count} on this screen`}
                        </span>
                      </span>
                      <span className="gm-picker__spawn">
                        <Plus size={14} /> Spawn
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <form
            className="gm-picker__create"
            onSubmit={(e) => {
              e.preventDefault()
              void handleQuickCreate()
            }}
          >
            <label className="gm-picker__create-label" htmlFor="gm-new-npc-name">
              New NPC…
            </label>
            <div className="gm-picker__create-row">
              <input
                id="gm-new-npc-name"
                className="sheet-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Bandit"
              />
              <button
                type="submit"
                className="btn btn--ghost"
                disabled={!newName.trim() || creating}
              >
                <Swords size={14} />
                {creating ? 'Creating…' : 'Create & spawn'}
              </button>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
