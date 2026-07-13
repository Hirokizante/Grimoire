/**
 * CharacterSheet — the full character sheet layout.
 *
 * The sheet uses a **vertical flex layout** with a fixed section hierarchy.
 * Sections never shift position when abilities are added or removed — dynamic
 * content is contained within bounded sections (Core Ability, Slotted
 * Abilities, Ability Pool).
 *
 * Layout order (top → bottom):
 *   1. Hero Section — portrait, name, Combat Stats, Attributes (horizontal)
 *   2. Core Ability — innate, basic attack, fatebreaker
 *   3. Slotted Abilities — draggable card grid (max 3 per row)
 *   4. Ability Pool — draggable card grid (max 3 per row)
 *   5. Skills — skill list
 *   6. Bio — physical description, backstory
 *
 * The `mode` prop controls editability: "edit" makes fields editable,
 * "view" makes them read-only (for live sessions).
 */

import { useState } from 'react'
import CustomizationPanel from '@/components/sheet/CustomizationPanel'

import { useCharacterStore } from '@/store/characterStore'
import type { Character, SheetColors } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

import AbilitiesDndContext from '@/components/sheet/AbilitiesDndContext'
import AbilityPoolSection from '@/components/sheet/AbilityPoolSection'
import CoreAbilitySection from '@/components/sheet/CoreAbilitySection'
import ExportDialog from '@/components/sheet/ExportDialog'
import HeroSection from '@/components/sheet/HeroSection'
import MilestoneDialog from '@/components/sheet/MilestoneDialog'
import ProfileSection from '@/components/sheet/ProfileSection'
import SkillsSection from '@/components/sheet/SkillsSection'
import SlottedAbilitiesSection from '@/components/sheet/SlottedAbilitiesSection'

import '@/components/sheet/sheet.css'

export interface CharacterSheetProps {
  character?: Character
  mode?: SheetMode
  onModeChange?: (mode: SheetMode) => void
}

/**
 * Map a SheetColors object onto CSS custom properties. This is the single
 * injection point that drives the entire per-character theme.
 */
function colorVars(colors: SheetColors): Record<string, string> {
  return {
    '--bg-base': colors.bgBase,
    '--bg-surface': colors.bgSurface,
    '--bg-surface-raised': colors.bgSurfaceRaised,
    '--bg-surface-hover': colors.bgSurfaceHover,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-muted': colors.textMuted,
    '--border': colors.border,
    '--border-soft': colors.borderSoft,
    '--accent-violet': colors.accent,
    '--accent-violet-soft': colors.accentSoft,
    '--accent-blush': colors.hpBar,
    '--danger': colors.danger,
    '--danger-hover': shift(colors.danger, 16),
    '--color-minor-ability': colors.minorAbility,
    '--color-success': colors.success,
    '--hp-bar-color': colors.hpBar,
    '--fp-bar-color': colors.fpBar,
    '--ap-bar-color': colors.apBar,
    '--end-bar-color': colors.endBar,
  }
}

/**
 * Lighten or darken a hex color by `amt` (0-255 each channel cap). Positive
 * lightens toward white, negative darkens toward black.
 */
function shift(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amt))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export default function CharacterSheet({
  character,
  mode = 'view',
  onModeChange,
}: CharacterSheetProps) {
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const char = character ?? storeCharacter
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [abilitiesViewMode, setAbilitiesViewMode] = useState<'grid' | 'list'>('grid')

  if (!char) return null

  const { config } = char
  const c = config.colors
  const styleVars = {
    '--sheet-bg': config.backgroundColor,
    '--sheet-heading-font': config.sectionHeadingFontFamily,
    '--sheet-heading-weight': config.sectionHeadingFontWeight,
    '--sheet-label-font': config.labelFontFamily,
    '--sheet-text-font': config.textFontFamily,
    '--sheet-helper-font': config.helperTextFontFamily,
    ...colorVars(c),
  } as React.CSSProperties

  return (
    <div
      className={
        'character-sheet' +
        (config.hideSectionBackground ? ' character-sheet--flat' : '') +
        (mode === 'edit' ? ' character-sheet--edit' : ' character-sheet--view')
      }
      style={styleVars}
    >
      {config.customCss && (
        <style
          dangerouslySetInnerHTML={{ __html: config.customCss }}
        />
      )}

      {onModeChange && (
        <div className="mode-toggle mode-toggle--floating" role="tablist" aria-label="Sheet mode">
          <button
            className={'mode-toggle__btn' + (mode === 'view' ? ' mode-toggle__btn--active' : '')}
            type="button"
            role="tab"
            aria-selected={mode === 'view'}
            onClick={() => onModeChange('view')}
          >
            View
          </button>
          <button
            className={'mode-toggle__btn' + (mode === 'edit' ? ' mode-toggle__btn--active' : '')}
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => onModeChange('edit')}
          >
            Edit
          </button>
        </div>
      )}

      <HeroSection character={char} mode={mode} onLevelUp={() => setShowMilestoneDialog(true)} onCustomize={() => setShowCustomize(true)} onExport={() => setShowExport(true)} />

      <CustomizationPanel
        open={showCustomize}
        onClose={() => setShowCustomize(false)}
      />

      <CoreAbilitySection
        innateDescription={char.innateDescription}
        innateAbility={char.innateAbility}
        basicAttack={char.basicAttack}
        fatebreaker={char.fatebreaker}
        mode={mode}
      />

      <AbilitiesDndContext
        maxSlots={char.maxAbilitySlots}
        slottedAbilities={char.slottedAbilities}
      >
        <SlottedAbilitiesSection
          abilities={char.slottedAbilities}
          maxSlots={char.maxAbilitySlots}
          mode={mode}
          viewMode={abilitiesViewMode}
          onViewModeChange={setAbilitiesViewMode}
        />

        <AbilityPoolSection
          abilities={char.abilityPool}
          mode={mode}
          viewMode={abilitiesViewMode}
          onViewModeChange={setAbilitiesViewMode}
        />
      </AbilitiesDndContext>

      <div className="character-sheet__bottom">
        <SkillsSection character={char} skills={char.skills} mode={mode} />
        <ProfileSection
          name={char.name}
          portrait={char.portrait}
          physicalDescription={char.physicalDescription}
          backstory={char.backstory}
          mode={mode}
        />
      </div>

      {showMilestoneDialog && (
        <MilestoneDialog onClose={() => setShowMilestoneDialog(false)} />
      )}

      {showExport && (
        <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}
