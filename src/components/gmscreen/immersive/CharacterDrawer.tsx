/**
 * CharacterDrawer — the immersive view's character list, sliding out from the
 * left edge of the screen.
 *
 * Every panel on the screen — player characters and spawned NPC instances —
 * appears here as a read-only quick-reference card ({@link DrawerCard}): the
 * glance data a GM runs from, with none of the controls. Selecting a card
 * mounts that character's encounter sheet in the main area.
 *
 * The drawer never fully collapses: toggling it shrinks it to a vertical
 * portrait rail so the main area can dominate while every character stays one
 * click away. The rail carries each NPC instance's number badge — the
 * instance's 1-based ordinal among the screen's instances of the same base,
 * shown only when that base has more than one instance on the screen, which is
 * exactly when three spawned Bandits need telling apart.
 *
 * Reordering drags the cards (grip on an expanded card, the portrait itself on
 * the rail) through the same dnd-kit sensors and `movePanel` action the grid
 * view uses, so both views describe one array order. The Add Character / Add
 * NPC actions live in the drawer footer — the drawer is where characters
 * enter the screen in this view — with a compact add button on the rail.
 */

import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight, Plus, Swords, Users } from '@/components/ui/icons'

import DrawerCard, { DrawerRailItem } from './DrawerCard'
import type { ResolvedPanel } from '@/lib/gmScreenUtils'

export interface CharacterDrawerProps {
  resolved: ResolvedPanel[]
  /** The panel id currently mounted in the main area. */
  selectedPanelId: string | null
  onSelectPanel: (panelId: string) => void
  onMovePanel: (fromIndex: number, toIndex: number) => void
  onRemovePanel: (panelId: string) => void
  onAddCharacter: () => void
  onAddNpc: () => void
}

/**
 * 1-based ordinals for NPC-instance panels whose base has **more than one**
 * instance on the screen — the rail's number badges and the cards' badge both
 * read from this. Unique instances (and player characters) get none.
 */
function computeInstanceNumbers(resolved: ResolvedPanel[]): Map<string, number> {
  const groups = new Map<string, string[]>()
  for (const entry of resolved) {
    if (entry.panel.kind === 'npc-instance') {
      const ids = groups.get(entry.panel.baseNpcId) ?? []
      ids.push(entry.panel.id)
      groups.set(entry.panel.baseNpcId, ids)
    }
  }
  const numbers = new Map<string, number>()
  for (const ids of groups.values()) {
    if (ids.length < 2) continue
    ids.forEach((id, index) => numbers.set(id, index + 1))
  }
  return numbers
}

export default function CharacterDrawer({
  resolved,
  selectedPanelId,
  onSelectPanel,
  onMovePanel,
  onRemovePanel,
  onAddCharacter,
  onAddNpc,
}: CharacterDrawerProps) {
  /** False = expanded (the entry state); true = shrunk to the portrait rail. */
  const [collapsed, setCollapsed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const instanceNumbers = useMemo(
    () => computeInstanceNumbers(resolved),
    [resolved],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const fromIndex = resolved.findIndex((r) => r.panel.id === active.id)
    const toIndex = resolved.findIndex((r) => r.panel.id === over.id)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    onMovePanel(fromIndex, toIndex)
  }

  return (
    <aside
      className={
        'gm-drawer' + (collapsed ? ' gm-drawer--collapsed' : ' gm-drawer--expanded')
      }
      aria-label="Character list"
    >
      <header className="gm-drawer__head">
        <button
          type="button"
          className="btn btn--icon gm-drawer__toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand character list' : 'Collapse character list'}
          title={collapsed ? 'Expand character list' : 'Collapse character list'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
        {!collapsed && (
          <span className="gm-drawer__title">Characters</span>
        )}
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={resolved.map((r) => r.panel.id)}
          strategy={verticalListSortingStrategy}
        >
          {collapsed ? (
            <nav className="gm-drawer__rail" aria-label="Characters">
              {resolved.map((entry) => (
                <DrawerRailItem
                  key={entry.panel.id}
                  entry={entry}
                  instanceNumber={instanceNumbers.get(entry.panel.id)}
                  selected={entry.panel.id === selectedPanelId}
                  onSelect={() => onSelectPanel(entry.panel.id)}
                />
              ))}
              <button
                type="button"
                className="btn btn--icon gm-drawer__rail-add"
                onClick={onAddCharacter}
                aria-label="Add character or NPC"
                title="Add character or NPC"
              >
                <Plus size={15} />
              </button>
            </nav>
          ) : (
            <div className="gm-drawer__list">
              {resolved.length === 0 && (
                <p className="gm-drawer__empty muted">
                  This screen is empty — add a player character or spawn an NPC.
                </p>
              )}
              {resolved.map((entry) => (
                <DrawerCard
                  key={entry.panel.id}
                  entry={entry}
                  instanceNumber={instanceNumbers.get(entry.panel.id)}
                  selected={entry.panel.id === selectedPanelId}
                  onSelect={() => onSelectPanel(entry.panel.id)}
                  onRemove={() => onRemovePanel(entry.panel.id)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {!collapsed && (
        <footer className="gm-drawer__foot">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onAddCharacter}
          >
            <Users size={14} />
            Add Character
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onAddNpc}
          >
            <Swords size={14} />
            Add NPC
          </button>
        </footer>
      )}
    </aside>
  )
}
