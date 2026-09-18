/**
 * ActivationRollFields — the "Roll Dice on Activation" editor used by
 * {@link AbilityBlockEditor}.
 *
 * Lets the author decide that an Ability rolls its own dice the moment it is
 * activated, and which rolls those are:
 *
 *   - **Accuracy** — `d20 + <attribute>`: any of the five Divergence Attributes
 *     or — on a player sheet — one of the sheet's own custom attributes, plus
 *     optional extra notation. Both lists live in the same picker. NPCs have no
 *     custom attributes, so in `npcMode` the picker offers the five Attributes
 *     alone and the editor never mentions the rest.
 *   - **Damage** — the Ability's own damage field, rolled as written. There is
 *     deliberately no second copy of the expression here: editing Damage changes
 *     this roll with it.
 *   - **Custom rolls** — any number of extra expressions, each with an optional
 *     name, and an optional "hide its result" flag for rolls the table only
 *     occasionally needs to read.
 *
 * The parent owns the draft — this component is controlled via `rolls` /
 * `onChange`, exactly like {@link AbilityModifierFields}. Unchecking the top box
 * drops the whole config (an Ability that rolls nothing stores nothing).
 */

import SelectDropdown from '@/components/ui/SelectDropdown'
import { ATTRIBUTE_LIST } from '@/constants/gameData'
import {
  MAX_ACTIVATION_CUSTOM_ROLLS,
  MAX_ACTIVATION_ROLL_LABEL,
  accuracyModifierValue,
} from '@/lib/activationRolls'
import { customAttributeToken, findCustomAttributeById } from '@/lib/customAttributes'
import {
  MAX_ADVANTAGE_VALUE,
  normalizeAdvantageValue,
} from '@/lib/diceAdvantage'
import type {
  ActivationAccuracySource,
  ActivationAdvantage,
  ActivationRoll,
  ActivationRolls,
  AttributeKey,
  Character,
} from '@/types'

export interface ActivationRollFieldsProps {
  /** The activation-roll config on the editor draft (absent = off). */
  rolls: ActivationRolls | undefined
  /** Called with the next config on every change; undefined = off. */
  onChange: (rolls: ActivationRolls | undefined) => void
  /** The Ability's damage field — what the damage roll will roll. */
  damage: string
  /**
   * The entity whose Attributes and custom attributes the accuracy picker
   * offers. The GM Screen edits the base record, so this is whoever is being
   * edited — never a spawned instance.
   */
  character: Character | null
  /**
   * NPC context: the accuracy picker offers the five Attributes only. A base
   * NPC record has no custom attributes — they are a **player** sheet feature
   * (see lib/customAttributes.ts) — so the editor does not mention them at all
   * rather than offering a choice that can never resolve.
   */
  npcMode?: boolean
}

/** A blank extra roll, seeded with a permissive starting expression. */
function newCustomRoll(): ActivationRoll {
  return { notation: '1d20' }
}

/** The token shown for an accuracy modifier in the picker trigger. */
function modifierButtonLabel(source: ActivationAccuracySource): string {
  if (source.kind === 'custom') return source.token || 'Custom…'
  return ATTRIBUTE_LIST.find((a) => a.key === source.key)?.abbreviation ?? source.key
}

/**
 * Copy only non-zero Advantage/Disadvantage counts onto a config entry, so
 * stored shapes stay lean and a cleared field really disappears.
 */
function withAdvantage<T extends ActivationAdvantage>(
  base: T,
  advantage: number,
  disadvantage: number,
): T {
  const next = { ...base }
  if (advantage > 0) next.advantage = advantage
  else delete next.advantage
  if (disadvantage > 0) next.disadvantage = disadvantage
  else delete next.disadvantage
  return next
}

/** The Advantage/Disadvantage pair on one authored roll. */
function AdvantageFields({
  advantage,
  disadvantage,
  name,
  onChange,
}: {
  advantage: number
  disadvantage: number
  name: string
  onChange: (advantage: number, disadvantage: number) => void
}) {
  const parse = (raw: string) =>
    raw.trim() === '' ? 0 : normalizeAdvantageValue(Number(raw))

  return (
    <div className="ability-editor__activation-advantage">
      <label
        className="ability-editor__activation-advantage-field"
        title="Dice of Advantage — the highest d6 is added to the roll"
      >
        <span className="ability-editor__activation-advantage-label">Adv</span>
        <input
          type="number"
          min={0}
          max={MAX_ADVANTAGE_VALUE}
          className="sheet-input ability-editor__activation-advantage-input"
          value={advantage || ''}
          placeholder="0"
          aria-label={`${name} advantage`}
          onChange={(e) => onChange(parse(e.target.value), disadvantage)}
        />
      </label>
      <label
        className="ability-editor__activation-advantage-field"
        title="Dice of Disadvantage — the highest d6 is subtracted from the roll"
      >
        <span className="ability-editor__activation-advantage-label">Dis</span>
        <input
          type="number"
          min={0}
          max={MAX_ADVANTAGE_VALUE}
          className="sheet-input ability-editor__activation-advantage-input"
          value={disadvantage || ''}
          placeholder="0"
          aria-label={`${name} disadvantage`}
          onChange={(e) => onChange(advantage, parse(e.target.value))}
        />
      </label>
    </div>
  )
}

export default function ActivationRollFields({
  rolls,
  onChange,
  damage,
  character,
  npcMode = false,
}: ActivationRollFieldsProps) {
  const enabled = rolls != null
  const accuracy = rolls?.accuracy
  const customRolls = rolls?.custom ?? []
  // NPCs have no custom attributes of their own, so the whole notion is hidden
  // for them rather than offered and then refused.
  const customAttributes = npcMode ? [] : (character?.customAttributes ?? [])
  const damageText = damage.trim()

  /**
   * Toggling the feature on seeds an accuracy roll — the common case for an
   * attack ability, and the one whose picker makes the feature self-explanatory.
   */
  const handleEnable = (on: boolean) => {
    if (!on) {
      onChange(undefined)
      return
    }
    onChange({ accuracy: { modifier: { kind: 'attribute', key: 'MAR' } } })
  }

  const patch = (next: ActivationRolls) => onChange(next)

  /** Turning accuracy off must not disturb the other parts. */
  const setAccuracy = (on: boolean) => {
    if (!rolls) return
    const next: ActivationRolls = { ...rolls }
    if (on) next.accuracy = { modifier: { kind: 'attribute', key: 'MAR' } }
    else delete next.accuracy
    patch(next)
  }

  const setAccuracyModifier = (source: ActivationAccuracySource) => {
    if (!rolls?.accuracy) return
    patch({ ...rolls, accuracy: { ...rolls.accuracy, modifier: source } })
  }

  const setAccuracyBonus = (bonus: string) => {
    if (!rolls?.accuracy) return
    const next = { ...rolls.accuracy, bonus }
    patch({
      ...rolls,
      accuracy: bonus.trim() ? next : { modifier: next.modifier },
    })
  }

  const setAccuracyAdvantage = (advantage: number, disadvantage: number) => {
    if (!rolls?.accuracy) return
    patch({
      ...rolls,
      accuracy: withAdvantage(rolls.accuracy, advantage, disadvantage),
    })
  }

  /**
   * The Damage roll has no Advantage/Disadvantage: an accuracy check that
   * reaches a critical hit rolls the damage twice and keeps the higher result
   * (see lib/diceCrit.ts), so it is simply on or off.
   */
  const damageEnabled = rolls?.damage === true

  const setDamage = (on: boolean) => {
    if (!rolls) return
    const next: ActivationRolls = { ...rolls }
    if (on) next.damage = true
    else delete next.damage
    patch(next)
  }

  const setCustomRolls = (custom: ActivationRoll[]) => {
    if (!rolls) return
    const next: ActivationRolls = { ...rolls }
    if (custom.length > 0) next.custom = custom
    else delete next.custom
    patch(next)
  }

  const updateCustomRoll = (index: number, changes: Partial<ActivationRoll>) => {
    setCustomRolls(
      customRolls.map((roll, i) => (i === index ? { ...roll, ...changes } : roll)),
    )
  }

  const setCustomRollAdvantage = (
    index: number,
    advantage: number,
    disadvantage: number,
  ) => {
    setCustomRolls(
      customRolls.map((roll, i) =>
        i === index ? withAdvantage(roll, advantage, disadvantage) : roll,
      ),
    )
  }

  const removeCustomRoll = (index: number) => {
    setCustomRolls(customRolls.filter((_, i) => i !== index))
  }

  /**
   * The picker's options: the five Divergence Attributes, then — on a player
   * sheet that defines any — the sheet's own **custom attributes**, listed by
   * name in the same list.
   *
   * There is deliberately no "Custom attribute…" entry. It used to sit at the
   * bottom as an escape hatch for a sheet that defined none, and all it could do
   * there was look like a choice and change nothing: there was no attribute to
   * pick. A custom attribute is a real thing on a real sheet (see
   * lib/customAttributes.ts), so the picker lists the real ones — and when there
   * are none, a line under the picker says how to get one.
   */
  const accuracyOptions = [
    ...ATTRIBUTE_LIST.map((attr) => ({
      value: `attr:${attr.key}`,
      label: `${attr.name} (${attr.abbreviation})`,
    })),
    ...customAttributes.map((attr) => ({
      value: `custom:${attr.id}`,
      label: attr.shorthand.trim()
        ? `${attr.name} (${attr.shorthand})`
        : `${attr.name} (custom)`,
    })),
  ]

  /**
   * What the picked modifier currently adds. Null when the sheet has no such
   * attribute — a deleted custom attribute, or no sheet open at all — which is
   * also what the notation rolls: an unknown variable is +0.
   */
  const accuracyValue = accuracy
    ? character
      ? accuracyModifierValue(accuracy, character)
      : null
    : null

  /**
   * The accuracy line under the picker. Two states matter: the value the choice
   * currently adds, and a reference the sheet no longer defines (a deleted
   * custom attribute), which rolls as a plain d20.
   */
  const accuracyHint = (() => {
    if (!accuracy) return ''
    if (!character) return 'No sheet open — rolls as a plain d20'
    if (accuracyValue == null) {
      return 'Unknown attribute — rolls as a plain d20'
    }
    const value = `${accuracyValue >= 0 ? '+' : ''}${accuracyValue}`
    return `adds ${value} from ${modifierButtonLabel(accuracy.modifier)}`
  })()

  /**
   * Pick an accuracy modifier. A custom attribute's id is kept as the stable
   * handle while its notation token is re-derived from the sheet, so an
   * attribute that gets renamed still rolls under its current name.
   */
  const chooseAccuracyModifier = (value: string) => {
    if (value.startsWith('custom:')) {
      const attr = findCustomAttributeById(
        customAttributes,
        value.slice('custom:'.length),
      )
      if (attr) {
        setAccuracyModifier({
          kind: 'custom',
          id: attr.id,
          token: customAttributeToken(attr),
        })
      }
      return
    }
    setAccuracyModifier({
      kind: 'attribute',
      key: value.slice('attr:'.length) as AttributeKey,
    })
  }

  return (
    <div className="ability-editor__activation-rolls">
      <label className="ability-editor__field ability-editor__field--inline">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleEnable(e.target.checked)}
        />
        <span className="ability-editor__label">Roll Dice on Activation</span>
      </label>

      {enabled && rolls && (
        <>
          <p className="ability-editor__hint">
            Rolled automatically every time this ability is activated, in this
            order — accuracy, damage, then the custom rolls — and shown together
            in one result window. Works on the GM screen too, where an NPC
            instance rolls with its own stats.
          </p>

          {/* Accuracy ------------------------------------------------------ */}
          <div className="ability-editor__activation-roll-block">
            <label className="ability-editor__field ability-editor__field--inline">
              <input
                type="checkbox"
                checked={accuracy != null}
                onChange={(e) => setAccuracy(e.target.checked)}
              />
              <span className="ability-editor__label">Roll accuracy</span>
            </label>

            {accuracy && (
              <div className="ability-editor__activation-roll-row">
                <SelectDropdown
                  options={accuracyOptions}
                  onSelect={chooseAccuracyModifier}
                  buttonLabel={`d20 + ${modifierButtonLabel(accuracy.modifier)}`}
                  title="Add which attribute?"
                  ariaLabel={`Accuracy attribute: ${modifierButtonLabel(accuracy.modifier)}`}
                  className="ability-editor__activation-attr"
                />

                <input
                  type="text"
                  className="sheet-input ability-editor__activation-bonus"
                  value={accuracy.bonus ?? ''}
                  onChange={(e) => setAccuracyBonus(e.target.value)}
                  placeholder="+2 (optional)"
                  aria-label="Extra accuracy bonus"
                />

                <AdvantageFields
                  advantage={accuracy.advantage ?? 0}
                  disadvantage={accuracy.disadvantage ?? 0}
                  name="Accuracy"
                  onChange={setAccuracyAdvantage}
                />

                <span className="ability-editor__activation-roll-hint">
                  {accuracyHint}
                </span>
              </div>
            )}

            {/* A player sheet with no custom attributes: the picker lists the
                five Attributes and nothing else, so say where the rest come
                from rather than offering an option that could never resolve
                (this line also covers an ability that still *references* a
                custom attribute the sheet no longer has). */}
            {!npcMode && customAttributes.length === 0 && (
              <p className="ability-editor__hint">
                This sheet has no custom attributes — add one in the hero section
                (edit mode) and it appears in this list.
              </p>
            )}

            {accuracy?.modifier.kind === 'custom' &&
              !findCustomAttributeById(customAttributes, accuracy.modifier.id) &&
              npcMode && (
                <p className="ability-editor__hint">
                  This ability references a custom attribute, and NPCs have none
                  — pick one of the five Attributes instead.
                </p>
              )}

            {accuracy?.modifier.kind === 'custom' &&
              !findCustomAttributeById(customAttributes, accuracy.modifier.id) &&
              !npcMode &&
              customAttributes.length > 0 && (
                <p className="ability-editor__hint">
                  That custom attribute is gone, so this rolls a plain d20 until
                  you pick another.
                </p>
              )}
          </div>

          {/* Damage -------------------------------------------------------- */}
          <div className="ability-editor__activation-roll-block">
            <label className="ability-editor__field ability-editor__field--inline">
              <input
                type="checkbox"
                checked={damageEnabled}
                onChange={(e) => setDamage(e.target.checked)}
                disabled={!damageText && !damageEnabled}
              />
              <span className="ability-editor__label">Roll damage</span>
            </label>
            <span className="ability-editor__activation-roll-hint">
              {damageText
                ? `rolls the Damage field: ${damageText}`
                : 'write a Damage expression above to roll it'}
            </span>
          </div>

          {/* Custom rolls -------------------------------------------------- */}
          <div className="ability-editor__activation-roll-block">
            <span className="ability-editor__label">Custom rolls</span>

            {customRolls.length > 0 && (
              <ul className="ability-editor__activation-roll-list" role="list">
                {customRolls.map((roll, index) => (
                  <li
                    key={index}
                    className="ability-editor__activation-roll-item"
                  >
                    <input
                      type="text"
                      className="sheet-input ability-editor__activation-roll-notation"
                      value={roll.notation}
                      onChange={(e) =>
                        updateCustomRoll(index, { notation: e.target.value })
                      }
                      placeholder="e.g. 2d6+POW"
                      aria-label={`Custom roll ${index + 1} notation`}
                    />
                    <input
                      type="text"
                      className="sheet-input ability-editor__activation-roll-label"
                      value={roll.label ?? ''}
                      onChange={(e) =>
                        updateCustomRoll(index, { label: e.target.value })
                      }
                      maxLength={MAX_ACTIVATION_ROLL_LABEL}
                      placeholder="Name (optional)"
                      aria-label={`Custom roll ${index + 1} name`}
                    />
                    <AdvantageFields
                      advantage={roll.advantage ?? 0}
                      disadvantage={roll.disadvantage ?? 0}
                      name={`Custom roll ${index + 1}`}
                      onChange={(advantage, disadvantage) =>
                        setCustomRollAdvantage(index, advantage, disadvantage)
                      }
                    />
                    <label
                      className="ability-editor__field ability-editor__field--inline ability-editor__activation-roll-hidden"
                      title="Keep this roll's result collapsed until it is asked for"
                    >
                      <input
                        type="checkbox"
                        checked={roll.hidden === true}
                        onChange={(e) =>
                          updateCustomRoll(index, { hidden: e.target.checked })
                        }
                      />
                      {/* Plain label text rather than the editor's uppercased
                          field label — this one sits inline with the row's
                          inputs, not above them. */}
                      <span className="ability-editor__activation-roll-hidden-label">
                        Hide result
                      </span>
                    </label>
                    <button
                      type="button"
                      className="btn btn--icon ability-editor__remove-cost-btn"
                      onClick={() => removeCustomRoll(index)}
                      aria-label={`Remove custom roll ${index + 1}`}
                      title="Remove this roll"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {customRolls.length < MAX_ACTIVATION_CUSTOM_ROLLS ? (
              <button
                type="button"
                className="btn btn--ghost ability-editor__add-sub-btn"
                onClick={() => setCustomRolls([...customRolls, newCustomRoll()])}
              >
                + Add Custom Roll
              </button>
            ) : (
              <p className="ability-editor__hint">
                {MAX_ACTIVATION_CUSTOM_ROLLS} custom rolls is the limit — that is
                already a lot to read at the table.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
