/**
 * AddStatusModal — the compendium picker behind a panel's "Add Status" button.
 *
 * Lists every status condition in the compendium (searchable) and gives each
 * one the five SRD durations as chips. Picking a chip tracks the status on the
 * panel with that duration; picking a chip on a status already on the panel
 * **changes its duration in place**, which is why the chips double as the
 * duration editor rather than opening a second dialog. The current duration is
 * highlighted, so a tracked status is readable at a glance.
 *
 * The modal stays open after each pick — a GM usually applies two or three
 * conditions at once ("prone and poisoned") — and closes from the header ✕,
 * the footer Done, Escape, or the backdrop.
 *
 * It renders through a **portal to `document.body`**, like the panel pill's
 * hover card (`StatusTooltip`), and for the same reason the panel must not own
 * its overlays: the picker is opened from a panel, and a panel can carry a
 * dim — `.gm-panel--dead` dims to 0.75 — which `opacity` passes down to every
 * descendant AND turns the panel into the containing block for any
 * `position: fixed` inside it. An in-place picker therefore painted at 75%
 * over a backdrop sized to the panel's own box instead of the viewport: the
 * whole dialog read as translucent and its overlay never dimmed the page
 * behind it. Portalled, the dialog is a viewport overlay again, on the
 * documented layer for modals (z-index 2000, below the 3000 title bar), and no
 * panel state can reach it. `useModalDialog` is portal-safe: the focus trap
 * scopes itself to `.modal-overlay`, which travels with the dialog.
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'

import StatusIcon from '@/components/status/StatusIcon'
import { useModalDialog } from '@/hooks/useModalDialog'
import { STATUS_DURATIONS } from '@/constants/statusDurations'
import { plainTextFromMarkdown } from '@/lib/markdown'
import { statusDurationColor } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useStatusStore } from '@/store/statusStore'
import type { PanelStatus } from '@/types'

/** Stable empty list so the store selector never returns a fresh array. */
const NO_STATUSES: PanelStatus[] = []

export interface AddStatusModalProps {
  screenId: string
  panelId: string
  /** Display name used in the dialog title and labels ("Add status — Bandit"). */
  entityName: string
  onClose: () => void
}

export default function AddStatusModal({
  screenId,
  panelId,
  entityName,
  onClose,
}: AddStatusModalProps) {
  const statuses = useStatusStore((s) => s.statuses)
  const setPanelStatus = useGMScreenStore((s) => s.setPanelStatus)
  const appTheme = useAppThemeStore((s) => s.theme)
  const dialogRef = useModalDialog(onClose)
  const [query, setQuery] = useState('')

  // Read the panel's live tracking list so the chips reflect what is applied;
  // re-picking the same chip then reads as "already on the panel".
  const tracked = useGMScreenStore((s) => {
    const screen = s.screens.find((sc) => sc.id === screenId)
    return screen?.panels.find((p) => p.id === panelId)?.statuses ?? NO_STATUSES
  })
  const durationByStatusId = useMemo(
    () => new Map(tracked.map((t) => [t.statusId, t.duration])),
    [tracked],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? statuses.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q),
        )
      : statuses
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [statuses, query])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content gm-picker gm-status-picker"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Add status to ${entityName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Add Status — {entityName}</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
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
              placeholder="Search statuses…"
              aria-label="Search statuses"
              autoFocus
            />
          </label>

          <p className="gm-status-picker__hint">
            Pick a duration to apply the status. Statuses already on this panel
            show it selected — pick another to change it.
          </p>

          {visible.length === 0 ? (
            <p className="muted gm-picker__empty">
              {statuses.length === 0
                ? 'No statuses in the compendium yet — create them on the Statuses page.'
                : 'No statuses match that search.'}
            </p>
          ) : (
            <ul className="gm-status-picker__list" role="list">
              {visible.map((status) => {
                const current = durationByStatusId.get(status.id)
                return (
                  <li key={status.id} className="gm-status-picker__row">
                    <div className="gm-status-picker__info">
                      <StatusIcon
                        icon={status.icon}
                        iconType={status.iconType}
                        size={20}
                        className="gm-status-picker__icon"
                      />
                      <span className="gm-status-picker__text">
                        <span className="gm-status-picker__name">
                          {status.name || 'Untitled'}
                          {current && (
                            <span className="gm-status-picker__on-panel">
                              on panel
                            </span>
                          )}
                        </span>
                        <span className="gm-status-picker__desc">
                          {status.description
                            ? plainTextFromMarkdown(status.description)
                            : 'No description yet.'}
                        </span>
                      </span>
                    </div>

                    <div
                      className="gm-status-picker__durations"
                      role="group"
                      aria-label={`Duration for ${status.name}`}
                    >
                      {STATUS_DURATIONS.map((duration) => {
                        const active = current === duration.value
                        return (
                          <button
                            key={duration.value}
                            type="button"
                            className={
                              'gm-duration-chip' +
                              (active ? ' gm-duration-chip--active' : '')
                            }
                            style={
                              {
                                '--status-tone': statusDurationColor(
                                  appTheme,
                                  duration.value,
                                ),
                              } as React.CSSProperties
                            }
                            aria-pressed={active}
                            title={duration.hint}
                            onClick={() =>
                              setPanelStatus(
                                screenId,
                                panelId,
                                status.id,
                                duration.value,
                              )
                            }
                          >
                            <duration.Icon size={12} aria-hidden="true" />
                            {duration.label}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
