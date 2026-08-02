/**
 * NPCSheet — the full NPC sheet layout.
 *
 * Simpler and more portable than the CharacterSheet. NPCs are STATIC
 * REFERENCES: no health bars, AP tracking, death saves, milestones, or
 * live-play trackers. The user can still make dice rolls by clicking on
 * Attributes, Skills, and Ability damage notation.
 *
 * Layout order (top → bottom):
 *   1. Hero Section — portrait, name, Export button
 *   2. Combat Stats — Evasion, Armor, Movement, Save DC, HP (static tokens)
 *   3. Attributes — MAR, POW, AGI, VIT, GRT (clickable to roll)
 *   4. Abilities — AbilityBlockCards (Activate button always hidden)
 *   5. Skills — skill list (clickable to roll)
 *   6. Description — long-form text field
 *
 * The `mode` prop controls editability: "edit" makes fields editable,
 * "view" makes them read-only.
 *
 * Futureproofing: the NPCSheet accepts an `npc` prop directly (not just from
 * the store), so it can be embedded inside a CharacterSheet custom tab in the
 * future. When `npc` is not provided, it falls back to the store's
 * `currentCharacter`.
 */

import { useState } from 'react'

import { useCharacterStore } from '@/store/characterStore'
import { colorVars } from '@/lib/themeUtils'
import { useImportedFonts } from '@/hooks/useImportedFonts'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import NPCDescriptionSection from '@/components/sheet/npc/NPCDescriptionSection'
import NPCHeroSection from '@/components/sheet/npc/NPCHeroSection'
import NPCStatsSection from '@/components/sheet/npc/NPCStatsSection'
import NPCExportDialog from '@/components/sheet/npc/NPCExportDialog'
import AttributesSection from '@/components/sheet/AttributesSection'
import SkillsSection from '@/components/sheet/SkillsSection'

import '@/components/sheet/sheet.css'

export interface NPCSheetProps {
  /** The NPC to display. Falls back to store's currentCharacter if omitted. */
  npc?: Character
  mode?: SheetMode
  onModeChange?: (mode: SheetMode) => void
}

export default function NPCSheet({
  npc,
  mode = 'view',
  onModeChange,
}: NPCSheetProps) {
  const storeNpc = useCharacterStore((s) => s.currentCharacter)
  const updateSectionViewMode = useCharacterStore((s) => s.updateSectionViewMode)
  const setAbilitiesViewMode = (m: 'grid' | 'list') =>
    updateSectionViewMode('slottedAbilities', m)

  const EMPTY_FONTS: never[] = []
  const importedFonts = useCharacterStore(
    (s) => s.currentCharacter?.config.importedFonts ?? EMPTY_FONTS,
  )
  useImportedFonts(importedFonts)

  const entity = npc ?? storeNpc
  const [showExport, setShowExport] = useState(false)

  if (!entity) return null

  const isNPC = entity.kind === 'npc'
  const { config } = entity
  const styleVars = {
    '--sheet-bg': config.backgroundColor,
    '--sheet-heading-font': config.sectionHeadingFontFamily,
    '--sheet-heading-weight': config.sectionHeadingFontWeight,
    '--sheet-label-font': config.labelFontFamily,
    '--sheet-text-font': config.textFontFamily,
    '--sheet-helper-font': config.helperTextFontFamily,
    ...colorVars(config.colors),
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
      {onModeChange && (
        <div
          className="mode-toggle mode-toggle--floating"
          role="tablist"
          aria-label="NPC sheet mode"
        >
          <button
            className={
              'mode-toggle__btn' +
              (mode === 'view' ? ' mode-toggle__btn--active' : '')
            }
            type="button"
            role="tab"
            aria-selected={mode === 'view'}
            onClick={() => onModeChange('view')}
          >
            View
          </button>
          <button
            className={
              'mode-toggle__btn' +
              (mode === 'edit' ? ' mode-toggle__btn--active' : '')
            }
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => onModeChange('edit')}
          >
            Edit
          </button>
        </div>
      )}

      <NPCHeroSection
        npc={entity}
        mode={mode}
        onExport={() => setShowExport(true)}
      />

      <NPCStatsSection npc={entity} mode={mode} />

      <AttributesSection
        character={entity}
        attributes={entity.attributes}
        mode={mode}
        variant="cards"
      />

      {isNPC && (
        <NPCAbilitiesSection
          abilities={entity.slottedAbilities}
          mode={mode}
          viewMode={entity.viewModes.slottedAbilities}
          onViewModeChange={setAbilitiesViewMode}
        />
      )}

      <div className="character-sheet__bottom">
        <SkillsSection character={entity} skills={entity.skills} mode={mode} />
        <NPCDescriptionSection npc={entity} mode={mode} />
      </div>

      {showExport && (
        <NPCExportDialog
          open={showExport}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
