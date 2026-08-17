/**
 * StatusReference — an inline, clickable status-condition pill.
 *
 * Rendered inside ability descriptions where a `[StatusName]` reference matches
 * a known status. Clicking opens the global status detail/edit modal; hovering
 * shows a small card with the status's icon, name, and description for quick
 * reference.
 */

import { useStatusStore } from '@/store/statusStore'
import StatusIcon from '@/components/status/StatusIcon'
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

      <span className="status-ref__tooltip" role="tooltip">
        <StatusIcon
          icon={status.icon || '§'}
          iconType={status.icon ? status.iconType : 'emoji'}
          size={18}
        />
        <span className="status-ref__tooltip-body">
          <strong className="status-ref__tooltip-name">
            {status.name || 'Status'}
          </strong>
          {status.description && (
            <span className="status-ref__tooltip-desc">
              {status.description}
            </span>
          )}
        </span>
      </span>
    </span>
  )
}
