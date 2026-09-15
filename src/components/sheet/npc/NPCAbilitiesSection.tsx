/**
 * NPCAbilitiesSection — an NPC's ability list, shared by every surface an NPC
 * sheet appears on:
 *
 *   - the standalone NPC sheet page ({@link NPCSheet}), where the section is
 *     the same `sheet-section` shell the player sheet's Slotted Abilities use,
 *   - an NPC attached to a custom tab of a player sheet
 *     ({@link CustomNPCSection}), rendered through `variant="embedded"` inside
 *     the bundled NPC's own block layout,
 *   - an expanded GM Screen panel ({@link PanelSheet}), always in list view.
 *
 * **One component, so the surfaces cannot drift.** The standalone and embedded
 * variants render the same heading row (title left, grid/list toggle right),
 * the same `+ Add Ability` button below it, and the same `.ability-grid` cards
 * (3-column masonry or a full-width list) — the embedded variant only swaps the
 * section shell for a block wrapper and the `h3` heading for the compact `h5`
 * block heading the NPC's other blocks use, because there the NPC's name is the
 * section heading.
 *
 * **Drag and drop matches the player sheet's Slotted Abilities.** In edit mode
 * every card is a {@link SortableAbilityCard} with the same grip handle, inside
 * an {@link NpcAbilitiesDndContext} that reorders the list on drop (an NPC has
 * one ability list, so there is no cross-list move to make). The empty list is
 * a drop zone and the list highlights while a card hovers it, exactly as the
 * slotted section does. Reordering writes through `updateCharacter(ownerId, …)`,
 * so the standalone sheet reorders the NPC it is showing and an embedded
 * section reorders the attached NPC record.
 *
 * **NPCs have no slots and no pool.** There is no slot counter, no overflow
 * warning, and no "Move to Pool" button — an NPC's list is a stat block, not an
 * encounter loadout.
 *
 * **Activation follows the resolver rule.** On the sheet pages the Activate
 * button is never rendered — NPC sheets are static references, not active
 * participants in turn-based combat — because a section always supplies a
 * resolver (`NO_ACTIVATION` unless the GM Screen passes its own). The GM Screen
 * passes `activation`, and only the abilities it returns an override for (any
 * ability with a cost, plus anything on Recharge cooldown) get a working
 * Activate button backed by the panel's own AP. See
 * hooks/useNpcInstanceActivation.
 *
 * In edit mode, an "Add Ability" button opens the AbilityEditorModal, and each
 * card gains Edit and Remove buttons.
 */

import { useState, useCallback } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import SectionViewToggle from '@/components/sheet/SectionViewToggle'
import SortableAbilityCard from '@/components/sheet/SortableAbilityCard'
import NpcAbilitiesDndContext, {
  NPC_ABILITIES_SECTION_ID,
} from '@/components/sheet/npc/NpcAbilitiesDndContext'
import { useCharacterStore } from '@/store/characterStore'
import { useSubAbilityEditor } from '@/hooks/useSubAbilityEditor'
import {
  NO_ACTIVATION,
  type AbilityActivationOverrideResolver,
} from '@/hooks/useAbilityActivation'
import type { AbilityBlock } from '@/types'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface NPCAbilitiesSectionProps {
  abilities: AbilityBlock[]
  /**
   * The NPC these abilities belong to. Defaults to the store's
   * `currentCharacter`; an attached NPC section and the GM Screen pass the
   * record's own id so edits target the right sheet.
   */
  ownerId?: string
  /**
   * The NPC entity itself, so its ability cards resolve dice notation against
   * the NPC's own stats (an attached NPC is not the store's current character).
   * Optional: the sheet pages already have the store's current NPC.
   */
  owner?: Character
  mode?: SheetMode
  viewMode?: 'grid' | 'list'
  /**
   * Omit to render a FIXED view mode with no grid/list toggle. A GM panel
   * passes nothing, so panels always read as a list (a grid is unreadable at
   * panel width); the NPC sheet page and an embedded NPC section pass this and
   * keep both toggles.
   */
  onViewModeChange?: (mode: 'grid' | 'list') => void
  /**
   * GM Screen live-play resolver. When supplied (view mode only), every ability
   * it returns an override for renders through {@link AbilityActivation} — a
   * real Activate button spending the **panel instance's** AP, gated on its
   * Recharge cooldowns. Omitted on the NPC sheet pages, where abilities stay
   * static reference cards.
   */
  activation?: AbilityActivationOverrideResolver
  /**
   * `'section'` (default) is the standalone sheet section: its own
   * `sheet-section` shell with an `h3` heading. `'embedded'` drops the shell
   * and uses the compact `h5` block heading of a bundled NPC's block layout —
   * everything inside the section is identical.
   */
  variant?: 'section' | 'embedded'
  /**
   * Persist the stat/attribute modifier switch.
   *
   * Only a GM Screen NPC panel passes this (the instance's own
   * `state.abilityModifiers` writer), because only an instance *owns* live
   * switch state: an NPC base record — the standalone sheet page and an NPC
   * embedded in a player's custom tab alike — is a static reference the GM
   * Screen spawns instances from, so its switch renders visible-but-inert (the
   * store fallback is suppressed for `kind: 'npc'`).
   */
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  /**
   * Persist a manual ± adjustment of a limited ability's remaining uses.
   *
   * Only a GM Screen NPC panel passes this (the instance's own
   * `state.abilityUses` writer), because only an instance *owns* a live use
   * count: an NPC base record — the standalone sheet page and an NPC embedded
   * in a player's custom tab alike — is a static reference the GM Screen spawns
   * instances from, so its cards render a read-only meter (the store fallback
   * is suppressed for `kind: 'npc'`).
   */
  onSetUses?: (abilityId: string, remaining: number) => void
}

export default function NPCAbilitiesSection({
  abilities,
  ownerId,
  owner,
  mode = 'view',
  viewMode = 'grid',
  onViewModeChange,
  activation,
  variant = 'section',
  onToggleModifiers,
  onSetUses,
}: NPCAbilitiesSectionProps) {
  const isEdit = mode === 'edit'
  const isListView = viewMode === 'list'
  const isEmbedded = variant === 'embedded'
  // A resolver is always supplied — the GM panel's, or the "nothing activates"
  // one for the sheet pages. An NPC sheet is a **static reference**, so a sheet
  // page must pass NO_ACTIVATION rather than nothing at all: a resolver is the
  // last word on activation, so no card below it can fall back to its own
  // `showActivate` flag and grow a button that would spend the *base* record's
  // AP — sub-abilities included.
  const activateOverride = activation ?? NO_ACTIVATION
  const updateCharacter = useCharacterStore((s) => s.updateCharacter)
  const storeOwnerId = useCharacterStore((s) => s.currentCharacter?.id)
  const targetId = ownerId ?? storeOwnerId ?? ''
  // Memoized so handleUpdateParent's dependency array is honest.
  const updateCurrentCharacter = useCallback(
    (updater: (c: Character) => Character) => {
      updateCharacter(targetId, updater)
    },
    [targetId, updateCharacter],
  )

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [abilityToRemove, setAbilityToRemove] = useState<{ id: string; name: string } | null>(null)

  const handleUpdateParent = useCallback(
    (parent: AbilityBlock) => {
      updateCurrentCharacter((char) => ({
        ...char,
        slottedAbilities: char.slottedAbilities.map((a) =>
          a.id === parent.id ? parent : a,
        ),
      }))
    },
    [updateCurrentCharacter],
  )

  const { subAbilityActions, subAbilityEditorModal } = useSubAbilityEditor({
    onUpdateParent: handleUpdateParent,
    // The sub-ability editor matches this section's own ability editor: an NPC
    // outside a GM Screen never renders an Activate button, so it offers no
    // "Show Activate button" toggle (nor the character-only END/FP costs).
    npcMode: true,
    // The section edits an NPC that is not necessarily the store's current
    // character (a bundled NPC inside a player's custom tab), so the editors
    // are told which entity to read: the activation-roll accuracy picker needs
    // *this* NPC's attributes, not the host player's.
    character: owner,
  })

  /**
   * Drop handler for the reorder drag. Mirrors the store's `reorderAbility`
   * (same bounds checks, same splice) but writes through the section's own
   * owner, which is what lets an attached NPC reorder its list without being
   * the store's current character.
   */
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      updateCurrentCharacter((char) => {
        const list = [...char.slottedAbilities]
        if (fromIndex < 0 || fromIndex >= list.length) return char
        if (toIndex < 0 || toIndex >= list.length) return char
        const [moved] = list.splice(fromIndex, 1)
        list.splice(toIndex, 0, moved)
        return { ...char, slottedAbilities: list }
      })
    },
    [updateCurrentCharacter],
  )

  // Droppable — the list itself accepts a card dropped past its last one and
  // highlights while a card is dragged over it (same as the slotted section).
  const { setNodeRef, isOver } = useDroppable({
    id: NPC_ABILITIES_SECTION_ID,
    data: { section: NPC_ABILITIES_SECTION_ID },
  })

  const openNew = () => {
    setEditing(null)
    setShowEditor(true)
  }
  const openEdit = (ability: AbilityBlock) => {
    setEditing(ability)
    setShowEditor(true)
  }
  const handleSave = (ability: AbilityBlock) => {
    updateCurrentCharacter((char) => {
      const existing = char.slottedAbilities
      if (editing && existing.some((a) => a.id === editing.id)) {
        return {
          ...char,
          slottedAbilities: existing.map((a) => (a.id === editing.id ? ability : a)),
        }
      }
      return {
        ...char,
        slottedAbilities: [...existing, ability],
      }
    })
    setShowEditor(false)
    setEditing(null)
  }
  const handleCancel = () => {
    setShowEditor(false)
    setEditing(null)
  }

  const handleRemoveRequest = (abilityId: string) => {
    const ability = abilities.find((a) => a.id === abilityId)
    if (!ability) return
    setAbilityToRemove({ id: abilityId, name: ability.name })
  }

  const handleConfirmRemove = () => {
    if (!abilityToRemove) return
    updateCurrentCharacter((char) => ({
      ...char,
      slottedAbilities: char.slottedAbilities.filter((a) => a.id !== abilityToRemove.id),
    }))
    setAbilityToRemove(null)
  }

  /**
   * The list itself — identical in both variants and both modes; only the cards
   * differ (sortable with action buttons while editing).
   */
  const list =
    abilities.length === 0 && !isEdit ? (
      <p className="sheet-section__empty muted">
        No abilities defined for this NPC.
      </p>
    ) : abilities.length === 0 ? (
      <div
        ref={setNodeRef}
        className={
          'ability-dropzone ability-dropzone--empty' +
          (isOver ? ' ability-dropzone--over' : '')
        }
      >
        <p className="sheet-section__empty muted">
          No abilities yet — click &ldquo;Add Ability&rdquo; to create one.
        </p>
      </div>
    ) : (
      <div
        ref={setNodeRef}
        className={
          (isListView
            ? 'ability-grid ability-grid--list'
            : 'ability-grid ability-grid--cards') +
          (isOver ? ' ability-dropzone--over' : '')
        }
      >
        {isEdit ? (
          <SortableContext
            items={abilities.map((a) => a.id)}
            strategy={isListView ? verticalListSortingStrategy : rectSortingStrategy}
          >
            {abilities.map((ability) => (
              <SortableAbilityCard
                key={ability.id}
                ability={ability}
                section={NPC_ABILITIES_SECTION_ID}
                mode={mode}
                character={owner}
                onToggleModifiers={onToggleModifiers}
                onSetUses={onSetUses}
                subAbilityActions={subAbilityActions}
                // The parent is not activatable here, but its sub-abilities may
                // be — the resolver travels with the card either way.
                activateOverride={activateOverride}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost ability-card__action-btn"
                      onClick={() => openEdit(ability)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                      onClick={() => handleRemoveRequest(ability.id)}
                    >
                      Remove
                    </button>
                  </>
                }
              />
            ))}
          </SortableContext>
        ) : (
          abilities.map((ability) => {
            // A GM panel resolves an override per ability: one with a cost (or
            // on Recharge cooldown) activates, the rest stay reference cards.
            const override = activateOverride(ability)
            if (override) {
              // The same writer both branches get: a GM panel's limited
              // abilities keep working ± steppers on an activatable card, and
              // an NPC base sheet receives none (so its meter stays read-only).
              return (
                <AbilityActivation
                  key={ability.id}
                  ability={ability}
                  character={owner}
                  activateOverride={activateOverride}
                  onSetUses={onSetUses}
                  onToggleModifiers={onToggleModifiers}
                />
              )
            }
            return (
              <AbilityBlockCard
                key={ability.id}
                ability={ability}
                character={owner}
                mode={mode}
                onToggleModifiers={onToggleModifiers}
                onSetUses={onSetUses}
                // The parent is not activatable here, but its sub-abilities may
                // be — the resolver travels with the card either way.
                activateOverride={activateOverride}
              />
            )
          })
        )}
      </div>
    )

  const viewToggle = onViewModeChange ? (
    <SectionViewToggle
      viewMode={viewMode}
      onChange={onViewModeChange}
      ariaLabel="Abilities view"
    />
  ) : null

  const content = (
    <>
      {isEmbedded ? (
        <div className="custom-npc-section__block-heading custom-npc-section__block-heading--row">
          <h5 className="custom-npc-section__block-heading">Abilities</h5>
          <div className="sheet-section__heading-row-right">{viewToggle}</div>
        </div>
      ) : (
        <div className="sheet-section__heading-row">
          <h3 className="sheet-section__heading">Abilities</h3>
          <div className="sheet-section__heading-row-right">{viewToggle}</div>
        </div>
      )}

      {isEdit && (
        <button
          type="button"
          className="btn btn--ghost section-add-btn"
          onClick={openNew}
        >
          + Add Ability
        </button>
      )}

      {isEdit ? (
        <NpcAbilitiesDndContext
          abilities={abilities}
          onReorder={handleReorder}
          owner={owner}
        >
          {list}
        </NpcAbilitiesDndContext>
      ) : (
        list
      )}

      <AbilityEditorModal
        ability={editing}
        open={showEditor}
        onSave={handleSave}
        onClose={handleCancel}
        npcMode
        character={owner}
      />

      {subAbilityEditorModal}

      {abilityToRemove && (
        <ConfirmModal
          title="Remove Ability?"
          message={
            <>
              Are you sure you want to remove{' '}
              <strong>{abilityToRemove.name || 'Untitled Ability'}</strong> from
              this NPC? This cannot be undone.
            </>
          }
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmRemove}
          onClose={() => setAbilityToRemove(null)}
        />
      )}
    </>
  )

  return isEmbedded ? (
    <div className="npc-abilities-section npc-abilities-section--embedded">
      {content}
    </div>
  ) : (
    <section className="sheet-section sheet-section--slotted npc-abilities-section">
      {content}
    </section>
  )
}
