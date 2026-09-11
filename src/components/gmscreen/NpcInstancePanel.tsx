/**
 * NpcInstancePanel — one spawned instance of an NPC base record.
 *
 * The instance is a **delta, not a clone**: stats, abilities, portrait, and
 * description all come from the base record at render time, and only live
 * state (HP, temp HP, condition, **Action Points, Recharge cooldowns**) plus
 * the display label belong to the panel. Spawning "Bandit" three times
 * therefore gives three independent HP pools *and* three independent turns
 * over one shared statblock, and editing the base updates every instance.
 *
 * - **Compact** (default): portrait, instance label (+ base name when it
 *   differs), HP bar with −/+/damage affordances, temp HP, the GM's tracked
 *   status pills inline with the HP number, the instance's **Action Point
 *   meter** (3 per turn, the same meter player sheets use), key tokens from the
 *   base, and a condition badge. Downed/dead instances dim and strike through
 *   the label.
 * - **Expanded**: the shared condensed `PanelSheet` for the base record, with
 *   the instance HP bar and AP meter kept above it. Its abilities are live:
 *   every ability with a cost activates against the instance's AP, Recharge
 *   abilities go on cooldown when used, and "Start new turn" (offered once AP
 *   hits 0) refills AP and rolls the Recharge Die. Edits inside the panel edit
 *   the **base**, which is shared by every instance — the intended semantic,
 *   flagged by an inline hint.
 */

import { useState } from 'react'
import { Hourglass, Pencil, Shield, Skull, Swords, Target, Wind } from 'lucide-react'

import DamageDialog from '@/components/sheet/DamageDialog'
import PanelApBar from '@/components/gmscreen/PanelApBar'
import PanelExpand from '@/components/gmscreen/PanelExpand'
import PanelHpBar from '@/components/gmscreen/PanelHpBar'
import PanelSheet from '@/components/gmscreen/PanelSheet'
import PanelHeader, { type PanelMenuItem } from '@/components/gmscreen/PanelHeader'
import PanelStatuses from '@/components/gmscreen/PanelStatuses'
import { useNpcInstanceActivation } from '@/hooks/useNpcInstanceActivation'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { appThemeStatColors, gmPanelSheetPresentation } from '@/lib/themeUtils'
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
  const spendInstanceAP = useGMScreenStore((s) => s.spendInstanceAP)
  const restoreInstanceAP = useGMScreenStore((s) => s.restoreInstanceAP)
  const appTheme = useAppThemeStore((s) => s.theme)
  // Panel-chrome colors — the app theme's palette, matching CharacterPanel and
  // deliberately independent of any sheet's customization. Its four stat
  // tokens come from the theme's SHARED stat palette (`statColors`), the same
  // one the expanded body's Combat Stats row and a player panel's chrome use,
  // so "Eva" is one color everywhere on the screen.
  const statColors = appThemeStatColors(appTheme)
  // The expanded body follows the app theme unconditionally: NPCs have no
  // per-sheet customization. It goes through the same helper a player panel
  // uses, so a player panel with the "Match app theme" setting on renders its
  // body through exactly this path — the two can never drift apart.
  const sheetPresentation = gmPanelSheetPresentation(base.config, appTheme, true)

  // Live-play wiring for this instance: its own AP, its own Recharge
  // cooldowns, its own turn. Everything the base record owns stays untouched.
  const { activation, startTurn, hasCooldowns } = useNpcInstanceActivation(
    screenId,
    panel,
    base,
  )

  const [showDamage, setShowDamage] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const maxHP = base.npcStats?.hp ?? 0
  const armor = base.npcStats?.armor ?? 0
  const evasion = base.npcStats?.evasion ?? 0
  const movement = base.npcStats?.movement ?? 0
  const saveDC = base.npcStats?.saveDC ?? 0
  const hp = Math.max(0, panel.state.currentHP)
  const ap = panel.state.currentAP
  const { condition } = panel.state
  const impaired = condition !== 'active'
  // Out of AP = out of actions for this turn: the panel dims (except its AP
  // block, which holds the `+` stepper and the turn button). See gmscreen.css.
  const spent = ap <= 0

  const menuItems: PanelMenuItem[] = [
    { label: 'Rename instance…', onSelect: () => setRenaming(true) },
    { label: 'Duplicate instance', onSelect: () => duplicatePanel(screenId, panel.id) },
    { label: 'Open base sheet', onSelect: onOpenBase },
    // The turn button appears by itself once AP runs out; the menu entry keeps
    // an early turn (or a GM hand-wave) possible without spending down first.
    { label: 'Start new turn', onSelect: startTurn },
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
        (impaired ? ` gm-panel--${condition}` : '') +
        (spent ? ' gm-panel--no-ap' : '')
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

      <PanelHpBar
        name={panel.label || base.name}
        hp={hp}
        maxHP={maxHP}
        tempHP={panel.state.tempHP}
        onDamage={() => adjustInstanceHP(screenId, panel.id, -1)}
        onHeal={() => adjustInstanceHP(screenId, panel.id, 1)}
        onOpenDamageDialog={() => setShowDamage(true)}
        statuses={
          <PanelStatuses
            screenId={screenId}
            panel={panel}
            entityName={panel.label || base.name}
          />
        }
      />

      <PanelApBar
        ap={ap}
        onSpend={() => spendInstanceAP(screenId, panel.id, 1)}
        onRestore={() => restoreInstanceAP(screenId, panel.id, 1)}
        onStartTurn={startTurn}
        startTurnTitle="Refill Action Points and roll the Recharge Die"
        status={
          // A collapsed panel shows no ability cards, so the cooldown count
          // rides in the label row: the GM can see an NPC is still waiting on a
          // Recharge Die without expanding it.
          hasCooldowns ? (
            <span
              className="gm-ap__cooling"
              title="Abilities on Recharge cooldown, waiting for the next turn's Recharge Die"
            >
              <Hourglass size={12} aria-hidden="true" />
              {panel.state.cooldowns.length} on cooldown
            </span>
          ) : undefined
        }
      />

      <div className="gm-tokens">
        <span className="gm-token" style={{ '--token-color': statColors.evasion } as React.CSSProperties}>
          <Wind size={13} /> <span className="gm-token__label">Eva</span>
          <span className="gm-token__value">{evasion}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': statColors.armor } as React.CSSProperties}>
          <Shield size={13} /> <span className="gm-token__label">Arm</span>
          <span className="gm-token__value">{armor}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': statColors.movement } as React.CSSProperties}>
          <Swords size={13} /> <span className="gm-token__label">Move</span>
          <span className="gm-token__value">{movement}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': statColors.saveDC } as React.CSSProperties}>
          <Target size={13} /> <span className="gm-token__label">DC</span>
          <span className="gm-token__value">{saveDC}</span>
        </span>
        {/* Parity with a player panel, whose token row ends in the pencil that
          * opens the full sheet. An instance opens its BASE sheet — the record
          * every instance of it shares — so the tooltip says so. */}
        <button
          type="button"
          className="btn btn--icon gm-token gm-token--edit"
          onClick={onOpenBase}
          aria-label={`Open ${panel.label || base.name}'s base sheet`}
          title="Open base sheet"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Same condensed body as an expanded player panel (see PanelSheet) —
        * an NPC panel used to render the entire NPCSheet, which was far too
        * tall to read alongside other panels. `npcActivation` is what makes
        * the abilities live here without touching the base record's sheet. */}
      <PanelExpand open={expanded}>
        <div
          className={sheetPresentation.className}
          style={sheetPresentation.style}
        >
          <PanelSheet entity={base} mode="view" npcActivation={activation} />
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
