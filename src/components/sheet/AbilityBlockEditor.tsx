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
 *
 * In `npcMode` (NPC sheets), character-only controls are hidden: NPCs have no
 * END or FP pools (so no END/FP cost inputs), no Ability Slots (so no Minor
 * Ability toggle), and no Activate button (so no "Show Activate" toggle).
 *
 * In `isSubAbility` mode (Sub-Ability editor), the "Minor Ability" toggle and
 * "Add Sub-Ability" buttons are hidden — sub-abilities cannot be Minor and
 * cannot have their own nested sub-abilities.
 *
 * Sub-Abilities: when not in `isSubAbility` mode, "Add Sub-Ability" buttons
 * appear under the Description and Overcharge fields. Clicking one opens a
 * side-by-side editor panel (another AbilityBlockEditor with isSubAbility=true)
 * so the user can reference the main ability while editing the sub-ability.
 */

import { useState, useEffect, useCallback } from 'react'

import { generateId } from '@/constants/gameData'
import { SUB_ABILITY_ACCENT_OPTIONS } from '@/lib/themeUtils'
import type { AbilityBlock, AbilityCost } from '@/types'

export interface AbilityBlockEditorProps {
  /** The ability to edit, or null when creating a new one. */
  ability: AbilityBlock | null
  /** Called with the completed AbilityBlock when the user saves. */
  onSave: (ability: AbilityBlock) => void
  /** Called when the user cancels editing. */
  onCancel: () => void
  /** When true, hide the title row (used when wrapped in a modal with its own title). */
  hideTitle?: boolean
  /** Called whenever the dirty state changes (true = has unsaved changes). */
  onDirtyChange?: (isDirty: boolean) => void
  /**
   * When true (NPC sheet context), hide character-only controls:
   * END/FP cost inputs, "Minor Ability" toggle, "Show Activate button" toggle.
   */
  npcMode?: boolean
  /**
   * When true (Sub-Ability context), hide the "Minor Ability" toggle and the
   * "Add Sub-Ability" buttons — sub-abilities cannot be Minor and cannot have
   * their own nested sub-abilities.
   */
  isSubAbility?: boolean
  /**
   * Called when the sub-ability side panel opens or closes. The parent modal
   * uses this to expand its width for the side-by-side layout.
   */
  onSubEditorToggle?: (isOpen: boolean) => void
}

/** Build a blank AbilityBlock for the "new" case. */
export function blankAbility(): AbilityBlock {
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
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
  }
}

/**
 * Build a blank Sub-Ability. Sub-Abilities are identical to regular
 * AbilityBlocks except they can never be Minor (they don't consume slots)
 * and cannot have their own nested sub-abilities.
 */
export function blankSubAbility(): AbilityBlock {
  return {
    ...blankAbility(),
    id: generateId(),
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

/** Which section a sub-ability is nested under. */
type SubSection = 'description' | 'overcharge'

export default function AbilityBlockEditor({
  ability,
  onSave,
  onCancel,
  hideTitle = false,
  onDirtyChange,
  npcMode = false,
  isSubAbility = false,
  onSubEditorToggle,
}: AbilityBlockEditorProps) {
  const [draft, setDraft] = useState<AbilityBlock>(ability ?? blankAbility())
  const [traitsText, setTraitsText] = useState(serializeTraits(draft.traits))

  // -- Sub-ability editor state ------------------------------------------------
  const [subEditorAbility, setSubEditorAbility] = useState<AbilityBlock | null>(null)
  const [subEditorSection, setSubEditorSection] = useState<SubSection>('description')
  const [subEditorOpen, setSubEditorOpen] = useState(false)

  const openSubEditor = useCallback(
    (sub: AbilityBlock | null, section: SubSection) => {
      setSubEditorAbility(sub)
      setSubEditorSection(section)
      setSubEditorOpen(true)
      onSubEditorToggle?.(true)
    },
    [onSubEditorToggle],
  )

  const closeSubEditor = useCallback(() => {
    setSubEditorOpen(false)
    setSubEditorAbility(null)
    onSubEditorToggle?.(false)
  }, [onSubEditorToggle])

  const handleSubSave = useCallback(
    (sub: AbilityBlock) => {
      const key =
        subEditorSection === 'description'
          ? 'subAbilitiesUnderDescription'
          : 'subAbilitiesUnderOvercharge'
      const list = draft[key]
      const exists = list.some((s) => s.id === sub.id)
      const updatedList = exists
        ? list.map((s) => (s.id === sub.id ? sub : s))
        : [...list, sub]
      setDraft({ ...draft, [key]: updatedList })
      closeSubEditor()
    },
    [draft, subEditorSection, closeSubEditor],
  )

  const removeSubAbility = (subId: string, section: SubSection) => {
    const key =
      section === 'description'
        ? 'subAbilitiesUnderDescription'
        : 'subAbilitiesUnderOvercharge'
    setDraft({
      ...draft,
      [key]: draft[key].filter((s) => s.id !== subId),
    })
  }

  // Track dirty state and notify parent.
  useEffect(() => {
    if (!onDirtyChange) return
    const original = ability ?? blankAbility()
    const isDirty =
      draft.name !== original.name ||
      traitsText !== serializeTraits(original.traits) ||
      draft.damage !== original.damage ||
      draft.description !== original.description ||
      draft.overcharge !== original.overcharge ||
      draft.flavorText !== original.flavorText ||
      draft.isMinor !== original.isMinor ||
      draft.showActivate !== original.showActivate ||
      draft.cost.ap !== original.cost.ap ||
      draft.cost.end !== original.cost.end ||
      draft.cost.fp !== original.cost.fp ||
      draft.subAbilitiesUnderDescription.length !== original.subAbilitiesUnderDescription.length ||
      draft.subAbilitiesUnderOvercharge.length !== original.subAbilitiesUnderOvercharge.length ||
      JSON.stringify(draft.subAbilitiesUnderDescription) !== JSON.stringify(original.subAbilitiesUnderDescription) ||
      JSON.stringify(draft.subAbilitiesUnderOvercharge) !== JSON.stringify(original.subAbilitiesUnderOvercharge) ||
      (draft.colorOverride ?? '') !== (original.colorOverride ?? '')
    onDirtyChange(isDirty)
  }, [draft, traitsText, ability, onDirtyChange])

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

  // -- Sub-ability list rendering ---------------------------------------------
  const renderSubAbilityList = (section: SubSection) => {
    const list =
      section === 'description'
        ? draft.subAbilitiesUnderDescription
        : draft.subAbilitiesUnderOvercharge
    if (list.length === 0) return null
    return (
      <div className="sub-ability-editor-list">
        {list.map((sub) => (
          <div key={sub.id} className="sub-ability-editor-item">
            <span className="sub-ability-editor-item__name">
              {sub.name || 'Untitled Sub-Ability'}
            </span>
            <div className="sub-ability-editor-item__actions">
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn"
                onClick={() => openSubEditor(sub, section)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                onClick={() => removeSubAbility(sub.id, section)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={
        'ability-editor' +
        (subEditorOpen ? ' ability-editor--has-sub-panel' : '')
      }
    >
      <div className="ability-editor__main-panel">
        <div className="ability-editor__inner">
          {!hideTitle && (
            <h4 className="ability-editor__title">
              {ability ? 'Edit Ability' : 'New Ability'}
            </h4>
          )}

          {isSubAbility && (
            <div className="ability-editor__field">
              <span className="ability-editor__label">Color</span>
              <div className="sub-ability-color-picker">
                <button
                  type="button"
                  className={
                    'sub-ability-color-picker__swatch' +
                    (!draft.colorOverride
                      ? ' sub-ability-color-picker__swatch--active'
                      : '')
                  }
                  onClick={() =>
                    setDraft({ ...draft, colorOverride: undefined })
                  }
                  title="Default"
                  aria-label="Default color"
                >
                  <span className="sub-ability-color-picker__swatch-inner sub-ability-color-picker__swatch-inner--default" />
                </button>
                {SUB_ABILITY_ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={
                      'sub-ability-color-picker__swatch' +
                      (draft.colorOverride === opt.key
                        ? ' sub-ability-color-picker__swatch--active'
                        : '')
                    }
                    style={{
                      ['--swatch-color' as string]: `var(${opt.cssVar})`,
                    }}
                    onClick={() =>
                      setDraft({ ...draft, colorOverride: opt.key })
                    }
                    title={opt.label}
                    aria-label={opt.label}
                  >
                    <span
                      className="sub-ability-color-picker__swatch-inner"
                      style={{ backgroundColor: `var(${opt.cssVar})` }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

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
            {!npcMode && (
              <>
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
              </>
            )}
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

          {/* Sub-abilities under Description */}
          {!isSubAbility && (
            <>
              {renderSubAbilityList('description')}
              <button
                type="button"
                className="btn btn--ghost ability-editor__add-sub-btn"
                onClick={() => openSubEditor(null, 'description')}
              >
                + Add Sub-Ability
              </button>
            </>
          )}

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

          {/* Sub-abilities under Overcharge */}
          {!isSubAbility && (
            <>
              {renderSubAbilityList('overcharge')}
              <button
                type="button"
                className="btn btn--ghost ability-editor__add-sub-btn"
                onClick={() => openSubEditor(null, 'overcharge')}
              >
                + Add Sub-Ability
              </button>
            </>
          )}

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

          {!npcMode && !isSubAbility && (
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
          )}

          {!npcMode && (
            <label className="ability-editor__field ability-editor__field--inline">
              <input
                type="checkbox"
                checked={draft.showActivate}
                onChange={(e) =>
                  setDraft({ ...draft, showActivate: e.target.checked })
                }
              />
              <span className="ability-editor__label">Show Activate button</span>
            </label>
          )}

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

      {/* Side-by-side Sub-Ability editor panel */}
      {subEditorOpen && (
        <div className="ability-editor__sub-panel">
          <div className="ability-editor__sub-panel-header">
            <h4>
              {subEditorAbility ? 'Edit Sub-Ability' : 'New Sub-Ability'}
            </h4>
            <button
              type="button"
              className="btn btn--icon ability-editor__sub-panel-close"
              onClick={closeSubEditor}
              aria-label="Close sub-ability editor"
            >
              ✕
            </button>
          </div>
          <div className="ability-editor__sub-panel-body">
            <AbilityBlockEditor
              key={subEditorAbility?.id ?? 'new-sub'}
              ability={subEditorAbility}
              onSave={handleSubSave}
              onCancel={closeSubEditor}
              hideTitle
              npcMode={npcMode}
              isSubAbility
            />
          </div>
        </div>
      )}
    </div>
  )
}
