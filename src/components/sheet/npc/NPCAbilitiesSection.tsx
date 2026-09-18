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
 * one ability list, so there is no cross-list move to make). The list itself is
 * rendered by {@link NpcAbilityList} — a **child** of that context, because the
 * drop-hint registration only reaches the context above it that way — so the
 * whole preview the player sheet draws (the insertion line, the cards sliding
 * into the slots the drop will leave them in, the hovered list's frame) is the
 * player sheet's own, from the same `AbilityBlockList` and `lib/abilityDropTarget`
 * maths. The empty list is a drop zone and the list highlights while a card
 * hovers it, exactly as the slotted section does. Reordering writes through
 * `updateCharacter(ownerId, …)`, so the standalone sheet reorders the NPC it is
 * showing and an embedded section reorders the attached NPC record.
 *
 * **NPCs have no slots and no pool.** There is no slot counter, no overflow
 * warning, and no "Move to Pool" button — an NPC's list is a stat block, not an
 * encounter loadout.
 *
 * **The Basic Attack is pinned to the head of the list.** Every NPC record
 * carries a generated Basic Attack (see `createDefaultBasicAttack`), and this
 * section renders it as the list's first card — the fixed block a player sheet
 * keeps in its Core Ability section, in the one ability surface an NPC has. It
 * is part of the grid (same card, same columns, same view mode) but **not part
 * of the list's order**: it carries no drag handle, no drop can land on it, and
 * it renders Edit with **no Remove** — the same "editable, not deletable" rule
 * a player's Basic Attack follows. The card is passed in as `basicAttack`, and
 * edits to it (or to its sub-abilities) write the record's `basicAttack` field
 * rather than a list entry.
 *
 * **Activation follows the resolver rule.** On the sheet pages the Activate
 * button is never rendered — NPC sheets are static references, not active
 * participants in turn-based combat — because a section always supplies a
 * resolver (`NO_ACTIVATION` unless the GM Screen passes its own). The GM Screen
 * passes `activation`, and only the abilities it returns an override for (any
 * ability with a cost or activation rolls, plus anything on Recharge cooldown)
 * get a working Activate button backed by the panel's own AP. See
 * hooks/useNpcInstanceActivation.
 *
 * In edit mode, an "Add Ability" button opens the AbilityEditorModal, and each
 * card gains Edit and Remove buttons.
 */

import { useState, useCallback } from 'react'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityBlockList from '@/components/sheet/AbilityBlockList'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import SectionViewToggle from '@/components/sheet/SectionViewToggle'
import NpcAbilitiesDndContext, {
  NPC_ABILITIES_SECTION_ID,
} from '@/components/sheet/npc/NpcAbilitiesDndContext'
import { useAbilityListDnd } from '@/hooks/useAbilityListDnd'
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
   * The NPC's Basic Attack — the fixed card pinned to the head of the list.
   *
   * Every caller passes the record's own `basicAttack` (the standalone sheet
   * its `entity`, an attached NPC its `npc`, a GM panel the instance's
   * projection, so an instance's own modifier switches and uses reach it like
   * any other card). Omitted only by a caller with no Basic Attack to show —
   * a hand-built fixture — in which case the section renders the plain list.
   */
  basicAttack?: AbilityBlock
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
  basicAttack,
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
      updateCurrentCharacter((char) => {
        // The Basic Attack is a scalar field on the record, not an entry in
        // `slottedAbilities` — an edit that came from inside its card (a
        // sub-ability) belongs there, and matching by id is what tells the two
        // apart without a second piece of state.
        if (char.basicAttack && char.basicAttack.id === parent.id) {
          return { ...char, basicAttack: parent }
        }
        return {
          ...char,
          slottedAbilities: char.slottedAbilities.map((a) =>
            a.id === parent.id ? parent : a,
          ),
        }
      })
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
      // Same rule as above: the Basic Attack's own edit writes its field, so
      // the pinned card can be modified without ever becoming a list entry
      // (which is also what keeps it under the editor instead of a Remove
      // button).
      if (char.basicAttack && char.basicAttack.id === ability.id) {
        return { ...char, basicAttack: ability }
      }
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
   * One card in **view** mode: a GM panel's activatable wrapper when the
   * resolver returns an override for it (anything with a cost, plus anything on
   * Recharge cooldown), the plain reference card otherwise. Shared by the
   * pinned Basic Attack and the list, so the two cannot drift.
   */
  const viewCard = (ability: AbilityBlock) => {
    const override = activateOverride(ability)
    if (override) {
      // The same writer both branches get: a GM panel's limited abilities keep
      // working ± steppers on an activatable card, and an NPC base sheet
      // receives none (so its meter stays read-only).
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
        // The parent is not activatable here, but its sub-abilities may be —
        // the resolver travels with the card either way.
        activateOverride={activateOverride}
      />
    )
  }

  /**
   * The Basic Attack card — pinned to the head of the list, in both modes.
   *
   * Edit mode gives it exactly what a player sheet's Basic Attack gets: an Edit
   * button and nothing else. There is deliberately no Remove button (the block
   * is not removable), no drag handle and no sortable wrapper (nothing can move
   * it out of the list, and the drop maths never sees it as a slot).
   */
  const basicAttackCard = basicAttack ? (
    isEdit ? (
      <div className="ability-card-wrap ability-card-wrap--pinned">
        <AbilityBlockCard
          ability={basicAttack}
          mode={mode}
          character={owner}
          onToggleModifiers={onToggleModifiers}
          onSetUses={onSetUses}
          subAbilityActions={subAbilityActions}
          activateOverride={activateOverride}
          actions={
            <button
              type="button"
              className="btn btn--ghost ability-card__action-btn"
              onClick={() => openEdit(basicAttack)}
            >
              Edit
            </button>
          }
        />
      </div>
    ) : (
      viewCard(basicAttack)
    )
  ) : null

  /**
   * The list itself. In edit mode the shared {@link AbilityBlockList} renders
   * the sortable cards (identical to the player sheet's ability sections); in
   * view mode the cards are resolved here, because a GM panel's ability may
   * activate while the rest stay static reference cards.
   */
  const viewCards = abilities.map((ability) => viewCard(ability))

  // The editable list is a **child** of the drag context, never a sibling of it:
  // the context publishes the drop hint store the list registers with, so the
  // registration only reaches it from below (see {@link NpcAbilityList}).
  const list = isEdit ? (
    <NpcAbilitiesDndContext
      abilities={abilities}
      onReorder={handleReorder}
      owner={owner}
    >
      <NpcAbilityList
        abilities={abilities}
        pinnedCards={basicAttackCard}
        layout={isListView ? 'list' : 'cards'}
        character={owner}
        onToggleModifiers={onToggleModifiers}
        onSetUses={onSetUses}
        subAbilityActions={subAbilityActions}
        // The parent is not activatable here, but its sub-abilities may be —
        // the resolver travels with the card either way.
        activateOverride={activateOverride}
        actions={(ability) => (
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
        )}
      />
    </NpcAbilitiesDndContext>
  ) : abilities.length === 0 && !basicAttack ? (
    <p className="sheet-section__empty muted">
      No abilities defined for this NPC.
    </p>
  ) : (
    <div
      className={
        isListView
          ? 'ability-grid ability-grid--list'
          : 'ability-grid ability-grid--cards'
      }
    >
      {/* An NPC with no authored abilities shows the pinned Basic Attack alone:
          the card is the list's own content, so a "no abilities" note beside it
          would contradict what is on screen. (The note above still covers the
          one case with nothing to show at all.) */}
      {basicAttackCard}
      {viewCards}
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

      {list}

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

interface NpcAbilityListProps {
  abilities: AbilityBlock[]
  /** The fixed Basic Attack card, rendered ahead of the sortable cards. */
  pinnedCards?: React.ReactNode
  layout: 'cards' | 'list'
  /** Entity the cards belong to — the NPC, which is not the store's character. */
  character?: Character
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  onSetUses?: (abilityId: string, remaining: number) => void
  subAbilityActions?: (sub: AbilityBlock, parent: AbilityBlock) => React.ReactNode
  activateOverride: AbilityActivationOverrideResolver
  /** Per-card Edit / Remove buttons, rendered in the card footer. */
  actions: (ability: AbilityBlock) => React.ReactNode
}

/**
 * The NPC's editable ability list — the shared {@link AbilityBlockList}, wired
 * to the NPC's own drag context.
 *
 * It is a separate component (deliberately not exported: it only makes sense
 * under {@link NpcAbilitiesDndContext}) for one structural reason:
 * {@link useAbilityListDnd} registers the list with the **nearest**
 * `AbilityDropHintContext` above it, and that has to be the NPC's. A hook called
 * in `NPCAbilitiesSection`'s own body sits *above* the context the section
 * renders, so it registered with whatever wraps the section instead: the
 * surrounding custom tab's drag context when the NPC is embedded in a player
 * sheet, and nothing at all on the standalone NPC sheet (dnd-kit's internal
 * context is defaulted, not thrown for). Either way the NPC context resolved no
 * drop — no insertion indicator, no preview translation, no hover frame — while
 * the reorder still landed through its fallback path. Both bugs came from the
 * same place: the list has to be a **child** of the context it registers with,
 * exactly as the player sheet's sections are children of
 * {@link AbilitiesDndContext}.
 */
function NpcAbilityList({
  abilities,
  pinnedCards,
  layout,
  character,
  onToggleModifiers,
  onSetUses,
  subAbilityActions,
  activateOverride,
  actions,
}: NpcAbilityListProps) {
  // An NPC has one list and no slots, so nothing is ever refused here. The
  // registration lands in the nested context above, which is what keeps an NPC
  // card's drop hint out of the surrounding custom tab's drag.
  const { setDroppableRef, isOver } = useAbilityListDnd({
    id: NPC_ABILITIES_SECTION_ID,
    items: abilities,
    layout,
  })

  return (
    <AbilityBlockList
      section={NPC_ABILITIES_SECTION_ID}
      abilities={abilities}
      pinnedCards={pinnedCards}
      layout={layout}
      droppableRef={setDroppableRef}
      isOver={isOver}
      character={character}
      onToggleModifiers={onToggleModifiers}
      onSetUses={onSetUses}
      subAbilityActions={subAbilityActions}
      activateOverride={activateOverride}
      emptyMessage={
        <>No abilities yet — click &ldquo;Add Ability&rdquo; to create one.</>
      }
      actions={actions}
    />
  )
}
