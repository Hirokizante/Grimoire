/**
 * SortablePanel — the dnd-kit sortable shell wrapped around every GM Screen
 * panel.
 *
 * Only the frameless grip handle starts a drag (a `PointerSensor` with a 6px
 * activation distance), so HP steppers, the damage button, and the panel menu
 * inside each panel stay clickable and touch-scrolling is never hijacked.
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from '@/components/ui/icons'

import type { ScreenPanel } from '@/types'

export interface SortablePanelProps {
  panel: ScreenPanel
  /** Name used for the drag handle's accessible label. */
  displayName: string
  children: React.ReactNode
}

export default function SortablePanel({
  panel,
  displayName,
  children,
}: SortablePanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: panel.id, data: { kind: panel.kind } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={'gm-panel-wrap' + (isDragging ? ' gm-panel-wrap--dragging' : '')}
      data-panel-kind={panel.kind}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="btn btn--icon gm-panel__drag"
        aria-label={`Reorder ${displayName}`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} strokeWidth={2.4} />
      </button>
      {children}
    </div>
  )
}
