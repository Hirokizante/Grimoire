/**
 * AbilityBlockList — the editable ability grid, with drag and drop wired in.
 *
 * Slotted Abilities, the Ability Pool, a custom tab's ability sections and an
 * NPC's ability list all show the same editable surface: a `SortableContext` of
 * {@link SortableAbilityCard}s in a `.ability-grid` and a droppable empty state
 * when the list is empty. Sharing the markup is what keeps the four surfaces
 * from drifting apart — a change to how a drop is previewed lands on all of them
 * at once.
 *
 * **The drop preview is computed here, from the resolved drop index.** While a
 * card is in the air this list looks up where each card would sit (see
 * `previewOffsets`) and hands each one its translation, and it draws the drop
 * line across the slot the card will land in (see `dropLineTarget`). Both come
 * off the same index the drop itself will use, so the list cannot show one
 * destination and take another. The slots both are measured against are captured
 * once per drag by {@link useAbilityCardSlots}, so the preview never feeds back
 * into itself.
 *
 * The line is drawn by the list rather than by the card it marks, and its
 * coordinates come from that measurement: an absolutely positioned box inside a
 * multi-column item is positioned against the column box instead of the item by
 * Chromium, so a line hung inside the card landed in the wrong column whenever
 * the card was not the first one. The list's own box is a plain containing
 * block, so the line goes exactly where the slot is.
 *
 * View mode is deliberately *not* this component's job: a read-only card is an
 * {@link AbilityActivation}, which carries an Activate button and a resource
 * plan that a drag surface has no business owning. Sections switch between the
 * two on their own.
 *
 * The list is layout-agnostic: `layout` only decides the axis a drop is measured
 * along (see {@link dropAxisForLayout}); the preview is the same in both,
 * because both flow cards down a column.
 */

import { useCallback, useMemo, useRef } from 'react'
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable'

import SortableAbilityCard from '@/components/sheet/SortableAbilityCard'
import {
  useAbilityDropHint,
  useAbilityDropRegistry,
} from '@/components/sheet/AbilityDropHintContext'
import { useAbilityCardSlots } from '@/hooks/useAbilityCardSlots'
import { dropLineTarget, previewOffsets } from '@/lib/abilityDropTarget'
import type { AbilityBlock, Character } from '@/types'

/**
 * dnd-kit's own sorting transform is switched off on purpose. It resolves the
 * destination from the hovered card alone — one slot away from the pointer-side
 * rule the drop uses — and it **scales** each card to the box it moves onto,
 * which squashes and stretches the cards sliding past whenever they are not all
 * the same height. The translation is drawn from the resolved drop index
 * instead; what is left of a card's `transform` is the one-frame layout-change
 * transform dnd-kit applies after a drop, which still settles the list into its
 * new order.
 */
const NO_SORT_TRANSFORM: SortingStrategy = () => null

export interface AbilityBlockListProps {
  /** The list's id — the same id its drag context and drop resolver use. */
  section: string
  abilities: AbilityBlock[]
  layout: 'cards' | 'list'
  /** Droppable registration for the wrapping element. */
  droppableRef: (node: HTMLElement | null) => void
  /** True while a dragged card is over this list. */
  isOver: boolean
  /** Entity the cards belong to (an NPC attached to a player sheet's tab). */
  character?: Character
  /**
   * Persist the modifier switch / manual use adjustment for an ability that
   * does not live on the store's current character (a GM Screen NPC panel, an
   * NPC attached to a player sheet's tab). Omitted where the store is the
   * writer.
   */
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  onSetUses?: (abilityId: string, remaining: number) => void
  /** Per-card edit actions, rendered in the card footer. */
  actions?: (ability: AbilityBlock) => React.ReactNode
  subAbilityActions?: (sub: AbilityBlock, parent: AbilityBlock) => React.ReactNode
  activateOverride?: React.ComponentProps<
    typeof SortableAbilityCard
  >['activateOverride']
  /**
   * Cards that belong to the section but never to its **order** — an NPC's
   * Basic Attack, which is fixed: editable, never removable, never dragged.
   *
   * They render inside the same grid, ahead of the sortable cards, so the
   * masonry columns (or the list's full width) lay them out with the rest. They
   * are deliberately outside the `SortableContext` and carry none of a sortable
   * card's markers, which is what keeps them out of the drop maths: the slots a
   * drag measures are `:scope > .sortable-ability[data-ability-id]`, so a
   * pinned card is neither a slot a drop can land in nor a card one can move.
   */
  pinnedCards?: React.ReactNode
  /** Shown in place of the grid while the list is empty. */
  emptyMessage: React.ReactNode
}

export default function AbilityBlockList({
  section,
  abilities,
  layout,
  droppableRef,
  isOver,
  character,
  onToggleModifiers,
  onSetUses,
  actions,
  subAbilityActions,
  activateOverride,
  pinnedCards,
  emptyMessage,
}: AbilityBlockListProps) {
  const hint = useAbilityDropHint(section)
  const isDragging = useAbilityDropRegistry()?.isDragging ?? false

  // The element is both this list's drop target and the box its card slots are
  // measured from, so one ref serves both.
  const containerRef = useRef<HTMLDivElement | null>(null)
  const attachContainer = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      droppableRef(node)
    },
    [droppableRef],
  )
  const slots = useAbilityCardSlots(containerRef, isDragging)

  const isListView = layout === 'list'
  const overClasses = isOver ? ' ability-dropzone--over' : ''
  const activeId = hint?.activeId ?? null
  const gapIndex = hint?.index ?? 0

  // Where every card would sit if the card in the air were released right now,
  // and which slot the line marks for that destination. Both are read off the
  // one index the drop action will use.
  const offsets = useMemo(
    () => previewOffsets({ items: abilities, slots, activeId, gapIndex }),
    [abilities, slots, activeId, gapIndex],
  )
  const lineTarget = useMemo(
    () => (hint ? dropLineTarget(abilities, activeId, hint.index) : null),
    [abilities, activeId, hint],
  )
  // The slot the line is drawn on. It is `undefined` until the list has been
  // measured, and the line simply is not drawn rather than drawn somewhere
  // guessed.
  const lineSlot = lineTarget ? slots?.get(lineTarget.id) : undefined

  // A list with nothing to show at all is the bare drop zone: no grid, no
  // cards. A pinned card counts as something to show, so the grid is drawn and
  // the empty message rides along inside it (see below).
  if (abilities.length === 0 && !pinnedCards) {
    return (
      <div
        ref={attachContainer}
        className={'ability-dropzone ability-dropzone--empty' + overClasses}
      >
        <p className="sheet-section__empty muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div
      ref={attachContainer}
      className={
        (isListView
          ? 'ability-grid ability-grid--list'
          : 'ability-grid ability-grid--cards') + overClasses
      }
    >
      {/* Fixed cards first — they are part of the list's layout but not of its
          order (see `pinnedCards`). */}
      {pinnedCards}

      <SortableContext
        items={abilities.map((a) => a.id)}
        strategy={NO_SORT_TRANSFORM}
      >
        {abilities.map((ability) => (
          <SortableAbilityCard
            key={ability.id}
            ability={ability}
            section={section}
            mode="edit"
            character={character}
            previewOffset={offsets.get(ability.id)}
            onToggleModifiers={onToggleModifiers}
            onSetUses={onSetUses}
            subAbilityActions={subAbilityActions}
            activateOverride={activateOverride}
            actions={actions?.(ability)}
          />
        ))}
      </SortableContext>

      {/* Nothing sortable yet, but a pinned card is on screen: the list still
          says how to put an ability in it. */}
      {abilities.length === 0 && (
        <div className="ability-dropzone ability-dropzone--empty">
          <p className="sheet-section__empty muted">{emptyMessage}</p>
        </div>
      )}

      {/* Where the card in the air will land: a bar across the leading edge of
          the slot it takes — or its trailing edge, for the one gap with no card
          in front of it. Drawn on the slot's own box, so it cannot drift from
          the translation the preview gave that slot. */}
      {hint && lineTarget && lineSlot && (
        <span
          className="ability-drop-slot"
          style={{
            transform: `translate(${lineSlot.left}px, ${lineSlot.top}px)`,
            width: lineSlot.width,
            height: lineSlot.height,
          }}
          data-drop-target={lineTarget.id}
          data-drop-edge={lineTarget.edge}
          aria-hidden="true"
        >
          <span
            className={
              'ability-drop-indicator' +
              (lineTarget.edge === 'after' ? ' ability-drop-indicator--after' : '') +
              (hint.valid ? '' : ' ability-drop-indicator--invalid')
            }
          >
            <span className="ability-drop-indicator__cap" />
          </span>
        </span>
      )}
    </div>
  )
}
