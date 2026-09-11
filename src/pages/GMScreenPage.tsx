/**
 * GMScreenPage — the GM's multi-sheet live-play surface.
 *
 * A saved, named screen holds an ordered list of **panels**: live references
 * to player characters and instances spawned from NPC base records. The GM
 * runs several sheets at once here — damage applied to a player panel is the
 * same state that player sees on their own sheet, while NPC instances keep
 * independent HP shared from a common base.
 *
 * This page is **app chrome**: it uses the active app theme (like the list
 * pages) and injects each panel entity's own `colorVars()` inside the panel,
 * so player sheets keep their customization while the surrounding page does
 * not.
 *
 * See `.hermes/GM_SCREEN_DESIGN.md` for the full spec.
 */

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  CircleSlash,
  LayoutDashboard,
  Pencil,
  Plus,
  Swords,
  Trash2,
  Users,
} from 'lucide-react'

import ConfirmModal from '@/components/sheet/ConfirmModal'
import AddCharacterModal from '@/components/gmscreen/AddCharacterModal'
import AddNpcModal from '@/components/gmscreen/AddNpcModal'
import SortablePanel from '@/components/gmscreen/SortablePanel'
import CharacterPanel from '@/components/gmscreen/CharacterPanel'
import NpcInstancePanel from '@/components/gmscreen/NpcInstancePanel'
import MissingPanel from '@/components/gmscreen/MissingPanel'

import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useNotification } from '@/context/NotificationContext'
import { distributeIntoColumns, resolvePanels } from '@/lib/gmScreenUtils'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import '@/components/gmscreen/gmscreen.css'

export default function GMScreenPage() {
  const screens = useGMScreenStore((s) => s.screens)
  const currentScreenId = useGMScreenStore((s) => s.currentScreenId)
  const isLoaded = useGMScreenStore((s) => s.isLoaded)
  const isSaving = useGMScreenStore((s) => s.isSaving)
  const loadError = useGMScreenStore((s) => s.loadError)
  const loadScreens = useGMScreenStore((s) => s.loadScreens)
  const selectScreen = useGMScreenStore((s) => s.selectScreen)
  const createScreen = useGMScreenStore((s) => s.createScreen)
  const renameScreen = useGMScreenStore((s) => s.renameScreen)
  const deleteScreen = useGMScreenStore((s) => s.deleteScreen)
  const movePanel = useGMScreenStore((s) => s.movePanel)
  const removePanel = useGMScreenStore((s) => s.removePanel)
  const selectCharacter = useCharacterStore((s) => s.selectCharacter)
  const characters = useCharacterStore((s) => s.characters)
  const { notify } = useNotification()

  const [showAddCharacter, setShowAddCharacter] = useState(false)
  const [showAddNpc, setShowAddNpc] = useState(false)
  const [renaming, setRenaming] = useState(false)
  /** Local draft for the inline rename — committed on blur/submit so typing
   *  does not write to the store (and re-render the whole canvas) per keystroke. */
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmDeleteScreen, setConfirmDeleteScreen] = useState(false)
  const [confirmCreateScreen, setConfirmCreateScreen] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  // Column count follows the responsive breakpoints (2 / 1). Two wide columns
  // beat three narrow ones: at three, panels were ~320px and every sheet name
  // truncated.
  const isPhone = useMediaQuery('(max-width: 700px)')
  const columnCount = isPhone ? 1 : 2

  const screen = screens.find((s) => s.id === currentScreenId) ?? null
  // Empty array when no screen is open, so every consumer can treat `panels`
  // as a list. Array#findIndex/map take a callback, so `undefined` here would
  // silently no-op rather than throw — populate it explicitly instead.
  const panels = screen ? screen.panels : []
  const resolved = useMemo(
    () => resolvePanels(panels, characters),
    [panels, characters],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || !screen) return
    const fromIndex = panels.findIndex((p) => p.id === active.id)
    const toIndex = panels.findIndex((p) => p.id === over.id)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    movePanel(screen.id, fromIndex, toIndex)
  }

  /** Open a player character's normal sheet page (same live state). */
  const openCharacterSheet = (characterId: string) => {
    selectCharacter(characterId)
  }

  const handleCreateScreen = async () => {
    try {
      await createScreen(newScreenName)
    } catch {
      // The store already recorded `loadError`; the page renders it with a
      // retry. Swallow here so the click handler never rejects unhandled.
      return
    }
    setNewScreenName('')
    setConfirmCreateScreen(false)
  }

  if (!isLoaded) {
    return (
      <div className="page">
        <p className="muted">Loading GM screens…</p>
      </div>
    )
  }

  // Storage failed rather than merely being slow. Show the reason and a way
  // out instead of an endless "Loading…".
  if (loadError) {
    return (
      <div className="page gm-screen">
        <div className="gm-screen__title-row">
          <h2 className="gm-screen__title" id="gm-screen-heading">
            GM Screen
          </h2>
        </div>
        <div className="empty-state gm-screen__empty" role="alert">
          <CircleSlash size={40} className="gm-screen__empty-icon" aria-hidden="true" />
          <h3 className="empty-title">Couldn’t load your GM screens</h3>
          <p className="muted">{loadError}</p>
          <p className="muted gm-screen__hint">
            Your characters, NPCs, and screens are stored in this browser only —
            nothing has been changed or deleted.
          </p>
          <div className="empty-state__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void loadScreens()}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const activePanel = panels.find((p) => p.id === activeId) ?? null

  return (
    <div className="page gm-screen">
      <div className="gm-screen__head">
        <div className="gm-screen__title-row">
          <h2 className="gm-screen__title" id="gm-screen-heading">
            GM Screen
          </h2>
          {/* Save indicator. It sits between the title and the right-aligned
              actions, so as a normally-flowed element it resized the row and
              shoved every screen pill ~57px sideways on every save — and saves
              fire on every panel action, so the name jumped constantly.
              The slot below therefore reserves the badge's own measured width
              permanently and only toggles `visibility`; overlaying it instead
              just made it collide with the switcher. */}
          <span
            className={
              'muted saving-badge gm-screen__saving' +
              (isSaving ? ' gm-screen__saving--active' : '')
            }
            role="status"
            aria-live="polite"
            aria-hidden={!isSaving}
          >
            saving…
          </span>
        </div>

        {screens.length > 0 && (
          <div className="gm-screen__switcher" role="tablist" aria-label="Saved GM screens">
            {screens.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === currentScreenId}
                className={
                  'gm-screen__screen-pill' +
                  (s.id === currentScreenId ? ' gm-screen__screen-pill--active' : '')
                }
                onClick={() => selectScreen(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="gm-screen__actions">
          {screen && !renaming && (
            <button
              type="button"
              className="btn btn--icon gm-screen__rename"
              onClick={() => {
                setRenameDraft(screen.name)
                setRenaming(true)
              }}
              aria-label={`Rename ${screen.name}`}
              title="Rename screen"
            >
              <Pencil size={14} />
            </button>
          )}
          {screen && renaming && (
            <form
              className="gm-screen__rename-form"
              onSubmit={(e) => {
                e.preventDefault()
                renameScreen(screen.id, renameDraft)
                setRenaming(false)
              }}
            >
              <input
                className="sheet-input gm-screen__rename-input"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => {
                  renameScreen(screen.id, renameDraft)
                  setRenaming(false)
                }}
                aria-label="Screen name"
                autoFocus
              />
            </form>
          )}
          <button
            type="button"
            className="btn btn--primary page-head__btn"
            onClick={() => setConfirmCreateScreen(true)}
          >
            <Plus size={14} />
            <span className="page-head__btn-label">New Screen</span>
          </button>
          {screen && (
            <button
              type="button"
              className="btn btn--ghost page-head__btn"
              onClick={() => setConfirmDeleteScreen(true)}
            >
              <Trash2 size={14} />
              <span className="page-head__btn-label">Delete</span>
            </button>
          )}
        </div>
      </div>

      {!screen ? (
        <div className="empty-state gm-screen__empty">
          <LayoutDashboard size={40} className="gm-screen__empty-icon" aria-hidden="true" />
          <h3 className="empty-title">No GM screen yet</h3>
          <p className="muted">
            Create a screen to run your player sheets and NPC spawns side by side.
          </p>
          <div className="empty-state__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setConfirmCreateScreen(true)}
            >
              <Plus size={14} />
              New Screen
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="gm-screen__toolbar">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowAddCharacter(true)}
            >
              <Users size={14} />
              Add Character
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowAddNpc(true)}
            >
              <Swords size={14} />
              Add NPC
            </button>
          </div>

          {panels.length === 0 ? (
            <div className="empty-state gm-screen__empty">
              <p className="muted">
                This screen is empty — add a player character or spawn an NPC to begin.
              </p>
              <div className="empty-state__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setShowAddCharacter(true)}
                >
                  <Users size={14} />
                  Add Character
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowAddNpc(true)}
                >
                  <Swords size={14} />
                  Add NPC
                </button>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <SortableContext
                items={panels.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className={`gm-screen__columns gm-screen__columns--${columnCount}`}
                >
                  {distributeIntoColumns(resolved, columnCount).map((column, columnIndex) => (
                    <div className="gm-screen__column" key={columnIndex}>
                      {column.map((entry) => (
                        <SortablePanel
                          key={entry.panel.id}
                          panel={entry.panel}
                          displayName={entry.displayName}
                        >
                          {/* `missing` means the referenced record is gone, so
                              the entity is null by construction. */}
                          {entry.missing || !entry.entity ? (
                            <MissingPanel
                              kind={entry.panel.kind}
                              onRemove={() => removePanel(screen.id, entry.panel.id)}
                            />
                          ) : entry.panel.kind === 'character' ? (
                            <CharacterPanel
                              panel={entry.panel}
                              character={entry.entity}
                              screenId={screen.id}
                              onOpenSheet={() =>
                                openCharacterSheet(entry.entity!.id)
                              }
                              onRemove={() => removePanel(screen.id, entry.panel.id)}
                            />
                          ) : (
                            <NpcInstancePanel
                              panel={entry.panel}
                              base={entry.entity}
                              screenId={screen.id}
                              subtitle={entry.subtitle}
                              onOpenBase={() => openCharacterSheet(entry.entity!.id)}
                              onRemove={() => removePanel(screen.id, entry.panel.id)}
                            />
                          )}
                        </SortablePanel>
                      ))}
                    </div>
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activePanel ? (
                  <div className="gm-panel gm-panel--overlay">
                    <div className="gm-panel__header">
                      <span className="gm-panel__name">
                        {resolved.find((r) => r.panel.id === activePanel.id)?.displayName}
                      </span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {showAddCharacter && screen && (
        <AddCharacterModal
          screenId={screen.id}
          onClose={() => setShowAddCharacter(false)}
        />
      )}

      {showAddNpc && screen && (
        <AddNpcModal
          screenId={screen.id}
          onClose={() => setShowAddNpc(false)}
          onSpawned={(label) => notify(`Spawned ${label}.`, 'success')}
        />
      )}

      {confirmCreateScreen && (
        <ConfirmModal
          title="New GM screen"
          variant="info"
          confirmLabel="Create"
          message={
            <label className="gm-screen__field">
              <span className="gm-screen__field-label">Screen name</span>
              <input
                className="sheet-input"
                value={newScreenName}
                onChange={(e) => setNewScreenName(e.target.value)}
                placeholder="Session 4"
                autoFocus
              />
            </label>
          }
          onConfirm={() => void handleCreateScreen()}
          onClose={() => {
            setNewScreenName('')
            setConfirmCreateScreen(false)
          }}
        />
      )}

      {confirmDeleteScreen && screen && (
        <ConfirmModal
          title="Delete screen?"
          confirmLabel="Delete"
          variant="danger"
          message={
            <>
              Delete <strong>“{screen.name}”</strong>? The panels are removed with
              it, but no character or NPC record is deleted.
            </>
          }
          onConfirm={() => {
            void deleteScreen(screen.id)
            setConfirmDeleteScreen(false)
          }}
          onClose={() => setConfirmDeleteScreen(false)}
        />
      )}
    </div>
  )
}
