/**
 * PanelStatuses — the GM Screen's per-panel status tracker.
 *
 * Renders the panel's tracked statuses as a single row of segmented pills
 * **inline with the HP number**, followed by the "Add Status" icon button. The
 * whole strip is one line that scrolls sideways instead of wrapping: a panel
 * must never grow taller because the GM stacked conditions on it (see
 * `.gm-statuses` in gmscreen.css).
 *
 * Each pill has exactly two segments:
 *   `[ icon Name | duration-icon − n + ]`
 * The **left** segment is the filled one — it carries the status's icon and its
 * full name, which is never truncated (pills keep their natural width and the
 * strip scrolls instead). The right segment holds the duration as an icon only
 * (its label and rules reminder live in the tooltip) and the stack stepper.
 * Both the fill and the duration glyph take the duration's own accent for the
 * active app theme (the GM Screen is app chrome — see
 * `themeUtils.STATUS_DURATION_COLORS`).
 *
 * The stepper adjusts stacks; at one stack the minus becomes an explicit ✕
 * remove, so a status can never be removed by a mis-click on a decrement.
 *
 * Statuses here are **GM Screen state only** — they live on the `ScreenPanel`
 * and are never written to the referenced character or NPC record, so nothing
 * about them reaches a player's own sheet. The compendium record is referenced
 * by id; its name and icon are read at render time.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CirclePlus, Minus, Plus, X } from 'lucide-react'

import AddStatusModal from '@/components/gmscreen/AddStatusModal'
import StatusIcon from '@/components/status/StatusIcon'
import { MAX_PANEL_STATUS_STACKS, statusDurationMeta } from '@/constants/statusDurations'
import { statusDurationColor } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useStatusStore } from '@/store/statusStore'
import type { PanelStatus, ScreenPanel, StatusCondition } from '@/types'

export interface PanelStatusesProps {
  screenId: string
  /** The panel whose tracked statuses are rendered. */
  panel: ScreenPanel
  /** Display name used in control labels ("Add status to Bandit"). */
  entityName: string
}

export default function PanelStatuses({
  screenId,
  panel,
  entityName,
}: PanelStatusesProps) {
  const statuses = useStatusStore((s) => s.statuses)
  /** False until the compendium has been read, so a not-yet-loaded status is
   *  never mistaken for a deleted one (see `resolved` below). */
  const statusesLoaded = useStatusStore((s) => s.isLoaded)
  const adjustStacks = useGMScreenStore((s) => s.adjustPanelStatusStacks)
  const removeStatus = useGMScreenStore((s) => s.removePanelStatus)
  const appTheme = useAppThemeStore((s) => s.theme)

  const [pickerOpen, setPickerOpen] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)
  /** Tracked count from the previous render, to detect an addition. */
  const prevCount = useRef(panel.statuses.length)

  const tracked = panel.statuses

  // A new status lands at the end of a sideways-scrolling strip, where it can
  // be off-screen — slide it into view so the GM sees what they just added.
  useEffect(() => {
    const count = tracked.length
    const added = count > prevCount.current
    prevCount.current = count
    const strip = stripRef.current
    if (added && strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = strip.scrollWidth
    }
  }, [tracked.length])

  const byId = new Map(statuses.map((s) => [s.id, s]))

  return (
    <div className="gm-statuses">
      {tracked.length > 0 && (
        <div
          className="gm-statuses__strip"
          ref={stripRef}
          role="list"
          aria-label={`Statuses on ${entityName}`}
        >
          {tracked.map((entry) => (
            <StatusPill
              key={entry.statusId}
              entry={entry}
              status={byId.get(entry.statusId) ?? null}
              resolved={statusesLoaded}
              entityName={entityName}
              tone={statusDurationColor(appTheme, entry.duration)}
              onAdjustStacks={(delta) =>
                adjustStacks(screenId, panel.id, entry.statusId, delta)
              }
              onRemove={() => removeStatus(screenId, panel.id, entry.statusId)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn--icon gm-statuses__add"
        onClick={() => setPickerOpen(true)}
        aria-label={`Add status to ${entityName}`}
        title="Add status"
      >
        <CirclePlus size={15} />
      </button>

      {pickerOpen && (
        <AddStatusModal
          screenId={screenId}
          panelId={panel.id}
          entityName={entityName}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

/** One tracked status: icon, name, duration label, and its stack stepper. */
function StatusPill({
  entry,
  status,
  resolved,
  entityName,
  tone,
  onAdjustStacks,
  onRemove,
}: {
  entry: PanelStatus
  /** The compendium record, or null when it wasn't found in the store. */
  status: StatusCondition | null
  /** Whether the compendium has finished loading — distinguishes "deleted"
   *  from "not read yet", so a status is never wrongly labelled missing. */
  resolved: boolean
  entityName: string
  tone: string
  onAdjustStacks: (delta: number) => void
  onRemove: () => void
}) {
  const meta = statusDurationMeta(entry.duration)
  const DurationIcon = meta.Icon
  const name = status?.name || (resolved ? 'Missing status' : '…')
  const lastStack = entry.stacks <= 1
  const atMax = entry.stacks >= MAX_PANEL_STATUS_STACKS

  // Tooltip: the rules reminder plus, for a status still in the compendium, its
  // description — the pill itself has room for neither.
  const tooltip = !resolved
    ? `${meta.label}: ${meta.hint}`
    : status
      ? `${name} — ${meta.label}: ${meta.hint}${status.description ? `\n\n${status.description}` : ''}`
      : `${name} — this status is no longer in the compendium.`

  return (
    <span
      className={
        'gm-status-pill' + (status ? '' : ' gm-status-pill--missing')
      }
      style={{ '--status-tone': tone } as CSSProperties}
      role="listitem"
      title={tooltip}
    >
      {/* Left segment — the filled one: the status's icon and its FULL name.
        * The name never truncates, so pills keep their natural width and the
        * strip scrolls; see `.gm-status-pill` in gmscreen.css. */}
      <span className="gm-status-pill__main">
        <StatusIcon
          icon={status?.icon ?? ''}
          iconType={status?.iconType ?? 'emoji'}
          size={12}
          className="gm-status-pill__icon"
        />
        <span className="gm-status-pill__name">{name}</span>
      </span>

      {/* Right segment — the duration as an icon only (the label and the rules
        * reminder live in its tooltip), then the stack stepper. */}
      <span className="gm-status-pill__meta">
        <span
          className="gm-status-pill__duration"
          role="img"
          aria-label={`Duration: ${meta.label}`}
          title={`${meta.label}: ${meta.hint}`}
        >
          <DurationIcon size={11} aria-hidden="true" />
        </span>

        <span className="gm-status-pill__stacks">
          {lastStack ? (
            <button
              type="button"
              className="btn btn--icon gm-status-pill__step"
              onClick={onRemove}
              aria-label={`Remove ${name} from ${entityName}`}
              title={`Remove ${name}`}
            >
              <X size={11} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--icon gm-status-pill__step"
              onClick={() => onAdjustStacks(-1)}
              aria-label={`Remove one stack of ${name} from ${entityName}`}
              title="−1 stack"
            >
              <Minus size={11} />
            </button>
          )}
          <span
            className="gm-status-pill__count"
            title={entry.stacks === 1 ? '1 stack' : `${entry.stacks} stacks`}
          >
            {entry.stacks}
          </span>
          <button
            type="button"
            className="btn btn--icon gm-status-pill__step"
            onClick={() => onAdjustStacks(1)}
            disabled={atMax}
            aria-label={`Add a stack of ${name} to ${entityName}`}
            title="+1 stack"
          >
            <Plus size={11} />
          </button>
        </span>
      </span>
    </span>
  )
}
