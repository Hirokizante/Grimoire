/**
 * AbilityModifierFields — the stat/attribute modifier editor used by
 * {@link AbilityBlockEditor}.
 *
 * Lets the player decide *whether* an Ability modifies anything, *which*
 * Attributes / combat stats it changes, and whether each change **adds to** or
 * **subtracts from** the target value. Values are stored signed (positive adds,
 * negative subtracts); the +/− segmented control is purely a friendlier way to
 * flip the sign of a magnitude input.
 *
 * The parent owns the draft — this component is controlled via `modifiers` /
 * `onChange`. Checking the box seeds a first modifier row; unchecking it clears
 * the list (an Ability with no modifiers has nothing to toggle on its card).
 */

import SelectDropdown from '@/components/ui/SelectDropdown'
import {
  modifierTargetLabel,
  modifierTargetsFor,
} from '@/lib/abilityModifiers'
import type { AbilityStatModifier, ModifierTarget } from '@/types'

export interface AbilityModifierFieldsProps {
  /** Current modifier list from the editor draft. */
  modifiers: AbilityStatModifier[]
  /** Called with the next modifier list on every change. */
  onChange: (modifiers: AbilityStatModifier[]) => void
  /** NPC context: hides targets NPC sheets do not have (END Recovery). */
  npcMode?: boolean
}

export default function AbilityModifierFields({
  modifiers,
  onChange,
  npcMode = false,
}: AbilityModifierFieldsProps) {
  const targets = modifierTargetsFor(npcMode ? 'npc' : 'character')
  const enabled = modifiers.length > 0
  const used = new Set(modifiers.map((m) => m.target))

  /** Turning the feature on seeds one row so the picker is immediately usable. */
  const handleEnable = (on: boolean) => {
    if (!on) {
      onChange([])
      return
    }
    const first = targets.find((t) => !used.has(t.target)) ?? targets[0]
    onChange([{ target: first.target, value: 1 }])
  }

  const update = (index: number, patch: Partial<AbilityStatModifier>) => {
    onChange(modifiers.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const remove = (index: number) => {
    onChange(modifiers.filter((_, i) => i !== index))
  }

  /** Entered as a magnitude; the sign comes from the +/− control. */
  const setMagnitude = (index: number, raw: string) => {
    const n = Number(raw)
    const magnitude = Number.isFinite(n) ? Math.abs(n) : 0
    const sign = modifiers[index].value < 0 ? -1 : 1
    update(index, { value: sign * magnitude })
  }

  const setSign = (index: number, sign: 1 | -1) => {
    // Clicking a sign on an empty row seeds ±1 rather than leaving it at 0.
    const magnitude = Math.abs(modifiers[index].value) || 1
    update(index, { value: sign * magnitude })
  }

  /** Targets still selectable for one row (its own choice stays listed). */
  const optionsForRow = (index: number) =>
    targets
      .filter((t) => t.target === modifiers[index].target || !used.has(t.target))
      .map((t) => ({ value: t.target, label: t.menuLabel }))

  const addableTargets = targets.filter((t) => !used.has(t.target))

  return (
    <div className="ability-editor__modifiers">
      <label className="ability-editor__field ability-editor__field--inline">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleEnable(e.target.checked)}
        />
        <span className="ability-editor__label">
          Modifies combat stats / attributes
        </span>
      </label>

      {enabled && (
        <>
          <ul className="ability-editor__modifier-list" role="list">
            {modifiers.map((mod, index) => (
              <li key={index} className="ability-editor__modifier-row">
                <SelectDropdown
                  options={optionsForRow(index)}
                  onSelect={(value) =>
                    update(index, { target: value as ModifierTarget })
                  }
                  buttonLabel={modifierTargetLabel(mod.target)}
                  title="Modify which value?"
                  ariaLabel={`Modifier ${index + 1} target: ${modifierTargetLabel(mod.target)}`}
                  className="ability-editor__modifier-target"
                />

                <div
                  className="mode-toggle mode-toggle--sign"
                  role="group"
                  aria-label={`${modifierTargetLabel(mod.target)}: add or subtract`}
                >
                  <button
                    type="button"
                    className={
                      'mode-toggle__btn' +
                      (mod.value >= 0 ? ' mode-toggle__btn--active' : '')
                    }
                    aria-pressed={mod.value >= 0}
                    onClick={() => setSign(index, 1)}
                    title="Add to the value"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={
                      'mode-toggle__btn' +
                      (mod.value < 0 ? ' mode-toggle__btn--active' : '')
                    }
                    aria-pressed={mod.value < 0}
                    onClick={() => setSign(index, -1)}
                    title="Subtract from the value"
                  >
                    −
                  </button>
                </div>

                <input
                  type="number"
                  min={0}
                  className="sheet-input sheet-input--num ability-editor__modifier-value"
                  value={mod.value === 0 ? '' : String(Math.abs(mod.value))}
                  onChange={(e) => setMagnitude(index, e.target.value)}
                  placeholder="1"
                  aria-label={`${modifierTargetLabel(mod.target)} amount`}
                />

                <button
                  type="button"
                  className="btn btn--icon ability-editor__remove-cost-btn"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${modifierTargetLabel(mod.target)} modifier`}
                  title="Remove this modifier"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {addableTargets.length > 0 && (
            <SelectDropdown
              options={addableTargets.map((t) => ({
                value: t.target,
                label: t.menuLabel,
              }))}
              onSelect={(value) =>
                onChange([
                  ...modifiers,
                  { target: value as ModifierTarget, value: 1 },
                ])
              }
              buttonLabel="+ Add Modifier"
              title="Add Modifier"
              ariaLabel="Add stat or attribute modifier"
              className="ability-editor__add-sub-btn"
            />
          )}
        </>
      )}
    </div>
  )
}
