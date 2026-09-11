/**
 * PanelSheet — the compact sheet body rendered inside an EXPANDED GM Screen
 * panel.
 *
 * Player sheets and NPC sheets render **the same layout** through this
 * component, so an expanded panel reads identically whichever kind of sheet it
 * holds; only the section *content* differs (an NPC's stat block and abilities
 * versus a player's live-play resources and slotted abilities).
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
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface PanelSheetProps {
  /** The sheet to render — a player `Character` or an NPC base record. */
  entity: Character
  /** GM panels are live-play surfaces, so this is view mode in practice. */
  mode?: SheetMode
}

export default function PanelSheet({ entity, mode = 'view' }: PanelSheetProps) {
  const isNpc = entity.kind === 'npc'

  return (
    <>
      {/* 1. Combat stats — the same block position for both kinds. */}
      {isNpc ? (
        <NPCStatsSection npc={entity} mode={mode} variant="flat" />
      ) : (
        <StatsSection character={entity} mode={mode} variant="flat" hideHP />
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
