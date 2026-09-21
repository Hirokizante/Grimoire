/**
 * EncounterSheetBody — the main area's read-only sheet body for the immersive
 * view: what the GM needs **to run the game** for one character, and nothing
 * else.
 *
 * A sibling of `PanelSheet` (the condensed body inside an expanded grid panel)
 * with two differences the encounter view exists for:
 *
 * - **No flavor.** The Core Ability section renders its ability cards (Innate
 *   Abilities, Basic Attack, Fatebreaker) but not the Innate narrative prose
 *   (`hideInnateNarrative`) — background text is reference material, not
 *   at-the-table information. Description / Character Background were never
 *   part of the panel body, and level up, import/export, and customize live on
 *   the sheet page only, so this view carries none of them and nothing is
 *   editable (`mode="view"` throughout).
 * - **No top block.** Combat stats, resource pools and attributes all moved
 *   up into the encounter sheet's condensed chrome (PanelHeader's inline
 *   tokens, the PanelMeter rows, the Mortal Wound track and the attribute
 *   row) — the body renders none of them again, so abilities own the full
 *   width immediately, with the skills table last.
 *
 * Live-play wiring is identical to a grid panel's expanded body: a player's
 * ability cards activate against their real record, an NPC instance's cards
 * run through the instance's own AP, Recharge cooldowns, uses, and modifier
 * switches via the passed resolver and writers.
 */

import CoreAbilitySection from '@/components/sheet/CoreAbilitySection'
import SkillsSection from '@/components/sheet/SkillsSection'
import SlottedAbilitiesSection from '@/components/sheet/SlottedAbilitiesSection'
import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import type { AbilityActivationOverrideResolver } from '@/hooks/useAbilityActivation'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface EncounterSheetBodyProps {
  /** The sheet to render — a player `Character` or an NPC instance projection. */
  entity: Character
  /** GM panels are live-play surfaces, so this is view mode in practice. */
  mode?: SheetMode
  /**
   * NPC-instance live-play resolver: the panel's own AP, Recharge cooldowns,
   * and cooldown badges (see hooks/useNpcInstanceActivation). Only NPC
   * encounter sheets pass it — a player's cards write through the character
   * store instead.
   */
  npcActivation?: AbilityActivationOverrideResolver
  /**
   * NPC-instance limited-use writer: persists a ± stepper adjustment to the
   * **panel's** own remaining-uses map (see PanelSheet for the full contract).
   */
  npcOnSetUses?: (abilityId: string, remaining: number) => void
  /**
   * NPC-instance modifier-switch writer: flips one ability's stat/attribute
   * modifiers on the **panel's** own state.
   */
  npcOnToggleModifiers?: (abilityId: string, active: boolean) => void
}

export default function EncounterSheetBody({
  entity,
  mode = 'view',
  npcActivation,
  npcOnSetUses,
  npcOnToggleModifiers,
}: EncounterSheetBodyProps) {
  const isNpc = entity.kind === 'npc'

  return (
    <>
      {/* Working block — abilities own the full width; skills fall below. */}
      <div className="gm-encounter__columns">
        <div className="gm-encounter__abilities">
          {isNpc ? (
            <NPCAbilitiesSection
              abilities={entity.slottedAbilities}
              basicAttack={entity.basicAttack}
              ownerId={entity.id}
              owner={entity}
              mode={mode}
              viewMode="list"
              activation={npcActivation}
              onSetUses={npcOnSetUses}
              onToggleModifiers={npcOnToggleModifiers}
            />
          ) : (
            <>
              {/* Cards only — the Innate narrative prose is suppressed; the
                * sheet page keeps it (see CoreAbilitySection). */}
              <CoreAbilitySection
                innateDescription={entity.innateDescription}
                innateAbilities={entity.innateAbilities}
                basicAttack={entity.basicAttack}
                fatebreaker={entity.fatebreaker}
                ownerId={entity.id}
                owner={entity}
                mode={mode}
                hideInnateNarrative
              />
              <SlottedAbilitiesSection
                abilities={entity.slottedAbilities}
                maxSlots={entity.maxAbilitySlots}
                owner={entity}
                mode={mode}
                viewMode="list"
              />
            </>
          )}
        </div>

        <div className="gm-encounter__skills">
          <SkillsSection character={entity} skills={entity.skills} mode={mode} />
        </div>
      </div>
    </>
  )
}
