/**
 * CharacterPanel — a GM Screen panel bound to a live player `Character`.
 *
 * The panel is a **reference**, not a copy: every HP/AP/END/FP change made
 * here goes through the id-targeted `characterStore` actions and is therefore
 * the exact state that player sees on their own sheet, and vice versa.
 *
 * - **Compact** (default): portrait, name, HP bar with −/+/damage affordances,
 *   the GM's tracked status pills inline with the HP number, and the key stat
 *   tokens — one glance-height card.
 * - **Expanded**: the live-play sheet sections rendered inline inside a
 *   `colorVars()` container, so by default the character's own customization
 *   applies. Expanded panels are deliberately read-only live-play views; full
 *   editing happens on the sheet page ("Open sheet" in the panel menu).
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
import PanelHeader, { type PanelMenuItem } from '@/components/gmscreen/PanelHeader'
import PanelApBar from '@/components/gmscreen/PanelApBar'
import PanelExpand from '@/components/gmscreen/PanelExpand'
import PanelHpBar from '@/components/gmscreen/PanelHpBar'
import PanelSheet from '@/components/gmscreen/PanelSheet'
import PanelStatuses from '@/components/gmscreen/PanelStatuses'
import { useCharacterStore } from '@/store/characterStore'
import { useNotification } from '@/context/NotificationContext'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { effectiveCombatStats } from '@/lib/abilityModifiers'
import { appThemeColorVars, appThemeStatColors, gmPanelSheetPresentation } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useGmPanelThemeStore } from '@/store/gmPanelThemeStore'
import type { Character, ScreenPanel } from '@/types'

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
  const takeDamage = useCharacterStore((s) => s.takeDamage)
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

  const startTurn = () => {
    const gained = endTurn(character.id)
    notify(
      gained > 0
        ? `${character.name}'s turn — AP restored · +${gained} END`
        : `${character.name}'s turn — AP replenished`,
      gained > 0 ? 'success' : 'info',
    )
  }

  const menuItems: PanelMenuItem[] = [
    { label: 'Open sheet', onSelect: onOpenSheet },
    // The turn button appears by itself once AP runs out; the menu entry keeps
    // an early turn possible without spending down first (same pairing as an
    // NPC instance panel).
    { label: 'Start new turn', onSelect: startTurn },
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
        onDamage={() => takeDamage(character.id, 1)}
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
          <PanelSheet entity={character} mode="view" hideAP />
        </div>
      </PanelExpand>

      {showDamage && (
        <DamageDialog
          characterId={character.id}
          onClose={() => setShowDamage(false)}
        />
      )}
    </section>
  )
}
