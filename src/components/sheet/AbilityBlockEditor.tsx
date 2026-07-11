/**
 * AbilityBlockEditor — an inline form for editing all fields of an AbilityBlock.
 *
 * Shown in edit mode when the user clicks "Add" or "Edit" on an ability. The
 * parent owns the ability and persistence; this component is purely a form that
 * builds a complete AbilityBlock and calls `onSave` (or `onCancel` to dismiss).
 *
 * Cost fields (ap / end / fp) are optional — empty inputs are stored as
 * `undefined`. Traits are edited as a single comma-separated text input and
 * converted to/from the string array on the AbilityBlock.
 */

import { useState } from 'react'

import { generateId } from '@/constants/gameData'
import type { AbilityBlock, AbilityCost } from '@/types'

export interface AbilityBlockEditorProps {
  /** The ability to edit, or null when creating a new one. */
  ability: AbilityBlock | null
  /** Called with the completed AbilityBlock when the user saves. */
  onSave: (ability: AbilityBlock) => void
  /** Called when the user cancels editing. */
  onCancel: () => void
}

/** Build a blank AbilityBlock for the "new" case. */
function blankAbility(): AbilityBlock {
  return {
    id: generateId(),
    name: '',
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
  }
}

/**
 * Convert a comma-separated string into a clean trait array (empty entries
 * dropped, surrounding whitespace trimmed).
 */
function parseTraits(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/** Render a trait array back as a comma-separated string for the text input. */
function serializeTraits(traits: string[]): string {
  return traits.join(', ')
}

export default function AbilityBlockEditor({
  ability,
  onSave,
  onCancel,
}: AbilityBlockEditorProps) {
  const [draft, setDraft] = useState<AbilityBlock>(ability ?? blankAbility())
  const [traitsText, setTraitsText] = useState(serializeTraits(draft.traits))

  // -- cost helpers ----------------------------------------------------------
  const costNum = (key: keyof AbilityCost): string => {
    const v = draft.cost[key]
    return v == null ? '' : String(v)
  }

  const setCost = (key: keyof AbilityCost, raw: string) => {
    const nextCost: AbilityCost = { ...draft.cost }
    if (raw === '') {
      delete nextCost[key]
    } else {
      const n = Number(raw)
      if (Number.isFinite(n)) nextCost[key] = n
    }
    setDraft({ ...draft, cost: nextCost })
  }

  const handleSave = () => {
    const final: AbilityBlock = {
      ...draft,
      traits: parseTraits(traitsText),
    }
    onSave(final)
  }

  return (
    <div className="ability-editor">
      <div className="ability-editor__inner">
        <h4 className="ability-editor__title">
          {ability ? 'Edit Ability' : 'New Ability'}
        </h4>

        <label className="ability-editor__field">
          <span className="ability-editor__label">Name</span>
          <input
            type="text"
            className="sheet-input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Ability name"
          />
        </label>

        <label className="ability-editor__field">
          <span className="ability-editor__label">Traits (comma-separated)</span>
          <input
            type="text"
            className="sheet-input"
            value={traitsText}
            onChange={(e) => setTraitsText(e.target.value)}
            placeholder="Action, Melee, Physical"
          />
        </label>

        <div className="ability-editor__row">
          <label className="ability-editor__field">
            <span className="ability-editor__label">AP Cost</span>
            <input
              type="number"
              className="sheet-input sheet-input--num"
              min={0}
              value={costNum('ap')}
              onChange={(e) => setCost('ap', e.target.value)}
              placeholder="—"
            />
          </label>
          <label className="ability-editor__field">
            <span className="ability-editor__label">END Cost</span>
            <input
              type="number"
              className="sheet-input sheet-input--num"
              min={0}
              value={costNum('end')}
              onChange={(e) => setCost('end', e.target.value)}
              placeholder="—"
            />
          </label>
          <label className="ability-editor__field">
            <span className="ability-editor__label">FP Cost</span>
            <input
              type="number"
              className="sheet-input sheet-input--num"
              min={0}
              value={costNum('fp')}
              onChange={(e) => setCost('fp', e.target.value)}
              placeholder="—"
            />
          </label>
        </div>

        <label className="ability-editor__field">
          <span className="ability-editor__label">Damage</span>
          <input
            type="text"
            className="sheet-input"
            value={draft.damage}
            onChange={(e) => setDraft({ ...draft, damage: e.target.value })}
            placeholder="e.g. 1d6 + MAR"
          />
        </label>

        <label className="ability-editor__field">
          <span className="ability-editor__label">Description</span>
          <textarea
            className="sheet-textarea"
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            placeholder="What the ability does…"
            rows={4}
          />
        </label>

        <label className="ability-editor__field">
          <span className="ability-editor__label">Overcharge</span>
          <textarea
            className="sheet-textarea"
            value={draft.overcharge}
            onChange={(e) =>
              setDraft({ ...draft, overcharge: e.target.value })
            }
            placeholder="Effects unlocked by spending FP…"
            rows={3}
          />
        </label>

        <label className="ability-editor__field">
          <span className="ability-editor__label">Flavor Text</span>
          <input
            type="text"
            className="sheet-input"
            value={draft.flavorText}
            onChange={(e) =>
              setDraft({ ...draft, flavorText: e.target.value })
            }
            placeholder="Optional in-universe quote…"
          />
        </label>

        <label className="ability-editor__field ability-editor__field--inline">
          <input
            type="checkbox"
            checked={draft.isMinor}
            onChange={(e) =>
              setDraft({ ...draft, isMinor: e.target.checked })
            }
          />
          <span className="ability-editor__label">Minor Ability (half slot)</span>
        </label>

        <div className="ability-editor__actions">
          <button
            type="button"
            className="btn btn--primary ability-editor__btn"
            onClick={handleSave}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn--ghost ability-editor__btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
