/**
 * CharacterSheet — the full read-only character sheet layout.
 *
 * Receives a character via props (preferred) or falls back to the currently-
 * selected character in the Zustand store. Applies the player's sheet config
 * (background color, font families, custom CSS) as CSS variables on a scoped
 * wrapper so the customization stays local to the sheet (DESIGN.md "Sheet
 * Customization").
 *
 * The layout uses a responsive multi-column flow: three columns on desktop,
 * two on tablet, and a single stacked column on mobile. Sections avoid
 * breaking across columns so each stays visually whole.
 */

import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'

import AbilityPoolSection from '@/components/sheet/AbilityPoolSection'
import AttributesSection from '@/components/sheet/AttributesSection'
import CoreAbilitySection from '@/components/sheet/CoreAbilitySection'
import ProfileSection from '@/components/sheet/ProfileSection'
import SkillsSection from '@/components/sheet/SkillsSection'
import SlottedAbilitiesSection from '@/components/sheet/SlottedAbilitiesSection'
import StatsSection from '@/components/sheet/StatsSection'

import '@/components/sheet/sheet.css'

export interface CharacterSheetProps {
  /** Character to render. Falls back to the store's current character. */
  character?: Character
}

export default function CharacterSheet({ character }: CharacterSheetProps) {
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const char = character ?? storeCharacter

  if (!char) return null

  const { config } = char
  const styleVars = {
    '--sheet-bg': config.backgroundColor,
    '--sheet-heading-font': config.sectionHeadingFontFamily,
    '--sheet-heading-weight': config.sectionHeadingFontWeight,
    '--sheet-label-font': config.labelFontFamily,
    '--sheet-text-font': config.textFontFamily,
    '--sheet-helper-font': config.helperTextFontFamily,
  } as React.CSSProperties

  return (
    <div
      className={
        'character-sheet' +
        (config.hideSectionBackground ? ' character-sheet--flat' : '')
      }
      style={styleVars}
    >
      {config.customCss && (
        <style
          // Per-design custom CSS is appended to fully override the sheet.
          // It's user-authored and intentionally trusted.
          dangerouslySetInnerHTML={{ __html: config.customCss }}
        />
      )}

      <ProfileSection
        name={char.name}
        portrait={char.portrait}
        physicalDescription={char.physicalDescription}
        backstory={char.backstory}
      />

      <AttributesSection attributes={char.attributes} />
      <SkillsSection skills={char.skills} />
      <StatsSection character={char} />

      <CoreAbilitySection
        innateDescription={char.innateDescription}
        innateAbility={char.innateAbility}
        basicAttack={char.basicAttack}
        fatebreaker={char.fatebreaker}
      />

      <SlottedAbilitiesSection
        abilities={char.slottedAbilities}
        maxSlots={char.maxAbilitySlots}
      />

      <AbilityPoolSection abilities={char.abilityPool} />
    </div>
  )
}