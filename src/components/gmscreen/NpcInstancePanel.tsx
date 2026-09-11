/**
 * NpcInstancePanel — one spawned instance of an NPC base record.
 *
 * The instance is a **delta, not a clone**: stats, abilities, portrait, and
 * description all come from the base record at render time, and only live
 * state (HP, temp HP, condition) plus the display label belong to the panel.
 * Spawning "Bandit" three times therefore gives three independent HP pools
 * over one shared statblock, and editing the base updates every instance.
 *
 * - **Compact** (default): portrait, instance label (+ base name when it
 *   differs), HP bar with −/+/damage affordances, temp HP, the GM's tracked
 *   status pills inline with the HP number, key tokens from the base, and a
 *   condition badge. Downed/dead instances dim and strike through the label.
 * - **Expanded**: the full `NPCSheet` for the base record, with the instance
 *   HP bar kept above it. Edits inside the panel edit the **base**, which is
 *   shared by every instance — the intended semantic, flagged by an inline
 *   hint.
 */

import { useState } from 'react'
import { HeartPulse, Shield, Skull, Swords, Target, Wind } from 'lucide-react'

import DamageDialog from '@/components/sheet/DamageDialog'
import PanelExpand from '@/components/gmscreen/PanelExpand'
import PanelSheet from '@/components/gmscreen/PanelSheet'
import PanelHeader, { type PanelMenuItem } from '@/components/gmscreen/PanelHeader'
import PanelStatuses from '@/components/gmscreen/PanelStatuses'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { appThemeColorVars } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import type { Character, NpcInstanceState, ScreenPanel } from '@/types'

export interface NpcInstancePanelProps {
  panel: Extract<ScreenPanel, { kind: 'npc-instance' }>
  /** The base NPC record this instance was spawned from. */
  base: Character
  screenId: string
  /** The base's name, when it differs from the instance label. */
  subtitle: string | null
  onOpenBase: () => void
  onRemove: () => void
}

const CONDITION_LABEL: Record<NpcInstanceState['condition'], string> = {
  active: 'Active',
  downed: 'Downed',
  dead: 'Dead',
}

export default function NpcInstancePanel({
  panel,
  base,
  screenId,
  subtitle,
  onOpenBase,
  onRemove,
}: NpcInstancePanelProps) {
  const setPanelDensity = useGMScreenStore((s) => s.setPanelDensity)
  const duplicatePanel = useGMScreenStore((s) => s.duplicatePanel)
  const renameInstance = useGMScreenStore((s) => s.renameInstance)
  const setInstanceCondition = useGMScreenStore((s) => s.setInstanceCondition)
  const adjustInstanceHP = useGMScreenStore((s) => s.adjustInstanceHP)
  const appTheme = useAppThemeStore((s) => s.theme)
  // Panel-chrome colors — the app theme's palette, matching CharacterPanel and
  // deliberately independent of any sheet's customization.
  const themeVars = appThemeColorVars(appTheme)

  const [showDamage, setShowDamage] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const maxHP = base.npcStats?.hp ?? 0
  const armor = base.npcStats?.armor ?? 0
  const evasion = base.npcStats?.evasion ?? 0
  const movement = base.npcStats?.movement ?? 0
  const saveDC = base.npcStats?.saveDC ?? 0
  const hp = Math.max(0, panel.state.currentHP)
  const { condition } = panel.state
  const impaired = condition !== 'active'

  const menuItems: PanelMenuItem[] = [
    { label: 'Rename instance…', onSelect: () => setRenaming(true) },
    { label: 'Duplicate instance', onSelect: () => duplicatePanel(screenId, panel.id) },
    { label: 'Open base sheet', onSelect: onOpenBase },
    ...(condition === 'dead'
      ? [{ label: 'Mark alive', onSelect: () => setInstanceCondition(screenId, panel.id, 'active') }]
      : [{ label: 'Mark dead', onSelect: () => setInstanceCondition(screenId, panel.id, 'dead') }]),
    ...(condition === 'downed'
      ? []
      : [{ label: 'Mark downed', onSelect: () => setInstanceCondition(screenId, panel.id, 'downed') }]),
    { label: 'Remove panel', onSelect: onRemove, danger: true },
  ]

  const expanded = panel.density === 'expanded'

  return (
    <section
      className={
        'gm-panel gm-panel--npc' +
        (expanded ? ' gm-panel--expanded' : '') +
        (impaired ? ` gm-panel--${condition}` : '')
      }
    >
      <PanelHeader
        portrait={base.portrait}
        name={panel.label || base.name}
        subtitle={subtitle}
        density={panel.density}
        onDensityChange={(d) => setPanelDensity(screenId, panel.id, d)}
        menuItems={menuItems}
        dimmed={impaired}
        badge={
          <span
            className={`gm-panel__badge gm-panel__badge--${condition}`}
            title={`Condition: ${CONDITION_LABEL[condition]}`}
          >
            {condition === 'dead' && <Skull size={12} />}
            {CONDITION_LABEL[condition]}
          </span>
        }
      />

      {renaming && (
        <form
          className="gm-panel__rename"
          onSubmit={(e) => {
            e.preventDefault()
            setRenaming(false)
          }}
        >
          <input
            className="sheet-input gm-panel__rename-input"
            value={panel.label}
            onChange={(e) => renameInstance(screenId, panel.id, e.target.value)}
            onBlur={() => setRenaming(false)}
            aria-label="Instance name"
            autoFocus
          />
        </form>
      )}

      <div className="gm-hp">
        <div className="gm-hp__row">
          <HeartPulse size={14} className="gm-hp__icon" aria-hidden="true" />
          <span className="gm-hp__label">HP</span>
          <span className="gm-hp__value">
            {hp}
            <span className="gm-hp__max">/{maxHP}</span>
          </span>
          {panel.state.tempHP > 0 && (
            <span className="gm-hp__temp" title="Temporary HP (absorbed first)">
              +{panel.state.tempHP}
            </span>
          )}
          {/* Statuses the GM is tracking: inline with the HP number, on one
            * scrollable line so they can never make the panel taller. */}
          <PanelStatuses
            screenId={screenId}
            panel={panel}
            entityName={panel.label || base.name}
          />
        </div>
        <div
          className="gm-hp__track"
          role="img"
          aria-label={`${hp} of ${maxHP} hit points`}
        >
          <div
            className="gm-hp__fill"
            style={{ width: `${maxHP > 0 ? Math.min(100, (hp / maxHP) * 100) : 0}%` }}
          />
        </div>
        <div className="gm-hp__controls">
          <button
            type="button"
            className="btn btn--icon gm-hp__step"
            onClick={() => adjustInstanceHP(screenId, panel.id, -1)}
            aria-label={`Deal 1 damage to ${panel.label}`}
            title="−1 HP"
          >
            −
          </button>
          <button
            type="button"
            className="btn btn--icon gm-hp__step"
            onClick={() => adjustInstanceHP(screenId, panel.id, 1)}
            aria-label={`Heal ${panel.label} 1 HP`}
            title="+1 HP"
          >
            +
          </button>
          <button
            type="button"
            className="btn btn--ghost gm-hp__damage"
            onClick={() => setShowDamage(true)}
          >
            Damage…
          </button>
        </div>
      </div>

      <div className="gm-tokens">
        <span className="gm-token" style={{ '--token-color': themeVars['--color-token-evasion'] } as React.CSSProperties}>
          <Wind size={13} /> <span className="gm-token__label">Eva</span>
          <span className="gm-token__value">{evasion}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': themeVars['--color-token-armor'] } as React.CSSProperties}>
          <Shield size={13} /> <span className="gm-token__label">Arm</span>
          <span className="gm-token__value">{armor}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': themeVars['--color-token-movement'] } as React.CSSProperties}>
          <Swords size={13} /> <span className="gm-token__label">Move</span>
          <span className="gm-token__value">{movement}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': themeVars['--color-token-save-dc'] } as React.CSSProperties}>
          <Target size={13} /> <span className="gm-token__label">DC</span>
          <span className="gm-token__value">{saveDC}</span>
        </span>
      </div>

      {/* Same condensed body as an expanded player panel (see PanelSheet) —
        * an NPC panel used to render the entire NPCSheet, which was far too
        * tall to read alongside other panels. */}
      <PanelExpand open={expanded}>
        <div
          className="character-sheet character-sheet--view gm-panel__sheet"
          style={themeVars as React.CSSProperties}
        >
          <PanelSheet entity={base} mode="view" />
        </div>
      </PanelExpand>

      {showDamage && (
        <DamageDialog
          npcInstance={{
            screenId,
            panelId: panel.id,
            label: panel.label || base.name,
            base,
            currentHP: panel.state.currentHP,
            tempHP: panel.state.tempHP,
          }}
          onClose={() => setShowDamage(false)}
        />
      )}
    </section>
  )
}
