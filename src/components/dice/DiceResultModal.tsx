/**
 * DiceResultModal — the full-screen post-roll breakdown.
 *
 * VTT-inspired layout:
 *   - Big total on top, with natural-20 / natural-1 badge if applicable
 *   - Color-coded breakdown of every term (dice, attributes, constants)
 *   - The original roll source (ability, manual note, etc.) so players
 *     remember *why* this roll happened
 *   - Done button + click-outside-to-dismiss + Esc to dismiss
 *
 * Every result also carries **Advantage/Disadvantage controls**: enter the
 * dice of each, press the button, and the net value is rolled as that many d6s
 * (highest die added for Advantage, subtracted for Disadvantage) and folded
 * into the total. The d6s are rolled here, *after* the initial roll, and the
 * roll-log entry created when the roll happened is updated in place — see
 * lib/diceAdvantage.ts. Authored values on an ability's activation rolls
 * arrive pre-filled and already applied.
 *
 * It renders two shapes, and the store decides which is open:
 *
 *   - **one roll** (dice notation clicked anywhere on a sheet), and
 *   - **an activation** — every roll one Activate press performed (accuracy,
 *     damage, custom; see lib/activationRolls.ts), stacked in the order they
 *     were rolled and headed by the ability's name. They are shown together on
 *     purpose: an attack is one action, so its accuracy and damage read as one
 *     result rather than two modals to dismiss. A roll the author marked
 *     "hide result" starts collapsed behind a **Show result** toggle, which
 *     keeps a long optional list readable without dropping the numbers.
 */

import { useState } from 'react'

import DiceTermBreakdown from '@/components/dice/DiceTermBreakdown'
import { useModalDialog } from '@/hooks/useModalDialog'
import {
  useDiceRollStore,
  type ActivationRollRequest,
} from '@/store/diceRollStore'
import { isNaturalOne, isNaturalTwenty, type RollCritical } from '@/lib/diceCrit'
import {
  MAX_ADVANTAGE_VALUE,
  normalizeAdvantageValue,
  type RollAdvantage,
} from '@/lib/diceAdvantage'
import { sourceLabel } from '@/lib/rollSourceUtils'

export interface DiceResultModalProps {
  onClose: () => void
  style?: React.CSSProperties
}

/**
 * The Advantage/Disadvantage inputs for one roll.
 *
 * Local state holds exactly what the user typed until the button is pressed;
 * `applied` is what the store last rolled. Pressing the button with a net of
 * zero and an adjustment in place clears it (restoring the base total).
 */
function AdvantageControls({
  applied,
  initialAdvantage,
  initialDisadvantage,
  name,
  onApply,
}: {
  applied?: RollAdvantage
  initialAdvantage: number
  initialDisadvantage: number
  name: string
  onApply: (advantage: number, disadvantage: number) => void
}) {
  const [advantage, setAdvantage] = useState(initialAdvantage)
  const [disadvantage, setDisadvantage] = useState(initialDisadvantage)
  const net = advantage - disadvantage
  const canRoll = net !== 0 || applied != null
  const highest = applied ? Math.max(...applied.rolls) : 0
  const actionLabel =
    net === 0 && applied
      ? 'Clear'
      : net < 0
        ? 'Roll Disadvantage'
        : 'Roll Advantage'

  const parseInput = (raw: string) =>
    raw.trim() === '' ? 0 : normalizeAdvantageValue(Number(raw))

  return (
    <div className="dice-advantage">
      <div className="dice-advantage__controls">
        <label className="dice-advantage__field">
          <span className="dice-advantage__field-label">Advantage</span>
          <input
            type="number"
            min={0}
            max={MAX_ADVANTAGE_VALUE}
            className="dice-advantage__input"
            value={advantage}
            onChange={(e) => setAdvantage(parseInput(e.target.value))}
            aria-label={`${name} advantage`}
          />
        </label>
        <label className="dice-advantage__field">
          <span className="dice-advantage__field-label">Disadvantage</span>
          <input
            type="number"
            min={0}
            max={MAX_ADVANTAGE_VALUE}
            className="dice-advantage__input"
            value={disadvantage}
            onChange={(e) => setDisadvantage(parseInput(e.target.value))}
            aria-label={`${name} disadvantage`}
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost dice-advantage__roll"
          disabled={!canRoll}
          onClick={() => onApply(advantage, disadvantage)}
          title={
            applied
              ? 'Re-roll the Advantage/Disadvantage dice for this result'
              : 'Roll the Advantage/Disadvantage dice'
          }
        >
          {actionLabel}
        </button>
      </div>

      {applied && (
        <div
          className="dice-advantage__result"
          role="status"
          aria-live="polite"
        >
          <span
            className={`dice-advantage__kind dice-advantage__kind--${applied.kind}`}
          >
            {applied.kind === 'advantage' ? 'Advantage' : 'Disadvantage'} +
            {applied.dice}
          </span>
          <span className="dice-advantage__rolls">
            {applied.rolls.map((roll, i) => (
              <span
                key={i}
                className={`dice-modal__roll${
                  roll === highest ? ' dice-modal__roll--max' : ''
                }`}
              >
                {roll}
              </span>
            ))}
          </span>
          <span className="dice-advantage__modifier">
            {applied.modifier >= 0 ? '+' : '−'}
            {Math.abs(applied.modifier)}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * The critical-hit control for one damage roll.
 *
 * A critical hit rolls the damage expression twice and keeps the higher
 * result. Pressing the button marks it (which rolls the second time) and
 * pressing again removes it, restoring the first roll exactly. Both totals are
 * shown so the table can see what the two rolls were.
 */
function CriticalControl({
  applied,
  onToggle,
}: {
  applied?: RollCritical
  onToggle: () => void
}) {
  const [first, second] = applied?.rolls ?? []
  const kept = applied ? applied.rolls[applied.chosen] : undefined

  return (
    <div className="dice-critical">
      <button
        type="button"
        className={`btn btn--ghost dice-critical__toggle${
          applied ? ' dice-critical__toggle--active' : ''
        }`}
        aria-pressed={applied != null}
        onClick={onToggle}
        title={
          applied
            ? 'Remove the critical hit and restore the first damage roll'
            : 'Roll the damage a second time and keep the higher result'
        }
      >
        {applied ? 'Remove Critical' : 'Critical Hit'}
      </button>

      {applied && first && second && kept && (
        <div className="dice-critical__result" role="status" aria-live="polite">
          <span className="dice-critical__kind">Critical hit</span>
          <span className="dice-critical__compare">
            <span
              className={`dice-critical__roll${
                applied.chosen === 0 ? ' dice-critical__roll--kept' : ''
              }`}
            >
              {first.total}
            </span>
            <span className="dice-critical__vs">vs</span>
            <span
              className={`dice-critical__roll${
                applied.chosen === 1 ? ' dice-critical__roll--kept' : ''
              }`}
            >
              {second.total}
            </span>
          </span>
          <span className="dice-critical__kept">keeps {kept.total}</span>
        </div>
      )}
    </div>
  )
}

/** One roll inside an activation: heading, total, its adjustment, breakdown. */
function ActivationRollCard({
  roll,
  index,
}: {
  roll: ActivationRollRequest
  index: number
}) {
  const [revealed, setRevealed] = useState(!roll.hidden)
  const applyAdvantage = useDiceRollStore((s) => s.applyActivationAdvantage)
  const toggleCritical = useDiceRollStore((s) => s.toggleActivationCritical)
  const { result } = roll
  const naturalTwenty = isNaturalTwenty(result)
  const naturalOne = isNaturalOne(result)
  const applied = result.advantage
  // Damage rolls are the ones a critical hit applies to, so they carry the
  // Critical control instead of Advantage/Disadvantage.
  const isDamage = roll.kind === 'damage'

  return (
    <article
      className={`dice-activation__roll dice-activation__roll--${roll.kind}`}
      aria-label={`${roll.groupLabel}${roll.label ? `: ${roll.label}` : ''}`}
    >
      <div className="dice-activation__roll-head">
        <span className="dice-activation__roll-kind">{roll.groupLabel}</span>
        {roll.label && (
          <span className="dice-activation__roll-label">{roll.label}</span>
        )}
        <span className="dice-activation__roll-notation">{roll.notation}</span>
      </div>

      <div className="dice-activation__roll-total-row">
        {/* Announced as a whole for a screen reader, which cannot read the
          * notation on its own ("d20+MAR, total 19"). */}
        <span
          className="dice-activation__roll-total"
          aria-label={`${roll.label ?? roll.groupLabel}, ${roll.notation}, total ${result.total}`}
          title="Total"
        >
          {result.total}
        </span>
        {result.critical && (
          <span className="dice-badge dice-badge--crit">✦ CRIT</span>
        )}
        {naturalTwenty && <span className="dice-badge dice-badge--crit">★ NAT 20</span>}
        {naturalOne && <span className="dice-badge dice-badge--fail">✗ NAT 1</span>}
        {roll.hidden && (
          <button
            type="button"
            className="btn btn--ghost dice-activation__reveal"
            aria-expanded={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? 'Hide result' : 'Show result'}
          </button>
        )}
      </div>

      {isDamage ? (
        <CriticalControl
          applied={result.critical}
          onToggle={() => toggleCritical(index)}
        />
      ) : (
        <AdvantageControls
          applied={applied}
          initialAdvantage={applied?.advantage ?? roll.advantage ?? 0}
          initialDisadvantage={applied?.disadvantage ?? roll.disadvantage ?? 0}
          name={roll.label ?? roll.groupLabel}
          onApply={(advantage, disadvantage) =>
            applyAdvantage(index, advantage, disadvantage)
          }
        />
      )}

      {revealed && (
        <>
          <DiceTermBreakdown result={result} />
          <p className="dice-modal__breakdown">{result.breakdown}</p>
        </>
      )}
    </article>
  )
}

/** Every roll of one activation, in the order they were rolled. */
function ActivationResultGroup({ rolls }: { rolls: ActivationRollRequest[] }) {
  return (
    <>
      {rolls.map((roll, i) => (
        <ActivationRollCard key={`${roll.kind}-${i}`} roll={roll} index={i} />
      ))}
    </>
  )
}

export default function DiceResultModal({ onClose, style }: DiceResultModalProps) {
  const result = useDiceRollStore((s) => s.result)
  const source = useDiceRollStore((s) => s.source)
  const activation = useDiceRollStore((s) => s.activation)
  const applyAdvantage = useDiceRollStore((s) => s.applyAdvantage)
  const toggleCritical = useDiceRollStore((s) => s.toggleCritical)

  const dialogRef = useModalDialog(onClose)

  if (!result && !activation) return null

  const isActivation = activation != null && activation.rolls.length > 0
  const label = isActivation
    ? activation.abilityName
    : sourceLabel(source) ?? 'Roll Result'
  // A damage expression clicked from an Ability Block's Damage field is the
  // manual damage roll, so it carries the Critical control rather than
  // Advantage/Disadvantage.
  const isDamageRoll = source?.type === 'ability-damage'

  return (
    <div
      className="modal-overlay"
      style={style}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={
          'modal-content dice-modal' +
          (isActivation ? ' dice-modal--activation' : '')
        }
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{label}</h3>
        </div>

        <div className="dice-modal__body">
          {isActivation ? (
            <div
              className="dice-activation"
              role="status"
              aria-live="polite"
              aria-label={`Activation rolls for ${activation.abilityName}`}
            >
              <ActivationResultGroup rolls={activation.rolls} />
            </div>
          ) : result ? (
            <>
              {/* Big total */}
              <div className="dice-modal__total-row">
                <h2 className="dice-modal__total">{result.total}</h2>
                {result.critical && (
                  <span className="dice-badge dice-badge--crit">✦ CRIT</span>
                )}
                {isNaturalTwenty(result) && (
                  <span className="dice-badge dice-badge--crit">★ NAT 20</span>
                )}
                {isNaturalOne(result) && (
                  <span className="dice-badge dice-badge--fail">✗ NAT 1</span>
                )}
              </div>

              <DiceTermBreakdown result={result} />

              {/* Breakdown */}
              <p className="dice-modal__breakdown">{result.breakdown}</p>

              {isDamageRoll ? (
                <CriticalControl
                  applied={result.critical}
                  onToggle={toggleCritical}
                />
              ) : (
                <AdvantageControls
                  applied={result.advantage}
                  initialAdvantage={result.advantage?.advantage ?? 0}
                  initialDisadvantage={result.advantage?.disadvantage ?? 0}
                  name="Roll"
                  onApply={applyAdvantage}
                />
              )}
            </>
          ) : null}

          <button
            type="button"
            className="btn btn--primary dice-modal__dismiss"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
