/**
 * DrawerCard — the character list drawer's read-only quick-reference card, plus
 * the collapsed drawer's portrait-rail item.
 *
 * The immersive view's drawer holds one of these per screen panel: the same
 * glance data a GM Screen panel's chrome carries (name, portrait, HP, tracked
 * statuses, stat tokens) with **none of the controls** — no steppers, no damage
 * dialog, no menus. Its single interaction is selecting the character, which
 * mounts their encounter sheet in the main area.
 *
 * Each item is its own dnd-kit sortable node, so the drawer's list reorders in
 * place: the expanded card drags by its whole body — no dedicated grip, so the
 * card owns the drawer's full width — while the rail item drags by its
 * portrait. The pointer sensor's 6px activation distance keeps a plain click
 * selecting rather than dragging.
 *
 * Both variants follow the panel chrome's dimming vocabulary so the drawer and
 * the main area agree at a glance: downed/dead instances dim and strike
 * through their name, and an entity out of Action Points dims its body (the
 * same `.gm-panel--no-ap` semantics, scoped to the drawer's own classes).
 *
 * Statuses render as static pills — the same two-segment look as
 * `PanelStatuses`, without the stack stepper or the reference click/hover
 * card. Stat tokens reuse the panel chrome's `.gm-token` markup — icon and
 * value only, no text label — so a token is one color everywhere on the
 * screen and all four fit the card on a single row: players carry
 * Eva/Arm/END/FP, NPC instances Eva/Arm/Move/DC, from the same shared stat
 * palette.
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CircleSlash,
  Footprints,
  Heart,
  Shield,
  Sparkles,
  Target,
  Wind,
  X,
} from '@/components/ui/icons'

import StatusIcon from '@/components/status/StatusIcon'
import { statusDurationMeta } from '@/constants/statusDurations'
import { effectiveCombatStats, effectiveNPCStats } from '@/lib/abilityModifiers'
import { withInstanceState } from '@/lib/gmScreenUtils'
import {
  appThemeColorVars,
  appThemeStatColors,
  statusDurationColor,
} from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import type { AppTheme } from '@/store/appThemeStore'
import { useStatusStore } from '@/store/statusStore'
import type { ResolvedPanel } from '@/lib/gmScreenUtils'

export interface DrawerCardProps {
  entry: ResolvedPanel
  /**
   * The instance's 1-based ordinal among the screen's instances of the same
   * NPC base — shown only when that base has more than one instance, which is
   * exactly when three spawned Bandits need telling apart.
   */
  instanceNumber?: number
  /** True while this entry is the one mounted in the main area. */
  selected?: boolean
  onSelect: () => void
  onRemove: () => void
}

/** Shared per-entry read-outs: HP row, stat tokens, and glance states. */
function entryVitals(entry: ResolvedPanel, appTheme: AppTheme) {
  const statColors = appThemeStatColors(appTheme)
  const tokenColors = appThemeColorVars(appTheme)

  if (entry.panel.kind === 'character') {
    const character = entry.entity
    // `missing` entries render the placeholder branch before this runs.
    if (!character) return null
    const stats = effectiveCombatStats(character)
    return {
      hp: Math.max(0, character.currentHP),
      maxHP: stats.maxHP,
      tempHP: character.tempHP,
      spent: character.currentAP <= 0,
      condition: null as string | null,
      tokens: [
        { Icon: Wind, label: 'Eva', value: stats.evasion, color: statColors.evasion },
        { Icon: Shield, label: 'Arm', value: stats.armor, color: statColors.armor },
        { Icon: Heart, label: 'END', value: character.currentEND, color: tokenColors['--end-bar-color'] },
        { Icon: Sparkles, label: 'FP', value: character.currentFP, color: tokenColors['--fp-bar-color'] },
      ],
    }
  }

  const panel = entry.panel
  const base = entry.entity
  if (!base) return null
  const entity = withInstanceState(base, panel.state)
  const stats = effectiveNPCStats(entity)
  return {
    hp: Math.max(0, panel.state.currentHP),
    maxHP: stats.hp,
    tempHP: panel.state.tempHP,
    spent: panel.state.currentAP <= 0,
    condition: panel.state.condition,
    tokens: [
      { Icon: Wind, label: 'Eva', value: stats.evasion, color: statColors.evasion },
      { Icon: Shield, label: 'Arm', value: stats.armor, color: statColors.armor },
      { Icon: Footprints, label: 'Move', value: stats.movement, color: statColors.movement },
      { Icon: Target, label: 'DC', value: stats.saveDC, color: statColors.saveDC },
    ],
  }
}

export default function DrawerCard({
  entry,
  instanceNumber,
  selected = false,
  onSelect,
  onRemove,
}: DrawerCardProps) {
  const statuses = useStatusStore((s) => s.statuses)
  const statusesLoaded = useStatusStore((s) => s.isLoaded)
  const appTheme = useAppThemeStore((s) => s.theme)
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.panel.id })

  // dnd-kit's attributes carry their own aria-pressed for the sortable
  // roledescription; the select state is what the card's select button must
  // say, so it is stripped before the attributes spread onto it.
  const { 'aria-pressed': _pressed, ...sortableAttributes } = attributes

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (entry.missing || !entry.entity) {
    // A record deleted underneath the screen: the placeholder is itself the
    // drag surface (it offers nothing to select — there is no sheet to mount).
    return (
      <div
        ref={(node) => {
          setNodeRef(node)
          setActivatorNodeRef(node)
        }}
        style={sortableStyle}
        className={
          'gm-drawer-card gm-drawer-card--missing' +
          (selected ? ' gm-drawer-card--selected' : '') +
          (isDragging ? ' gm-drawer-card--dragging' : '')
        }
        data-panel-kind={entry.panel.kind}
        {...attributes}
        {...listeners}
      >
        <span
          className="gm-drawer-card__portrait gm-drawer-card__portrait--missing"
          aria-hidden="true"
        >
          <CircleSlash size={18} />
        </span>
        <span className="gm-drawer-card__info">
          <span className="gm-drawer-card__name">{entry.displayName}</span>
          <span className="gm-drawer-card__missing-note">
            {entry.panel.kind === 'character'
              ? 'Missing character — the sheet was deleted.'
              : 'Missing NPC — the base record was deleted.'}
          </span>
        </span>
        <button
          type="button"
          className="btn btn--icon gm-drawer-card__remove"
          onClick={onRemove}
          aria-label={`Remove missing ${entry.displayName} from the screen`}
          title="Remove panel"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  const vitals = entryVitals(entry, appTheme)
  if (!vitals) return null

  const impaired = vitals.condition !== null && vitals.condition !== 'active'
  const dead = vitals.condition === 'dead'
  const byId = new Map(statuses.map((s) => [s.id, s]))

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={
        'gm-drawer-card' +
        (selected ? ' gm-drawer-card--selected' : '') +
        (impaired ? ' gm-drawer-card--impaired' : '') +
        (dead ? ' gm-drawer-card--dead' : '') +
        (vitals.spent ? ' gm-drawer-card--no-ap' : '') +
        (isDragging ? ' gm-drawer-card--dragging' : '')
      }
      data-panel-kind={entry.panel.kind}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="gm-drawer-card__body"
        onClick={onSelect}
        aria-pressed={selected}
        {...sortableAttributes}
        {...listeners}
      >
        <span className="gm-drawer-card__portrait">
          {entry.entity.portrait ? (
            <img src={entry.entity.portrait} alt="" />
          ) : null}
        </span>
        <span className="gm-drawer-card__info">
          <span className="gm-drawer-card__name-row">
            <span className="gm-drawer-card__name" title={entry.displayName}>
              {entry.displayName}
            </span>
            {instanceNumber !== undefined && (
              <span
                className="gm-drawer-card__num"
                title={`Instance ${instanceNumber} of this NPC on the screen`}
              >
                {instanceNumber}
              </span>
            )}
            {dead && (
              <span className="gm-drawer-card__condition" title="Condition: Dead">
                Dead
              </span>
            )}
            {!dead && vitals.condition === 'downed' && (
              <span
                className="gm-drawer-card__condition gm-drawer-card__condition--downed"
                title="Condition: Downed"
              >
                Downed
              </span>
            )}
          </span>
          {entry.subtitle && (
            <span className="gm-drawer-card__subtitle" title={entry.subtitle}>
              {entry.subtitle}
            </span>
          )}
          <span className="gm-drawer-card__hp">
            <span className="gm-drawer-card__hp-value">
              {vitals.hp}
              <span className="gm-drawer-card__hp-max">/{vitals.maxHP}</span>
            </span>
            <span
              className="gm-hp__track gm-drawer-card__hp-track"
              role="img"
              aria-label={`${vitals.hp} of ${vitals.maxHP} hit points`}
            >
              <span
                className="gm-hp__fill"
                style={{
                  width: `${
                    vitals.maxHP > 0
                      ? Math.min(100, (vitals.hp / vitals.maxHP) * 100)
                      : 0
                  }%`,
                }}
              />
            </span>
            {vitals.tempHP > 0 && (
              <span className="gm-hp__temp" title="Temporary HP (absorbed first)">
                +{vitals.tempHP}
              </span>
            )}
          </span>
          {entry.panel.statuses.length > 0 && (
            <span
              className="gm-drawer-card__statuses"
              role="list"
              aria-label={`Statuses on ${entry.displayName}`}
            >
              {entry.panel.statuses.map((tracked) => {
                const status = byId.get(tracked.statusId) ?? null
                const name =
                  status?.name ?? (statusesLoaded ? 'Missing status' : '…')
                const meta = statusDurationMeta(tracked.duration)
                const DurationIcon = meta.Icon
                return (
                  <span
                    key={tracked.statusId}
                    className={
                      'gm-status-pill' + (status ? '' : ' gm-status-pill--missing')
                    }
                    style={
                      {
                        '--status-tone': statusDurationColor(appTheme, tracked.duration),
                      } as React.CSSProperties
                    }
                    role="listitem"
                    title={
                      status
                        ? `${meta.label}: ${meta.hint}`
                        : statusesLoaded
                          ? `${name} — no longer in the compendium.`
                          : 'Reading the status compendium…'
                    }
                  >
                    <span className="gm-status-pill__main">
                      <StatusIcon
                        icon={status?.icon ?? ''}
                        iconType={status?.iconType ?? 'emoji'}
                        size={12}
                        className="gm-status-pill__icon"
                      />
                      <span className="gm-status-pill__name">{name}</span>
                    </span>
                    <span className="gm-status-pill__meta">
                      <span
                        className="gm-status-pill__duration"
                        role="img"
                        aria-label={`Duration: ${meta.label}`}
                      >
                        <DurationIcon size={11} aria-hidden="true" />
                      </span>
                      <span
                        className="gm-status-pill__count"
                        title={
                          tracked.stacks === 1
                            ? '1 stack'
                            : `${tracked.stacks} stacks`
                        }
                      >
                        {tracked.stacks}
                      </span>
                    </span>
                  </span>
                )
              })}
            </span>
          )}
          <span className="gm-drawer-card__tokens">
            {vitals.tokens.map((token) => (
              <span
                key={token.label}
                className="gm-token"
                style={{ '--token-color': token.color } as React.CSSProperties}
                title={`${token.label}: ${token.value}`}
              >
                <token.Icon size={13} />
                <span className="gm-token__value">{token.value}</span>
              </span>
            ))}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn--icon gm-drawer-card__remove"
        onClick={onRemove}
        aria-label={`Remove ${entry.displayName} from the screen`}
        title="Remove from screen"
      >
        <X size={12} />
      </button>
    </div>
  )
}

/**
 * DrawerRailItem — the collapsed drawer's entry: a portrait button in the
 * vertical rail, with the instance's number badge and the selected entry's
 * highlight ring. Draggable via the portrait itself — the pointer sensor's
 * 6px activation distance keeps a plain click selecting rather than dragging.
 */
export interface DrawerRailItemProps {
  entry: ResolvedPanel
  instanceNumber?: number
  selected?: boolean
  onSelect: () => void
}

export function DrawerRailItem({
  entry,
  instanceNumber,
  selected = false,
  onSelect,
}: DrawerRailItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.panel.id })
  // dnd-kit's attributes carry their own aria-pressed for the sortable
  // roledescription; the select state is what a rail button must say.
  const { 'aria-pressed': _pressed, ...selectAttributes } = attributes

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (entry.missing || !entry.entity) {
    return (
      <span
        ref={setNodeRef}
        style={sortableStyle}
        className={
          'gm-drawer-rail-item gm-drawer-rail-item--missing' +
          (selected ? ' gm-drawer-rail-item--selected' : '')
        }
        title={`${entry.displayName} — the record was deleted`}
      >
        <CircleSlash size={16} />
      </span>
    )
  }

  const impaired =
    entry.panel.kind === 'npc-instance' &&
    entry.panel.state.condition !== 'active'

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={sortableStyle}
      className={
        'gm-drawer-rail-item' +
        (selected ? ' gm-drawer-rail-item--selected' : '') +
        (impaired ? ' gm-drawer-rail-item--impaired' : '') +
        (isDragging ? ' gm-drawer-rail-item--dragging' : '')
      }
      onClick={onSelect}
      aria-pressed={selected}
      title={entry.displayName}
      {...selectAttributes}
      {...listeners}
    >
      {entry.entity.portrait ? (
        <img src={entry.entity.portrait} alt="" />
      ) : (
        <span className="gm-drawer-rail-item__empty" aria-hidden="true" />
      )}
      {instanceNumber !== undefined && (
        <span className="gm-drawer-rail-item__num" aria-hidden="true">
          {instanceNumber}
        </span>
      )}
    </button>
  )
}
