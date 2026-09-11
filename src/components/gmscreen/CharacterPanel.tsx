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
 *   `colorVars()` container so the character's own customization still applies.
 *   Expanded panels are deliberately read-only live-play views; full editing
 *   happens on the sheet page ("Open sheet" in the panel menu).
 *
 * The panel's own chrome — including its stat tokens — follows the **app
 * theme**, never the sheet's palette. The GM Screen shows several sheets side
 * by side, so per-sheet token colors would make every panel read differently
 * and destroy the at-a-glance consistency that is the point of the screen. The
 * sheet's palette is injected only inside the expanded sheet content, where
 * the player's customization belongs.
 */

import { useState } from 'react'
import { HeartPulse, Pencil, Shield, Swords, Wind } from 'lucide-react'

import DamageDialog from '@/components/sheet/DamageDialog'
import PanelHeader, { type PanelMenuItem } from '@/components/gmscreen/PanelHeader'
import PanelExpand from '@/components/gmscreen/PanelExpand'
import PanelSheet from '@/components/gmscreen/PanelSheet'
import PanelStatuses from '@/components/gmscreen/PanelStatuses'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { effectiveCombatStats } from '@/lib/abilityModifiers'
import { appThemeColorVars, colorVars } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
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
  const appTheme = useAppThemeStore((s) => s.theme)
  const [showDamage, setShowDamage] = useState(false)

  // Panel-chrome colors — the app theme's palette, deliberately NOT the
  // character's own `config.colors` (see the component doc).
  const tokenColors = appThemeColorVars(appTheme)

  const stats = effectiveCombatStats(character)
  const maxHP = stats.maxHP
  const hp = Math.max(0, character.currentHP)

  const menuItems: PanelMenuItem[] = [
    { label: 'Open sheet', onSelect: onOpenSheet },
    { label: 'Remove panel', onSelect: onRemove, danger: true },
  ]

  const expanded = panel.density === 'expanded'

  return (
    <section className={'gm-panel gm-panel--character' + (expanded ? ' gm-panel--expanded' : '')}>
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

      <div className="gm-hp">
        <div className="gm-hp__row">
          <HeartPulse size={14} className="gm-hp__icon" aria-hidden="true" />
          <span className="gm-hp__label">HP</span>
          <span className="gm-hp__value">
            {hp}
            <span className="gm-hp__max">/{maxHP}</span>
          </span>
          {character.tempHP > 0 && (
            <span className="gm-hp__temp" title="Temporary HP (absorbed first)">
              +{character.tempHP}
            </span>
          )}
          {/* Statuses the GM is tracking: inline with the HP number, on one
            * scrollable line so they can never make the panel taller. */}
          <PanelStatuses
            screenId={screenId}
            panel={panel}
            entityName={character.name}
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
            onClick={() => takeDamage(character.id, 1)}
            aria-label={`Deal 1 damage to ${character.name}`}
            title="−1 HP"
          >
            −
          </button>
          <button
            type="button"
            className="btn btn--icon gm-hp__step"
            onClick={() => heal(character.id, 1)}
            aria-label={`Heal ${character.name} 1 HP`}
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
        <span className="gm-token" style={{ '--token-color': tokenColors['--color-token-evasion'] } as React.CSSProperties}>
          <Wind size={13} /> <span className="gm-token__label">Eva</span>
          <span className="gm-token__value">{stats.evasion}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': tokenColors['--color-token-armor'] } as React.CSSProperties}>
          <Shield size={13} /> <span className="gm-token__label">Arm</span>
          <span className="gm-token__value">{stats.armor}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': tokenColors['--ap-bar-color'] } as React.CSSProperties}>
          <span className="gm-token__label">AP</span>
          <span className="gm-token__value">{character.currentAP}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': tokenColors['--end-bar-color'] } as React.CSSProperties}>
          <span className="gm-token__label">END</span>
          <span className="gm-token__value">{character.currentEND}</span>
        </span>
        <span className="gm-token" style={{ '--token-color': tokenColors['--fp-bar-color'] } as React.CSSProperties}>
          <span className="gm-token__label">FP</span>
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
        * read identically. */}
      <PanelExpand open={expanded}>
        <div
          className={
            'character-sheet character-sheet--view gm-panel__sheet' +
            (character.config.hideSectionBackground ? ' character-sheet--flat' : '')
          }
          style={{
            '--sheet-bg': character.config.backgroundColor,
            '--sheet-heading-font': character.config.sectionHeadingFontFamily,
            '--sheet-heading-weight': character.config.sectionHeadingFontWeight,
            '--sheet-label-font': character.config.labelFontFamily,
            '--sheet-text-font': character.config.textFontFamily,
            '--sheet-helper-font': character.config.helperTextFontFamily,
            ...colorVars(character.config.colors),
          } as React.CSSProperties}
        >
          <PanelSheet entity={character} mode="view" />
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
