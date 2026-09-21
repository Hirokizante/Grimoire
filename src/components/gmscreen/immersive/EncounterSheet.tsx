/**
 * EncounterSheet — the immersive view's main area: the selected character's
 * compact, encounter-ready sheet.
 *
 * The chrome is the same family of controls a grid panel carries, condensed
 * into the fewest rows the at-a-glance reading allows: the portrait, name and
 * the combat stat tokens share the `PanelHeader` row; HP and the FP/AP pool
 * are one-line `PanelMeter`s; the Mortal Wound track and the END meter follow;
 * and the Attributes row carries the stacked End Turn / Recover buttons. All
 * of it is wired to the exact same store actions as a grid panel, so running
 * a character here is running them from a grid panel, one at a time. The ⋯
 * menu keeps every panel action (Open sheet, Start new turn, the wound
 * roll/add/clear trio, instance rename/duplicate/condition, Remove); level
 * up, import/export and customize stay on the sheet page the menu opens.
 *
 * Below the chrome, `EncounterSheetBody` renders the read-only encounter
 * view: abilities and skills only — combat stats, resources and attributes
 * all live in the condensed chrome above, so nothing is printed twice. The
 * body's theming follows the same rule as every panel: app chrome, with a
 * player's own customization injected through `gmPanelSheetPresentation`
 * unless Settings → GM Screen → Match app theme is on.
 */

import { useMemo, useState } from 'react'
import {
  Footprints,
  Heart,
  Hourglass,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Star,
  Swords,
  Target,
  Wind,
  Zap,
} from '@/components/ui/icons'

import { ATTRIBUTE_LIST } from '@/constants/gameData'
import DamageDialog from '@/components/sheet/DamageDialog'
import MortalWoundPicker from '@/components/sheet/MortalWoundPicker'
import PanelHeader, { type PanelMenuItem } from '@/components/gmscreen/PanelHeader'
import PanelHpBar from '@/components/gmscreen/PanelHpBar'
import PanelMeter from '@/components/gmscreen/PanelMeter'
import PanelMortalWounds from '@/components/gmscreen/PanelMortalWounds'
import PanelStatuses from '@/components/gmscreen/PanelStatuses'
import { useNotification } from '@/context/NotificationContext'
import { useNpcInstanceActivation } from '@/hooks/useNpcInstanceActivation'
import { effectiveCombatStats, effectiveAttributes, effectiveNPCStats } from '@/lib/abilityModifiers'
import { panelDamageOutcome, withInstanceState } from '@/lib/gmScreenUtils'
import { characterTurnMessage } from '@/lib/gmScreenTurns'
import {
  PENDING_MORTAL_WOUND,
  characterMortalWounds,
  nextMortalWoundSlot,
} from '@/lib/mortalWounds'
import { appThemeColorVars, appThemeStatColors, gmPanelSheetPresentation } from '@/lib/themeUtils'
import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import {
  npcMortalWoundAllowance,
  useGMScreenStore,
} from '@/store/gmScreenStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useGmPanelThemeStore } from '@/store/gmPanelThemeStore'
import type { DamageResult } from '@/store/characterStore'
import type { AttributeKey, MortalWound, ScreenPanel } from '@/types'
import { MAX_AP, MAX_END, MAX_MORTAL_WOUNDS } from '@/constants/gameData'
import EncounterSheetBody from './EncounterSheetBody'
import type { ResolvedPanel } from '@/lib/gmScreenUtils'

export interface EncounterSheetProps {
  screenId: string
  entry: ResolvedPanel
  onOpenSheet: (characterId: string) => void
  onRemove: () => void
}

const CONDITION_LABEL = {
  active: 'Active',
  downed: 'Downed',
  dead: 'Dead',
} as const

function formatAttr(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

/**
 * Roll one attribute check for an encounter-sheet entity — the same d20 +
 * modifier the sheet page's attribute boxes roll, logged with the entity as
 * its character (see AttributesSection.onClickAttr).
 */
function onClickAttr(
  character: NonNullable<ResolvedPanel['entity']>,
  effective: ReturnType<typeof effectiveAttributes>,
  key: AttributeKey,
  name: string,
) {
  const value = effective[key]
  useDiceRollStore.getState().roll({
    notation: `d20${value >= 0 ? '+' : ''}${value}`,
    character,
    source: { type: 'attribute-check', attributeKey: key, attributeName: name },
  })
}

/**
 * One attribute value with a small badge when an active ability modifier is
 * changing it — the same read-out the sheet page's attribute boxes print
 * (see AttributesSection.renderValue).
 */
function formatAttrValue(
  value: number,
  character: NonNullable<ResolvedPanel['entity']>,
  key: AttributeKey,
): React.ReactNode {
  const base = character.attributes[key]
  const delta = value - base
  if (delta === 0) return formatAttr(value)
  return (
    <span className="attribute-value--modified">
      {formatAttr(value)}
      <span className="attribute-value__delta">
        {delta > 0 ? `+${delta}` : `${delta}`}
      </span>
    </span>
  )
}

/**
 * The combat stat pills the encounter view inlines into the header row. One
 * shared builder for both entity kinds: a player reads Milestones / Evasion /
 * Armor / Movement / Save DC / END Recovery — the full Combat Stats row the
 * sheet body used to print. An NPC reads Evasion / Armor / Movement / Save DC
 * (its HP and Mortal Wounds tokens live in the chrome's HP meter and wound
 * track, so printing them again here would say nothing new). Colors come from
 * the app theme's shared stat palette — the same one the grid panels' token
 * rows and the sheet page's Combat Stats row use — so a stat is the same
 * color everywhere it is read.
 */
function buildHeaderTokens(
  entityKind: 'character' | 'npc',
  character: NonNullable<ResolvedPanel['entity']>,
  stats: {
    evasion: number
    armor: number
    movement: number
    saveDC: number
    endRecovery?: number
  },
): React.ReactNode {
  const colors = appThemeStatColors(useAppThemeStore.getState().theme)
  const milestones = character.milestones
  // Icon per token, the same glyph the sheet page's Combat Stats card and the
  // grid panels' token rows lead with — the icon is what keeps END and FP
  // (same violet in most themes) apart at a glance.
  const tokens = [
    ...(entityKind === 'character'
      ? [
          { label: 'Miles', value: milestones, icon: Star, color: colors.milestone, title: `Milestones: ${milestones}` },
          { label: 'Eva', value: stats.evasion, icon: Wind, color: colors.evasion, title: `Evasion: ${stats.evasion}` },
          { label: 'Arm', value: stats.armor, icon: Shield, color: colors.armor, title: `Armor: ${stats.armor}` },
          { label: 'Move', value: stats.movement, icon: Footprints, color: colors.movement, title: `Movement: ${stats.movement} sq` },
          { label: 'Save', value: stats.saveDC, icon: Target, color: colors.saveDC, title: `Save DC: ${stats.saveDC}` },
          { label: 'END Rec', value: stats.endRecovery ?? 0, icon: Heart, color: colors.endRecovery, title: `END Recovery: ${stats.endRecovery ?? 0}` },
        ]
      : [
          { label: 'Eva', value: stats.evasion, icon: Wind, color: colors.evasion, title: `Evasion: ${stats.evasion}` },
          { label: 'Arm', value: stats.armor, icon: Shield, color: colors.armor, title: `Armor: ${stats.armor}` },
          { label: 'Move', value: stats.movement, icon: Footprints, color: colors.movement, title: `Movement: ${stats.movement} sq` },
          { label: 'DC', value: stats.saveDC, icon: Target, color: colors.saveDC, title: `Save DC: ${stats.saveDC}` },
        ]),
  ]
  return (
    <div className="gm-encounter__tokens" role="list" aria-label="Combat stats">
      {tokens.map((token) => {
        const Icon = token.icon
        return (
          <span
            key={token.label}
            className="gm-token"
            role="listitem"
            style={{ '--token-color': token.color } as React.CSSProperties}
            title={token.title}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="gm-token__label">{token.label}</span>
            <span className="gm-token__value">{token.value}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function EncounterSheet({
  screenId,
  entry,
  onOpenSheet,
  onRemove,
}: EncounterSheetProps) {
  if (entry.missing || !entry.entity) {
    return (
      <div className="gm-encounter gm-encounter--missing">
        <p className="muted">
          {entry.panel.kind === 'character'
            ? 'Missing character — the sheet was deleted. Remove it from the drawer.'
            : 'Missing NPC — the base record was deleted. Remove it from the drawer.'}
        </p>
      </div>
    )
  }
  return entry.panel.kind === 'character' ? (
    <EncounterCharacter
      screenId={screenId}
      panel={entry.panel}
      character={entry.entity}
      onOpenSheet={onOpenSheet}
      onRemove={onRemove}
    />
  ) : (
    <EncounterNpcInstance
      screenId={screenId}
      panel={entry.panel}
      base={entry.entity}
      subtitle={entry.subtitle}
      onOpenBase={onOpenSheet}
      onRemove={onRemove}
    />
  )
}

interface EncounterCharacterProps {
  screenId: string
  panel: Extract<ScreenPanel, { kind: 'character' }>
  character: NonNullable<ResolvedPanel['entity']>
  onOpenSheet: (characterId: string) => void
  onRemove: () => void
}

function EncounterCharacter({
  screenId,
  panel,
  character,
  onOpenSheet,
  onRemove,
}: EncounterCharacterProps) {
  const heal = useCharacterStore((s) => s.heal)
  // The panel's damage pipeline: `takeDamage` plus the D20 the GM would
  // otherwise have no card to roll (see CharacterPanel).
  const takePanelDamage = useCharacterStore((s) => s.takePanelDamage)
  const rollMortalWound = useCharacterStore((s) => s.rollMortalWound)
  const addMortalWound = useCharacterStore((s) => s.addMortalWound)
  const clearMortalWound = useCharacterStore((s) => s.clearMortalWound)
  const clearMortalWounds = useCharacterStore((s) => s.clearMortalWounds)
  const spendAP = useCharacterStore((s) => s.spendAP)
  const restoreAP = useCharacterStore((s) => s.restoreAP)
  const spendFP = useCharacterStore((s) => s.spendFP)
  const restoreFP = useCharacterStore((s) => s.restoreFP)
  const spendEND = useCharacterStore((s) => s.spendEND)
  const restoreEND = useCharacterStore((s) => s.restoreEND)
  const recover = useCharacterStore((s) => s.recover)
  // Ending a turn is the same store action the sheet's own End Turn button
  // runs (see RecoverAction / CharacterPanel).
  const endTurn = useCharacterStore((s) => s.endTurn)
  const appTheme = useAppThemeStore((s) => s.theme)
  const matchAppTheme = useGmPanelThemeStore((s) => s.matchAppTheme)
  const { notify } = useNotification()
  const [showDamage, setShowDamage] = useState(false)
  const [showWoundPicker, setShowWoundPicker] = useState(false)

  const sheetPresentation = gmPanelSheetPresentation(
    character.config,
    appTheme,
    matchAppTheme,
  )

  const stats = effectiveCombatStats(character)
  const attributes = effectiveAttributes(character)
  const maxHP = stats.maxHP
  const hp = Math.max(0, character.currentHP)
  const ap = character.currentAP
  const end = character.currentEND
  const spent = ap <= 0

  const wounds = characterMortalWounds(character.mortalWounds)
  const pendingWound = wounds.some(({ name }) => name === PENDING_MORTAL_WOUND)
  const canAddWound = nextMortalWoundSlot(character.mortalWounds) !== -1

  /** See CharacterPanel — the `−` stepper runs the full damage pipeline. */
  const reportSteppedDamage = (result: DamageResult | null) => {
    if (!result) return
    if (!result.knockedOut && !result.causedMortalWound) return
    notify(panelDamageOutcome(character.name, result, 'KNOCKED OUT'), 'error', 5000)
  }

  const startTurn = () => {
    const gained = endTurn(character.id)
    notify(
      characterTurnMessage(character.name, gained),
      gained > 0 ? 'success' : 'info',
    )
  }

  const handleRecover = () => {
    if (recover(character.id)) {
      notify('Recovered! All END restored.', 'success')
    } else {
      notify('Character not found.', 'error')
    }
  }

  const addWoundByName = (wound: MortalWound) => {
    const result = addMortalWound(character.id, wound.name)
    if (result.slotIndex < 0) {
      notify(
        `${character.name} has no Mortal Wound slot left — clear one first.`,
        'error',
        4000,
      )
      return
    }
    notify(
      `${character.name} takes a Mortal Wound: ${result.woundName} (d20 ${result.roll}).`,
      'error',
      5000,
    )
  }

  const menuItems: PanelMenuItem[] = [
    { label: 'Open sheet', onSelect: () => onOpenSheet(character.id) },
    { label: 'Start new turn', onSelect: startTurn },
    ...(pendingWound
      ? [
          {
            label: 'Roll Mortal Wound (d20)',
            onSelect: () => {
              const wound = rollMortalWound(character.id)
              if (wound.slotIndex >= 0) {
                notify(
                  `${character.name} takes a Mortal Wound: ${wound.woundName} (d20 ${wound.roll}).`,
                  'error',
                  5000,
                )
              }
            },
          },
        ]
      : []),
    ...(canAddWound
      ? [{ label: 'Add mortal wound...', onSelect: () => setShowWoundPicker(true) }]
      : []),
    ...(wounds.length > 0
      ? [
          {
            label: 'Clear mortal wounds',
            onSelect: () => clearMortalWounds(character.id),
          },
        ]
      : []),
    { label: 'Remove panel', onSelect: onRemove, danger: true },
  ]

  return (
    <section
      className={
        'gm-panel gm-encounter gm-encounter--character' +
        (spent ? ' gm-panel--no-ap' : '')
      }
    >
      <PanelHeader
        portrait={character.portrait}
        name={character.name}
        subtitle={character.playerName || null}
        density="expanded"
        onDensityChange={() => {}}
        showDensityToggle={false}
        menuItems={menuItems}
        tokens={buildHeaderTokens('character', character, stats)}
        badge={
          <span
            className="gm-panel__badge"
            title={`${character.milestones} milestones`}
          >
            <Swords size={12} /> {character.milestones}
          </span>
        }
      />

      <PanelHpBar
        name={character.name}
        hp={hp}
        maxHP={maxHP}
        tempHP={character.tempHP}
        onDamage={() => reportSteppedDamage(takePanelDamage(character.id, 1))}
        onHeal={() => heal(character.id, 1)}
        onOpenDamageDialog={() => setShowDamage(true)}
        statuses={
          <PanelStatuses
            screenId={screenId}
            panel={panel}
            entityName={character.name}
          />
        }
      />

      <div className="gm-encounter__row">
        <PanelMeter
          icon={Sparkles}
          color={appThemeColorVars(appTheme)['--fp-bar-color']}
          label="FP"
          value={character.currentFP}
          max={character.maxFP}
          onSpend={() => spendFP(character.id, 1)}
          onRestore={() => restoreFP(character.id, 1)}
          spendLabel="Spend Fate Points"
          restoreLabel="Restore Fate Points"
          title="Fate Points — spend to reroll"
        />
        <PanelMeter
          icon={Zap}
          color={appThemeColorVars(appTheme)['--ap-bar-color']}
          label="AP"
          value={ap}
          max={MAX_AP}
          onSpend={() => spendAP(character.id, 1)}
          onRestore={() => restoreAP(character.id, 1)}
          spendLabel="Spend Action Points"
          restoreLabel="Restore Action Points"
          title="Action Points for this turn"
        />
      </div>

      <PanelMortalWounds
        wounds={wounds}
        allowance={MAX_MORTAL_WOUNDS}
        entityName={character.name}
        onClear={(index) => {
          const entry = wounds[index]
          if (entry) clearMortalWound(character.id, entry.slot)
        }}
        outOfWoundsLabel="Knocked Out"
        outOfWoundsTitle="Both Mortal Wounds are filled — reaching 0 HP now knocks this character out (Death Saves)."
      />

      <PanelMeter
        icon={Heart}
        color={appThemeColorVars(appTheme)['--end-bar-color']}
        label="END"
        value={end}
        max={MAX_END}
        onSpend={() => spendEND(character.id, 1)}
        onRestore={() => restoreEND(character.id, 1)}
        spendLabel="Spend Endurance"
        restoreLabel="Restore Endurance"
        title="Endurance — spent on abilities, regained on Recovery"
        continuous
      />

      <div className="gm-encounter__attributes">
        <ul
          className="gm-encounter__attr-list"
          role="list"
          aria-label="Attributes"
        >
          {ATTRIBUTE_LIST.map((attr) => (
            <li
              key={attr.key}
              className="attr-box"
              title={attr.description}
              onClick={() => onClickAttr(character, attributes, attr.key, attr.name)}
            >
              <span className="attr-box__abbr">{attr.abbreviation}</span>
              <span className="attr-box__value">
                {formatAttrValue(attributes[attr.key], character, attr.key)}
              </span>
              <span className="attr-box__name">{attr.name}</span>
            </li>
          ))}
        </ul>
        <div className="gm-encounter__turn">
          <button
            type="button"
            className="btn btn--primary gm-encounter__turn-btn"
            onClick={startTurn}
            title="End turn: unspent AP becomes END, then END Recovery refills AP"
          >
            <RotateCcw size={13} aria-hidden="true" />
            End Turn
          </button>
          <button
            type="button"
            className="btn btn--ghost gm-encounter__turn-btn"
            onClick={handleRecover}
            title="Regain all END (no other actions this turn)"
          >
            Recover
          </button>
        </div>
      </div>

      <div
        className={sheetPresentation.className + ' gm-encounter__sheet'}
        style={sheetPresentation.style}
      >
        <EncounterSheetBody entity={character} mode="view" />
      </div>

      {showDamage && (
        <DamageDialog
          characterId={character.id}
          onClose={() => setShowDamage(false)}
          autoRollMortalWounds
        />
      )}

      {showWoundPicker && (
        <MortalWoundPicker
          entityName={character.name}
          activeNames={wounds.map((w) => w.name)}
          canAdd={canAddWound}
          onPick={addWoundByName}
          onClose={() => setShowWoundPicker(false)}
        />
      )}
    </section>
  )
}

interface EncounterNpcInstanceProps {
  screenId: string
  panel: Extract<ScreenPanel, { kind: 'npc-instance' }>
  base: NonNullable<ResolvedPanel['entity']>
  subtitle: string | null
  onOpenBase: (characterId: string) => void
  onRemove: () => void
}

function EncounterNpcInstance({
  screenId,
  panel,
  base,
  subtitle,
  onOpenBase,
  onRemove,
}: EncounterNpcInstanceProps) {
  const duplicatePanel = useGMScreenStore((s) => s.duplicatePanel)
  const renameInstance = useGMScreenStore((s) => s.renameInstance)
  const setInstanceCondition = useGMScreenStore((s) => s.setInstanceCondition)
  const adjustInstanceHP = useGMScreenStore((s) => s.adjustInstanceHP)
  const clearInstanceMortalWound = useGMScreenStore(
    (s) => s.clearInstanceMortalWound,
  )
  const clearInstanceMortalWounds = useGMScreenStore(
    (s) => s.clearInstanceMortalWounds,
  )
  const addInstanceMortalWound = useGMScreenStore(
    (s) => s.addInstanceMortalWound,
  )
  const spendInstanceAP = useGMScreenStore((s) => s.spendInstanceAP)
  const restoreInstanceAP = useGMScreenStore((s) => s.restoreInstanceAP)
  const { notify } = useNotification()
  const appTheme = useAppThemeStore((s) => s.theme)
  // NPCs have no per-sheet customization, so the body always follows the app
  // theme — the same path a player panel takes with the setting on.
  const sheetPresentation = gmPanelSheetPresentation(base.config, appTheme, true)

  const { activation, startTurn, hasCooldowns, setAbilityUses, setAbilityModifiersActive } =
    useNpcInstanceActivation(screenId, panel, base)

  /**
   * The entity this sheet renders and measures: the base record with this
   * instance's own remaining uses and modifier switches applied (see
   * NpcInstancePanel — a projection, not a copy).
   */
  const entity = useMemo(
    () => withInstanceState(base, panel.state),
    [base, panel.state],
  )
  const stats = useMemo(() => effectiveNPCStats(entity), [entity])
  const attributes = useMemo(() => effectiveAttributes(entity), [entity])

  const [showDamage, setShowDamage] = useState(false)
  const [showWoundPicker, setShowWoundPicker] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const mortalWoundAllowance = npcMortalWoundAllowance(base)
  const canAddWound = panel.state.mortalWounds.length < mortalWoundAllowance
  const hp = Math.max(0, panel.state.currentHP)
  const ap = panel.state.currentAP
  const { condition } = panel.state
  const impaired = condition !== 'active'
  const spent = ap <= 0
  const name = panel.label || base.name

  /** See NpcInstancePanel — the `−` stepper runs the full damage pipeline. */
  const reportSteppedDamage = (result: DamageResult | null) => {
    if (!result) return
    if (!result.downed && !result.causedMortalWound) return
    notify(panelDamageOutcome(name, result, 'DOWNED'), 'error', 5000)
  }

  const addWoundByName = (wound: MortalWound) => {
    if (!addInstanceMortalWound(screenId, panel.id, wound.name)) {
      notify(
        `${name} has no Mortal Wound slot left — clear one first.`,
        'error',
        4000,
      )
      return
    }
    notify(
      `${name} takes a Mortal Wound: ${wound.name} (d20 ${wound.id}).`,
      'error',
      5000,
    )
  }

  const menuItems: PanelMenuItem[] = [
    { label: 'Rename instance...', onSelect: () => setRenaming(true) },
    { label: 'Duplicate instance', onSelect: () => duplicatePanel(screenId, panel.id) },
    { label: 'Open base sheet', onSelect: () => onOpenBase(base.id) },
    { label: 'Start new turn', onSelect: startTurn },
    ...(canAddWound
      ? [{ label: 'Add mortal wound...', onSelect: () => setShowWoundPicker(true) }]
      : []),
    ...(panel.state.mortalWounds.length > 0
      ? [
          {
            label: 'Clear mortal wounds',
            onSelect: () => clearInstanceMortalWounds(screenId, panel.id),
          },
        ]
      : []),
    ...(condition === 'dead'
      ? [{ label: 'Mark alive', onSelect: () => setInstanceCondition(screenId, panel.id, 'active') }]
      : [{ label: 'Mark dead', onSelect: () => setInstanceCondition(screenId, panel.id, 'dead') }]),
    ...(condition === 'downed'
      ? []
      : [{ label: 'Mark downed', onSelect: () => setInstanceCondition(screenId, panel.id, 'downed') }]),
    { label: 'Remove panel', onSelect: onRemove, danger: true },
  ]

  return (
    <section
      className={
        'gm-panel gm-encounter gm-encounter--npc' +
        (impaired ? ` gm-panel--${condition}` : '') +
        (spent ? ' gm-panel--no-ap' : '')
      }
    >
      <PanelHeader
        portrait={base.portrait}
        name={name}
        subtitle={subtitle}
        density="expanded"
        onDensityChange={() => {}}
        showDensityToggle={false}
        menuItems={menuItems}
        tokens={buildHeaderTokens('npc', entity, stats)}
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
        name={name}
        hp={hp}
        maxHP={stats.hp}
        tempHP={panel.state.tempHP}
        onDamage={() => reportSteppedDamage(adjustInstanceHP(screenId, panel.id, -1))}
        onHeal={() => adjustInstanceHP(screenId, panel.id, 1)}
        onOpenDamageDialog={() => setShowDamage(true)}
        statuses={
          <PanelStatuses
            screenId={screenId}
            panel={panel}
            entityName={name}
          />
        }
      />

      <div className="gm-encounter__row">
        <PanelMeter
          icon={Zap}
          color={appThemeColorVars(appTheme)['--ap-bar-color']}
          label="AP"
          value={ap}
          max={MAX_AP}
          onSpend={() => spendInstanceAP(screenId, panel.id, 1)}
          onRestore={() => restoreInstanceAP(screenId, panel.id, 1)}
          spendLabel="Spend Action Points"
          restoreLabel="Restore Action Points"
          title="Action Points for this turn"
        />
        {hasCooldowns && (
          <span
            className="gm-ap__cooling"
            title="Abilities on Recharge cooldown, waiting for the next turn's Recharge Die"
          >
            <Hourglass size={12} aria-hidden="true" />
            {panel.state.cooldowns.length} on cooldown
          </span>
        )}
      </div>

      <PanelMortalWounds
        wounds={panel.state.mortalWounds}
        allowance={mortalWoundAllowance}
        entityName={name}
        onClear={(index) => clearInstanceMortalWound(screenId, panel.id, index)}
        outOfWoundsTitle="This NPC has no Mortal Wounds left — reaching 0 HP now downs it."
      />

      <div className="gm-encounter__attributes">
        <ul
          className="gm-encounter__attr-list"
          role="list"
          aria-label="Attributes"
        >
          {ATTRIBUTE_LIST.map((attr) => (
            <li
              key={attr.key}
              className="attr-box"
              title={attr.description}
              onClick={() => onClickAttr(entity, attributes, attr.key, attr.name)}
            >
              <span className="attr-box__abbr">{attr.abbreviation}</span>
              <span className="attr-box__value">
                {formatAttrValue(attributes[attr.key], entity, attr.key)}
              </span>
              <span className="attr-box__name">{attr.name}</span>
            </li>
          ))}
        </ul>
        <div className="gm-encounter__turn">
          <button
            type="button"
            className="btn btn--primary gm-encounter__turn-btn"
            onClick={startTurn}
            title="Refill Action Points and roll the Recharge Die"
          >
            <RotateCcw size={13} aria-hidden="true" />
            End Turn
          </button>
        </div>
      </div>

      <div
        className={sheetPresentation.className + ' gm-encounter__sheet'}
        style={sheetPresentation.style}
      >
        <EncounterSheetBody
          entity={entity}
          mode="view"
          npcActivation={activation}
          npcOnSetUses={setAbilityUses}
          npcOnToggleModifiers={setAbilityModifiersActive}
        />
      </div>

      {showDamage && (
        <DamageDialog
          npcInstance={{
            screenId,
            panelId: panel.id,
            label: name,
            base: entity,
            currentHP: panel.state.currentHP,
            tempHP: panel.state.tempHP,
          }}
          onClose={() => setShowDamage(false)}
        />
      )}

      {showWoundPicker && (
        <MortalWoundPicker
          entityName={name}
          activeNames={panel.state.mortalWounds.map((w) => w.name)}
          canAdd={canAddWound}
          onPick={addWoundByName}
          onClose={() => setShowWoundPicker(false)}
        />
      )}
    </section>
  )
}
