/**
 * PanelSheet — the compact sheet body rendered inside an EXPANDED GM Screen
 * panel.
 *
 * Player sheets and NPC sheets render **the same layout** through this
 * component, so an expanded panel reads identically whichever kind of sheet it
 * holds; only the section *content* differs (an NPC's stat block and abilities
 * versus a player's live-play resources and slotted abilities). The Combat
 * Stats accents are the same on both kinds too: a panel is app chrome, so the
 * row draws from the app theme's shared stat palette rather than the player's
 * own sheet colors.
 *
 * Deliberately NOT the full `CharacterSheet` / `NPCSheet`: those are built for
 * a whole page and are far too tall and wide for a panel that shares its row
 * with another panel. This view is condensed to what a GM needs *at the table*:
 * combat stats, attributes, abilities (list view), and skills.
 *
 * Deliberately omitted, because they are reference material rather than
 * at-the-table information and made every expanded panel enormous:
 *   - the HP block on player panels (the panel header already carries an HP bar
 *     with its own steppers and Damage dialog),
 *   - the Core Ability section on NPC panels (NPCs have no core abilities — the
 *     fields only ever hold the generated Basic Attack / Fatebreaker defaults),
 *   - Description / Character Background on both.
 *
 * Ability sections are always **list view** with no grid/list toggle: a grid
 * at panel width is unreadable, so grid is not offered here at all.
 */

import AttributesSection from '@/components/sheet/AttributesSection'
import CoreAbilitySection from '@/components/sheet/CoreAbilitySection'
import SkillsSection from '@/components/sheet/SkillsSection'
import SlottedAbilitiesSection from '@/components/sheet/SlottedAbilitiesSection'
import StatsSection from '@/components/sheet/StatsSection'
import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import NPCStatsSection from '@/components/sheet/npc/NPCStatsSection'
import { effectiveAttributes } from '@/lib/abilityModifiers'
import { appThemeStatColors } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import type { AbilityActivationOverrideResolver } from '@/hooks/useAbilityActivation'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface PanelSheetProps {
  /** The sheet to render — a player `Character` or an NPC base record. */
  entity: Character
  /** GM panels are live-play surfaces, so this is view mode in practice. */
  mode?: SheetMode
  /**
   * NPC-instance live-play resolver: the panel's own AP, Recharge cooldowns,
   * and cooldown badges (see hooks/useNpcInstanceActivation). Only NPC panels
   * pass it — a player panel spends the character's real sheet instead.
   */
  npcActivation?: AbilityActivationOverrideResolver
  /**
   * Suppress the sheet body's own Action Points bar. A player panel shows AP in
   * its chrome, directly under the HP bar, so the body must not print a second
   * copy of the same number (see PanelApBar).
   */
  hideAP?: boolean
}

export default function PanelSheet({
  entity,
  mode = 'view',
  npcActivation,
  hideAP = false,
}: PanelSheetProps) {
  const isNpc = entity.kind === 'npc'
  // A panel is app chrome, so its Combat Stats accents come from the app
  // theme's shared stat palette — the same one NPCStatsSection reads. That is
  // what makes Evasion/Armor/Movement/Save DC the same four colors on a player
  // panel and an NPC panel standing next to it, whichever palette the player's
  // own sheet uses (their sheet page keeps its colors; see StatsSection's
  // `tokenColors`).
  const statColors = appThemeStatColors(useAppThemeStore((s) => s.theme))

  return (
    <>
      {/* 1. Combat stats — the same block position for both kinds, and the
       *    same accents for the stats the two rows share. Token labels are
       *    shorthand here: a panel's token column is ~7.5rem wide and the full
       *    names ellipsised ("MILEST…", "END RE…"), so a panel prints
       *    "Miles / Eva / Arm / Move / Save / END Rec" with the full name as
       *    the tooltip. The sheet page, which has the width, keeps them. */}
      {isNpc ? (
        <NPCStatsSection
          npc={entity}
          mode={mode}
          variant="flat"
          tokenLabels="short"
        />
      ) : (
        <StatsSection
          character={entity}
          mode={mode}
          variant="flat"
          hideHP
          hideAP={hideAP}
          tokenColors={statColors}
          tokenLabels="short"
        />
      )}

      {/* 2. Attributes — a horizontal row, mirroring the hero section. */}
      <AttributesSection
        character={entity}
        attributes={effectiveAttributes(entity)}
        mode={mode}
        variant="flat-row"
      />

      {/* 3. Core ability — players only. NPC sheets have no core abilities;
       *    their `basicAttack`/`fatebreaker` fields only ever hold the
       *    generated defaults, so the section was pure noise on a panel. */}
      {!isNpc && (
        <CoreAbilitySection
          innateDescription={entity.innateDescription}
          innateAbilities={entity.innateAbilities}
          basicAttack={entity.basicAttack}
          fatebreaker={entity.fatebreaker}
          ownerId={entity.id}
          owner={entity}
          mode={mode}
        />
      )}

      {/* 4. Abilities — slotted for players (the pool is a build-time concept
       *    with no place on a live GM panel), the full ability list for NPCs.
       *    Both always render as a list; no grid toggle is offered. */}
      {isNpc ? (
        <NPCAbilitiesSection
          abilities={entity.slottedAbilities}
          ownerId={entity.id}
          owner={entity}
          mode={mode}
          viewMode="list"
          activation={npcActivation}
        />
      ) : (
        <SlottedAbilitiesSection
          abilities={entity.slottedAbilities}
          maxSlots={entity.maxAbilitySlots}
          owner={entity}
          mode={mode}
          viewMode="list"
        />
      )}

      {/* 5. Skills. */}
      <SkillsSection character={entity} skills={entity.skills} mode={mode} />
    </>
  )
}
