/**
 * MortalWoundRoller — the sheet's whole Mortal Wound block: the track, the
 * current/max counter, the roll, and the two manual actions.
 *
 * Per DESIGN.md "Hit Points and Mortal Wounds": when a character's HP reaches
 * 0, they incur a Mortal Wound and HP resets to max. The player rolls a D20 to
 * determine which wound from the table they receive. Up to 2 Mortal Wounds can
 * be sustained; a third would knock the character out (Death Save territory).
 *
 * The block reads top to bottom: a **header row** (`[skull] Mortal Wounds
 * n / max` — the same read-out shape the GM panel's wound row uses), then one
 * card per wound, then the warning that a full track means the next 0 HP is a
 * knock-out, then **one action row**. The row is where the counter's empty
 * slots used to be: an untouched track prints no slot squircles at all (they
 * were two dead boxes that said "nothing here" twice over), and the n / max
 * counter says the same thing in the header's own line. Every action a wound
 * needs — roll, add by hand, rest — is one peer-sized button in that row,
 * never a full-width bar across the section.
 *
 * **The roll is not the only way in.** A wound is sometimes named outright — an
 * ability in play, an NPC's authored effect, a GM's ruling — and then the D20
 * is theatre. **Add Mortal Wound…** opens {@link MortalWoundPicker}, the same
 * twenty-entry table read as a list, and writes the chosen entry through
 * `characterStore.addMortalWound`: the wound takes the oldest slot that can
 * take a name, which includes a slot this character's own damage left on
 * "Pending Roll" — naming that wound by hand is exactly what the player would
 * otherwise roll for. The picker is the same component both GM panel kinds
 * open from their ⋯ menu, so a wound chosen at the table and one chosen here
 * can never disagree.
 *
 * `readOnly` renders **the same block** on a sheet in edit mode: cards and
 * counter, no roll, no add, no rest, no clear ✕. Edit mode used to draw its own
 * squircle track, which gave one wound two different faces depending on which
 * mode the sheet was in — one component, one face, for both. (Building a sheet
 * is not playing it, which is why the controls stay out of edit mode entirely.)
 */

import { useState } from 'react'
import { BedDouble, Dices, Plus, Skull, TriangleAlert, X } from '@/components/ui/icons'

import MortalWoundPicker from '@/components/sheet/MortalWoundPicker'
import { MAX_MORTAL_WOUNDS, MORTAL_WOUNDS } from '@/constants/gameData'
import { useNotification } from '@/context/NotificationContext'
import {
  CRITICAL_CONDITION_MESSAGE,
  KNOCKED_OUT_MESSAGE,
  characterMortalWounds,
  nextMortalWoundSlot,
  PENDING_MORTAL_WOUND,
} from '@/lib/mortalWounds'
import { useCharacterStore, type MortalWoundResult } from '@/store/characterStore'
import type { Character, MortalWound } from '@/types'

export interface MortalWoundRollerProps {
  character: Character
  /**
   * Render the track as a read-out — cards and counter only, with no roll, no
   * manual add, no Rest and no per-card clear. Used by the sheet's edit mode
   * (see the file header).
   */
  readOnly?: boolean
}

export default function MortalWoundRoller({
  character,
  readOnly = false,
}: MortalWoundRollerProps) {
  const rollMortalWound = useCharacterStore((s) => s.rollMortalWound)
  const addMortalWound = useCharacterStore((s) => s.addMortalWound)
  const clearMortalWound = useCharacterStore((s) => s.clearMortalWound)
  const fullRestore = useCharacterStore((s) => s.fullRestore)
  const { notify } = useNotification()
  const [pickerOpen, setPickerOpen] = useState(false)

  const hasPendingRoll = character.mortalWounds.some((w) => w === PENDING_MORTAL_WOUND)
  const filledCount = character.mortalWounds.filter((w) => w != null).length
  const isFull = filledCount >= MAX_MORTAL_WOUNDS
  // A slot that can still take a name — empty, or a wound this sheet parked on
  // "Pending Roll" (see nextMortalWoundSlot). False = the track is full, and
  // the manual add refuses (the picker says so rather than offering a dead
  // click).
  const canAdd = nextMortalWoundSlot(character.mortalWounds) !== -1
  const hasActions = !readOnly && (hasPendingRoll || canAdd || filledCount > 0)

  /**
   * Say what a wound just did to the track — and nothing more.
   *
   * A wound that fills the **last** slot is the Critical Condition, not a
   * knock-out: the character is standing at positive HP with no wound left to
   * take, and the knock-out is the *next* time they are reduced to 0 HP. Only
   * a wound resolved while they are already at 0 HP (overkill can burn through
   * both slots in one hit) leaves them knocked out, and only that says so.
   * An ordinary wound is left to its own card, which has just changed.
   */
  const announceWound = (result: MortalWoundResult) => {
    if (result.knockedOut) {
      notify(KNOCKED_OUT_MESSAGE, 'error', 5000)
    } else if (result.trackFull) {
      notify(CRITICAL_CONDITION_MESSAGE, 'warning', 5000)
    }
  }

  const handleRoll = () => {
    announceWound(rollMortalWound(character.id))
  }

  const handleClear = (index: number) => {
    clearMortalWound(character.id, index)
    notify('Mortal Wound cleared.', 'info', 2000)
  }

  const handleRest = () => {
    fullRestore(character.id)
    notify('Full Restore: resources, ability uses, and wound slots reset.', 'success', 4000)
  }

  /**
   * Apply the wound the GM/player named, skipping the D20. The store reports
   * the slot it filled; -1 means the track filled up between the dialog opening
   * and the click (or the name left the table), which the toast explains
   * instead of pretending the wound landed.
   */
  const handlePick = (wound: MortalWound) => {
    const result = addMortalWound(character.id, wound.name)
    if (result.slotIndex < 0) {
      notify(
        `${character.name} has no Mortal Wound slot left — clear one first.`,
        'error',
        4000,
      )
      return
    }
    notify(
      `Mortal Wound added: ${result.woundName} (d20 ${result.roll}).`,
      'error',
      4000,
    )
    // A pick can be what fills the track — say so, exactly as the roll does.
    announceWound(result)
  }

  return (
    <div className="mortal-wound-roller">
      {/* The track's read-out: what it holds, out of what it allows — the
        * counter that replaced the empty slot squircles. Same shape as the GM
        * panel's wound row (`1/2`), spelled the sheet's way (`1 / 2`, as every
        * resource bar above it reads). */}
      <div className="mw-head">
        <Skull className="mw-head__icon" size={13} aria-hidden="true" />
        {/* The label shares `stat-item__label` with the Death Saves block below
          * it: the section's two live-play trackers are labelled alike. */}
        <span className="stat-item__label">Mortal Wounds</span>
        <span
          className={'mw-head__count' + (isFull ? ' mw-head__count--full' : '')}
          title="Mortal Wounds sustained / allowed"
        >
          {filledCount}
          <span className="mw-head__max"> / {MAX_MORTAL_WOUNDS}</span>
        </span>
      </div>

      {filledCount > 0 && (
        <div className="mw-card-grid">
          {character.mortalWounds.map((woundName, i) => {
            if (woundName == null) return null
            const isPending = woundName === PENDING_MORTAL_WOUND
            const woundData = MORTAL_WOUNDS.find((w) => w.name === woundName)
            const rollNumber = woundData?.id ?? null
            const description = woundData?.description ?? ''

            return (
              <div key={i} className={`mw-card${isPending ? ' mw-card--pending' : ''}`}>
                <div className="mw-card__roll">{isPending ? '?' : rollNumber}</div>
                <div className="mw-card__body">
                  <div className="mw-card__header">
                    <span className="mw-card__name">
                      {isPending ? 'Roll to determine' : woundName}
                    </span>
                    {!isPending && !readOnly && (
                      <button
                        type="button"
                        className="mw-card__clear"
                        onClick={() => handleClear(i)}
                        title="Clear this wound"
                        aria-label={`Clear ${woundName}`}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {!isPending && (
                    <p className="mw-card__desc">{description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isFull && character.currentHP > 0 && (
        <p className="mw-warn">
          <TriangleAlert className="mw-warn__icon" size={13} aria-hidden="true" />
          {/* The same sentence the toast raises the moment the track fills. */}
          <span>{CRITICAL_CONDITION_MESSAGE}</span>
        </p>
      )}

      {hasActions && (
        <div className="mw-actions">
          {hasPendingRoll && (
            <button
              type="button"
              className="btn btn--primary sheet-action-btn"
              onClick={handleRoll}
            >
              <Dices size={13} aria-hidden="true" />
              Roll Mortal Wound (d20)
            </button>
          )}

          {canAdd && (
            <button
              type="button"
              className="btn btn--ghost sheet-action-btn"
              onClick={() => setPickerOpen(true)}
              title="Apply a specific wound from the Mortal Wounds table, without rolling"
            >
              <Plus size={13} aria-hidden="true" />
              Add Mortal Wound…
            </button>
          )}

          {filledCount > 0 && (
            <button
              type="button"
              className="btn btn--ghost sheet-action-btn"
              onClick={handleRest}
              title="Full restore: HP, END, AP, FP, ability uses, clear wounds & death saves"
            >
              <BedDouble size={14} aria-hidden="true" />
              Rest (Full Restore)
            </button>
          )}
        </div>
      )}

      {pickerOpen && (
        <MortalWoundPicker
          entityName={character.name}
          // Every wound on the track, named or still pending — the picker marks
          // them so a wound already recorded is obvious in the list.
          activeNames={characterMortalWounds(character.mortalWounds).map((w) => w.name)}
          canAdd={canAdd}
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
