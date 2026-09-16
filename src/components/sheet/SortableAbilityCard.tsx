/**
 * SortableAbilityCard — wraps an {@link AbilityCardFrame} with dnd-kit's
 * `useSortable` hook so the card can be dragged and reordered within a list, or
 * dragged across to another ability section.
 *
 * **The whole card is the drag surface.** The frame's root element carries the
 * drag listeners, and {@link AbilityCardPointerSensor} declines any press that
 * starts on a control inside it, so a card can be grabbed by its name or its
 * text while Edit / Remove / Activate keep behaving like buttons. The grip
 * handle stays as the visible affordance — it opts back in through
 * `data-drag-activator` — and, as a full-width strip, remains the easiest place
 * to grab. In view mode nothing is draggable at all.
 *
 * **Where the card will land is drawn as an indicator, not a ghost.** While a
 * card is in the air the list above computes, from the resolved drop index, how
 * far every card has to move and where the line is drawn (see `previewOffsets` /
 * `dropLineTarget` in `lib/abilityDropTarget`); this card only draws the
 * translation it is handed, and the line is the list's own element. The card
 * keeps its slot while lifted — dnd-kit's own sorting transform is switched off
 * in {@link AbilityBlockList} precisely so the lifted card is *drawn* in the slot
 * it is about to take rather than scaled into it — which is what lets the
 * indicator's index and the drop's index be the same number.
 *
 * Props include the `section` identifier so the parent DnD context knows
 * which list this card belongs to when computing drag results.
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import AbilityCardFrame from '@/components/sheet/AbilityCardFrame'
import type { SlotPoint } from '@/lib/abilityDropTarget'
import type { AbilityActivationOverrideResolver } from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

/** Which ability list a sortable card belongs to. */
export type AbilitySectionId = 'slottedAbilities' | 'abilityPool' | string

export interface SortableAbilityCardProps {
  ability: AbilityBlock
  section: AbilitySectionId
  mode?: SheetMode
  /**
   * How far this card moves while another card is in the air — the translation
   * onto the slot the drop will leave it in, or `undefined` for a card that does
   * not move. Never a scale: cards are different heights in the masonry grid, so
   * scaling them to each other's boxes is what made the old preview read as a
   * rendering glitch.
   */
  previewOffset?: SlotPoint
  /**
   * Entity the card belongs to, so its dice notation resolves against the
   * right stats. Omitted on the player sheet (the store's `currentCharacter`
   * is the owner there); an NPC section embedded in a player sheet passes the
   * NPC, which is not the current character.
   */
  character?: Character
  /**
   * Persist the modifier switch / manual use adjustment for an ability that
   * does not live on the store's current character (an NPC attached to a
   * character sheet tab). Omitted where the card's own character is the
   * current character — the store action is the writer there.
   */
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  onSetUses?: (abilityId: string, remaining: number) => void
  /** Optional action buttons rendered below the card (Edit, Move, Remove). */
  actions?: React.ReactNode
  /**
   * Optional render function for sub-ability action buttons (edit-mode only).
   * Passed through to AbilityBlockCard.
   */
  subAbilityActions?: (sub: AbilityBlock, parent: AbilityBlock) => React.ReactNode
  /**
   * Per-ability activation override, passed through to AbilityBlockCard (and so
   * to the sub-abilities nested in the card). A section that activates nothing
   * — the Ability Pool — passes a resolver that always says "no", so no card
   * below can fall back to its own `showActivate` flag.
   */
  activateOverride?: AbilityActivationOverrideResolver
}

export default function SortableAbilityCard({
  ability,
  section,
  mode = 'view',
  previewOffset,
  character,
  onToggleModifiers,
  onSetUses,
  actions,
  subAbilityActions,
  activateOverride,
}: SortableAbilityCardProps) {
  const isEdit = mode === 'edit'

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ability.id,
    data: { section, isMinor: ability.isMinor },
    disabled: !isEdit,
  })

  // dnd-kit's transform is the list settling into its new order after a drop;
  // the drag preview replaces it while a card is in the air.
  const style = previewOffset
    ? {
        transform: CSS.Translate.toString({
          x: previewOffset.left,
          y: previewOffset.top,
        }),
        transition,
      }
    : { transform: CSS.Transform.toString(transform), transition }

  // dnd-kit's attributes include `role="button"` and a tab stop. The card
  // wrapper must not become a second focusable button, so those two move to the
  // grip handle (the real control) and the wrapper keeps only the hint text
  // that describes it as a group.
  const { role: _role, tabIndex: _tabIndex, ...wrapperAttributes } = attributes
  // The handle is the keyboard activator. It wants the key listeners, not the
  // pointer ones: a press on it is already handled by the wrapper.
  const handleListeners = Object.fromEntries(
    Object.entries(listeners ?? {}).filter(([name]) => name.startsWith('onKey')),
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'ability-card-wrap sortable-ability' +
        (isDragging ? ' sortable-ability--dragging' : '')
      }
      data-section={section}
      data-ability-id={ability.id}
      role="group"
      {...wrapperAttributes}
      {...(isEdit ? listeners : {})}
    >
      <AbilityCardFrame
        ability={ability}
        mode={mode}
        showHandle={isEdit}
        character={character}
        handleProps={
          isEdit
            ? { ref: setActivatorNodeRef, role: 'button', tabIndex: 0, ...handleListeners }
            : undefined
        }
        actions={actions}
        subAbilityActions={subAbilityActions}
        activateOverride={activateOverride}
        onToggleModifiers={onToggleModifiers}
        onSetUses={onSetUses}
      />
    </div>
  )
}
