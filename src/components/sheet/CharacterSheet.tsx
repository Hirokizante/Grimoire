/**
 * CharacterSheet — the full character sheet layout.
 *
 * Receives a character via props (preferred) or falls back to the store's
 * current character. Applies the player's sheet config (background color,
 * font families, custom CSS) as CSS variables on a scoped wrapper.
 *
 * The `mode` prop controls editability: "edit" makes fields editable,
 * "view" makes them read-only (for live sessions).
 */

import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

import AbilityPoolSection from '@/components/sheet/AbilityPoolSection'
import AttributesSection from '@/components/sheet/AttributesSection'
import CoreAbilitySection from '@/components/sheet/CoreAbilitySection'
import ProfileSection from '@/components/sheet/ProfileSection'
import SkillsSection from '@/components/sheet/SkillsSection'
import SlottedAbilitiesSection from '@/components/sheet/SlottedAbilitiesSection'
import StatsSection from '@/components/sheet/StatsSection'

import '@/components/sheet/sheet.css'

export interface CharacterSheetProps {
  character?: Character
  mode?: SheetMode
}

export default function CharacterSheet({
  character,
  mode = 'view',
}: CharacterSheetProps) {
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

      <ProfileSection
        name={char.name}
        portrait={char.portrait}
        physicalDescription={char.physicalDescription}
        backstory={char.backstory}
        mode={mode}
      />

      <AttributesSection attributes={char.attributes} mode={mode} />
      <SkillsSection skills={char.skills} mode={mode} />
      <StatsSection character={char} mode={mode} />

      <CoreAbilitySection
        innateDescription={char.innateDescription}
        innateAbility={char.innateAbility}
        basicAttack={char.basicAttack}
        fatebreaker={char.fatebreaker}
        mode={mode}
      />

      <SlottedAbilitiesSection
        abilities={char.slottedAbilities}
        maxSlots={char.maxAbilitySlots}
        mode={mode}
      />

      <AbilityPoolSection abilities={char.abilityPool} mode={mode} />
    </div>
  )
}
