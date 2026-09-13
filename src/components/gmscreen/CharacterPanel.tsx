/**
 * CharacterPanel — a GM Screen panel bound to a live player `Character`.
 *
 * The panel is a **reference**, not a copy: every HP/AP/END/FP change made
 * here goes through the id-targeted `characterStore` actions and is therefore
 * the exact state that player sees on their own sheet, and vice versa.
 *
 * - **Compact** (default): portrait, name, HP bar with −/+/damage affordances,
 *   the GM's tracked status pills inline with the HP number, the character's
 *   **Mortal Wound track**, and the key stat tokens — one glance-height card.
 * - **Expanded**: the live-play sheet sections rendered inline inside a
 *   `colorVars()` container, so by default the character's own customization
 *   applies. Expanded panels are deliberately read-only live-play views; full
 *   editing happens on the sheet page ("Open sheet" in the panel menu).
 *
 * Mortal Wounds read and behave exactly as they do on an NPC instance panel
 * (same `PanelMortalWounds` row under the HP bar, same per-wound ✕ and menu
 * clear, same `⚠ Next 0 HP` warning), with one deliberate difference in the
 * roll: damage dealt **from this panel** resolves the D20 immediately
 * (`takePanelDamage`), because a GM mid-turn has no Mortal Wound card to press,
 * while damage the player takes on their own sheet still parks the slot on
 * "Pending Roll" for them to roll. A wound left pending that way shows as a
 * dashed `?` chip, and the ⋯ menu carries **Roll Mortal Wound (d20)** for it, so
 * the track is always resolvable from the screen — through the menu rather than
 * a button in the row, which stays the same shape on both panel kinds (and the
 * same one line at phone widths). The expanded body suppresses its own copy
 * (`hideMortalWounds`) — the chrome row is the panel's one reading of it, the
 * same rule HP and AP follow.
 *
 * The panel's own chrome — including its stat tokens — follows the **app
 * theme**, never the sheet's palette. The GM Screen shows several sheets side
 * by side, so per-sheet token colors would make every panel read differently
 * and destroy the at-a-glance consistency that is the point of the screen. The
 * sheet's palette is injected only inside the expanded sheet content, where
 * the player's customization belongs — and even there the GM can turn it off:
 * Settings → GM Screen → "Match app theme" makes the expanded body render
 * exactly like an NPC panel (app theme palette, no per-sheet background or
 * fonts). That switch is cosmetic and panel-scoped; it reads the config and
 * never writes it, so the character's own sheet keeps every custom color.
 */

import { useState } from 'react'
import { Heart, Pencil, Shield, Sparkles, Swords, Wind } from 'lucide-react'

import DamageDialog from '@/components/sheet/DamageDialog'
import MortalWoundPicker from '@/components/sheet/MortalWoundPicker'
import PanelHeader, { type PanelMenuItem } from '@/components/gmscreen/PanelHeader'
import PanelApBar from '@/components/gmscreen/PanelApBar'
import PanelExpand from '@/components/gmscreen/PanelExpand'
import PanelHpBar from '@/components/gmscreen/PanelHpBar'
import PanelMortalWounds from '@/components/gmscreen/PanelMortalWounds'
import PanelSheet from '@/components/gmscreen/PanelSheet'
import PanelStatuses from '@/components/gmscreen/PanelStatuses'
import { MAX_MORTAL_WOUNDS } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { useNotification } from '@/context/NotificationContext'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { effectiveCombatStats } from '@/lib/abilityModifiers'
import { panelDamageOutcome } from '@/lib/gmScreenUtils'
import {
  PENDING_MORTAL_WOUND,
  characterMortalWounds,
  nextMortalWoundSlot,
} from '@/lib/mortalWounds'
import { appThemeColorVars, appThemeStatColors, gmPanelSheetPresentation } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useGmPanelThemeStore } from '@/store/gmPanelThemeStore'
import type { DamageResult } from '@/store/characterStore'
import type { Character, MortalWound, ScreenPanel } from '@/types'

export interface CharacterPanelProps {
  panel: Extract<ScreenPanel, { kind: 'character' }>
  character: Character
  screenId: string
  onOpenSheet: () => void
  onRemove: () => void
}

export default function CharacterPanel({
  panel,
  character,
  screenId,
  onOpenSheet,
  onRemove,
}: CharacterPanelProps) {
  const setPanelDensity = useGMScreenStore((s) => s.setPanelDensity)
  const heal = useCharacterStore((s) => s.heal)
  // The panel's damage pipeline: `takeDamage` plus the D20 the GM would
  // otherwise have no card to roll (see the component doc). The player's own
  // sheet keeps plain `takeDamage`, so their Mortal Wound card still appears
  // for a hit they took there.
  const takePanelDamage = useCharacterStore((s) => s.takePanelDamage)
  const rollMortalWound = useCharacterStore((s) => s.rollMortalWound)
  const addMortalWound = useCharacterStore((s) => s.addMortalWound)
  const clearMortalWound = useCharacterStore((s) => s.clearMortalWound)
  const clearMortalWounds = useCharacterStore((s) => s.clearMortalWounds)
  const spendAP = useCharacterStore((s) => s.spendAP)
  const restoreAP = useCharacterStore((s) => s.restoreAP)
  // Ending a turn is the same store action the sheet's own End Turn button
  // runs: unspent AP converts to END 1:1, then END Recovery is applied and AP
  // is refilled — one implementation, two surfaces.
  const endTurn = useCharacterStore((s) => s.endTurn)
  const appTheme = useAppThemeStore((s) => s.theme)
  // Settings → GM Screen: when on, the expanded body follows the app theme
  // exactly like an NPC panel instead of the character's own customization.
  // The setting is read from localStorage-backed store state, never written
  // back to the character — this panel is the only thing it changes.
  const matchAppTheme = useGmPanelThemeStore((s) => s.matchAppTheme)
  const { notify } = useNotification()
  const [showDamage, setShowDamage] = useState(false)
  const [showWoundPicker, setShowWoundPicker] = useState(false)

  // Panel-chrome colors — the app theme's palette, deliberately NOT the
  // character's own `config.colors` (see the component doc). Only the resource
  // tokens use this: Eva/Arm are combat stats and take `statColors` instead, so
  // the chrome and the body's Combat Stats row agree.
  const tokenColors = appThemeColorVars(appTheme)
  const statColors = appThemeStatColors(appTheme)
  const sheetPresentation = gmPanelSheetPresentation(
    character.config,
    appTheme,
    matchAppTheme,
  )

  const stats = effectiveCombatStats(character)
  const maxHP = stats.maxHP
  const hp = Math.max(0, character.currentHP)
  const ap = character.currentAP
  // Out of AP = out of actions for this turn: the panel dims (except its AP
  // block, which holds the `+` stepper and the turn button). See gmscreen.css.
  const spent = ap <= 0

  // The character's Mortal Wound slots in the panel row's `{ roll, name }`
  // shape, each carrying the slot it belongs to. `character.mortalWounds` is a
  // fixed two-slot array of names (a slot the player still has to roll reads
  // "Pending Roll"), so an empty slot leaves no entry and — because slots can
  // be cleared out of order — an entry's position in this list is NOT its slot
  // index, which is why the shared helper keeps both.
  const wounds = characterMortalWounds(character.mortalWounds)
  // A slot the player's own sheet left unresolved (never one this panel dealt —
  // its damage rolls as it lands). The panel menu carries the roll for it.
  const pendingWound = wounds.some(({ name }) => name === PENDING_MORTAL_WOUND)
  // A slot that can still take a name: empty, or one of those pending wounds —
  // naming it by hand is the manual add's job (see the ⋯ menu).
  const canAddWound = nextMortalWoundSlot(character.mortalWounds) !== -1

  /**
   * Announce what the panel's own `−` stepper just did. Stepping HP runs the
   * full damage pipeline, so it can auto-roll a Mortal Wound and reset the HP
   * to max — an outcome that would otherwise look like nothing happened. The
   * Damage… dialog reports its own results (and says the same thing).
   */
  const reportSteppedDamage = (result: DamageResult | null) => {
    if (!result) return
    if (!result.knockedOut && !result.causedMortalWound) return
    notify(panelDamageOutcome(character.name, result, 'KNOCKED OUT'), 'error', 5000)
  }

  const startTurn = () => {
    const gained = endTurn(character.id)
    notify(
      gained > 0
        ? `${character.name}'s turn — AP restored · +${gained} END`
        : `${character.name}'s turn — AP replenished`,
      gained > 0 ? 'success' : 'info',
    )
  }

  /**
   * Apply the wound the GM picked by name, skipping the D20 — the manual
   * counterpart of the menu's roll, writing the character's real slots so the
   * player's own sheet shows it immediately. The picker stays open, so a track
   * that fills up mid-dialog re-renders it locked (see `canAddWound`).
   */
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
    { label: 'Open sheet', onSelect: onOpenSheet },
    // The turn button appears by itself once AP runs out; the menu entry keeps
    // an early turn possible without spending down first (same pairing as an
    // NPC instance panel).
    { label: 'Start new turn', onSelect: startTurn },
    // A slot the player's own sheet left unresolved. The roll lives here rather
    // than in the wound row so that row stays the same shape on both panel
    // kinds — and the same one line at phone widths, where a button beside the
    // chips would push the row past the panel's edge.
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
    // The manual path: a wound something named outright (an ability in play, a
    // GM ruling). Same place, same reason as the roll above — and the same
    // picker the player's sheet opens, so a wound chosen at the table and one
    // chosen on the sheet cannot disagree.
    ...(canAddWound
      ? [{ label: 'Add mortal wound…', onSelect: () => setShowWoundPicker(true) }]
      : []),
    // Wounds persist until something clears them (an ability in play, or the
    // sheet's Rest) — this is the panel's Rest for the wound track, exactly as
    // on an NPC panel. It touches nothing else: HP, END, AP and ability uses
    // are left alone.
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

  const expanded = panel.density === 'expanded'

  return (
    <section
      className={
        'gm-panel gm-panel--character' +
        (expanded ? ' gm-panel--expanded' : '') +
        (spent ? ' gm-panel--no-ap' : '')
      }
    >
      <PanelHeader
        portrait={character.portrait}
        name={character.name}
        subtitle={expanded ? character.playerName || null : null}
        density={panel.density}
        onDensityChange={(d) => setPanelDensity(screenId, panel.id, d)}
        menuItems={menuItems}
        badge={
          <span className="gm-panel__badge" title={`${character.milestones} milestones`}>
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

      {/* The character's Mortal Wound track, in the same row an NPC instance
        * panel uses. A character always allows two, so the row is always
        * present (an NPC whose base allows wounds shows its empty track too) and
        * doubles as the at-a-glance allowance read-out. Wounds live on the
        * character record, so clearing one here is visible on their own
        * sheet — and vice versa. */}
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

      {/* The character's own turn budget, in the panel chrome and directly
        * under the HP bar — matching an NPC instance panel exactly. The sheet
        * body's copy is suppressed (see PanelSheet's `hideAP`) so AP is never
        * printed twice in one panel; the store action is the character's real
        * AP, shared with the player's own sheet. */}
      <PanelApBar
        ap={ap}
        onSpend={() => spendAP(character.id, 1)}
        onRestore={() => restoreAP(character.id, 1)}
        onStartTurn={startTurn}
        startTurnTitle="End turn: unspent AP becomes END, then END Recovery refills AP"
      />

      {/* No AP token: the meter above carries it now, exactly as on an NPC
        * panel (which has no AP token either). END and FP have no chrome bar,
        * so their tokens stay the at-a-glance read-out.
        *
        * Eva and Arm take the app theme's SHARED stat palette — the same source
        * the expanded body's Combat Stats row uses, and the same colors an NPC
        * panel puts on the same two stats. END/FP keep the resource-bar colors
        * (they are pools, not combat stats, and sit beside their own bars). */}
      <div className="gm-tokens">
        <span className="gm-token" style={{ '--token-color': statColors.evasion } as React.CSSProperties}>
          <Wind size={13} /> <span className="gm-token__label">Eva</span>
          <span className="gm-token__value">{stats.evasion}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': statColors.armor } as React.CSSProperties}>
          <Shield size={13} /> <span className="gm-token__label">Arm</span>
          <span className="gm-token__value">{stats.armor}</span>
        </span>
        {/* Every token leads with an icon, END and FP included: their pools are
          * both violet in most themes (and AP's is the same hue), so the glyph
          * is what tells them apart at a glance. Heart is the icon the sheet
          * already uses for END (its END Recovery stat token); Sparkles marks
          * Fate. */}
        <span className="gm-token" style={{ '--token-color': tokenColors['--end-bar-color'] } as React.CSSProperties}>
          <Heart size={13} /> <span className="gm-token__label">END</span>
          <span className="gm-token__value">{character.currentEND}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': tokenColors['--fp-bar-color'] } as React.CSSProperties}>
          <Sparkles size={13} /> <span className="gm-token__label">FP</span>
          <span className="gm-token__value">{character.currentFP}</span>
        </span>
        <button
          type="button"
          className="btn btn--icon gm-token gm-token--edit"
          onClick={onOpenSheet}
          aria-label={`Open ${character.name}'s sheet`}
          title="Open full sheet"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* The panel content brings the character's OWN customization, exactly
        * as CharacterSheet does — the GM Screen chrome itself stays on the app
        * theme. The body is the shared PanelSheet so player and NPC panels
        * read identically, and `gmPanelSheetPresentation` is the single place
        * that decides which palette the body gets: the sheet's own, or (with
        * the "Match app theme" setting on) the app theme's, which is the very
        * same rendering an NPC panel uses. */}
      <PanelExpand open={expanded}>
        <div
          className={sheetPresentation.className}
          style={sheetPresentation.style}
        >
          <PanelSheet entity={character} mode="view" hideAP hideMortalWounds />
        </div>
      </PanelExpand>

      {showDamage && (
        <DamageDialog
          characterId={character.id}
          onClose={() => setShowDamage(false)}
          // Same rule as the `−` stepper: damage dealt from a panel resolves
          // its Mortal Wounds for the GM instead of leaving the player's card
          // waiting (see the component doc).
          autoRollMortalWounds
        />
      )}

      {/* The manual add, opened from the ⋯ menu. It writes the character's real
        * slots (so the player's own sheet shows the wound at once) and, like
        * the Add Status picker, stays open across picks — a dialog that closed
        * on each pick would send the GM back through the ⋯ menu for a second
        * wound. It portals itself to `document.body`, so no panel state
        * (a downed dim, the no-AP fade) can reach it. */}
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
