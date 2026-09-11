/**
 * StatusReference — an inline, clickable status-condition pill.
 *
 * Rendered inside ability descriptions where a `[StatusName]` reference matches
 * a known status. Clicking opens the global status detail/edit modal; hovering
 * shows a small card with the status's icon, name, and description for quick
 * reference (the GM Screen's panel pills show the same card — see
 * `StatusTooltip`).
 */

import { useStatusStore } from '@/store/statusStore'
import StatusIcon from '@/components/status/StatusIcon'
import { StatusTooltipCard } from '@/components/status/StatusTooltip'
import type { StatusCondition } from '@/types'

export interface StatusReferenceProps {
  status: StatusCondition
}

export default function StatusReference({ status }: StatusReferenceProps) {
  const openStatus = useStatusStore((s) => s.openStatus)

  return (
    <span className="status-ref">
      <button
        type="button"
        className="status-ref__btn"
        onClick={() => openStatus(status.id)}
        title={status.name}
      >
        {status.icon && (
          <StatusIcon icon={status.icon} iconType={status.iconType} size={14} />
        )}
        <span className="status-ref__name">{status.name || 'Status'}</span>
      </button>

      {/* Anchored by CSS (`.status-tooltip--inline`): the sheet's own text flow
        * has no clipping ancestor, so the card needs no portal here. */}
      <span
        className="status-tooltip status-tooltip--inline"
        role="tooltip"
      >
        <StatusTooltipCard status={status} />
      </span>
    </span>
  )
}
