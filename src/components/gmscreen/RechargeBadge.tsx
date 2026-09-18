/**
 * RechargeBadge — the GM Screen's live read-out of one NPC ability's Recharge
 * trait.
 *
 * It renders **inside the ability's own trait chip**, in place of the authored
 * "Recharge (4)" text: the trait is the cooldown, so printing a separate badge
 * below the card duplicated the same information twice. The card supplies the
 * chip (each card kind has its own pill style) and this supplies the content:
 *
 *   - idle: "⧗ Recharge 4" — usable, but using it starts a cooldown;
 *   - cooling: "⧗ On cooldown — Recharge 4", which also tints the chip.
 *
 * The rules reminder (which die, what triggers the roll) lives in the tooltip
 * so the chip stays one short line inside a panel-width column.
 *
 * A cooling badge also carries the GM's **manual override**: the small ↻ beside
 * "On cooldown" takes the ability off cooldown there and then, without waiting
 * for — or rolling — the Recharge Die. The button exists only while cooling, so
 * an idle badge is exactly the read-out it always was, and it only renders when
 * the caller supplies {@link RechargeBadgeProps.onClearCooldown} (a surface with
 * no live panel state stays a plain badge).
 */

import { Hourglass, RotateCw } from 'lucide-react'

export interface RechargeBadgeProps {
  /** The ability's Recharge value (`Recharge (4)` → 4). */
  value: number
  /** Whether the ability is currently waiting on a Recharge Die roll. */
  onCooldown: boolean
  /**
   * Take the ability off cooldown by hand (the GM's override of the Recharge
   * Die). Omit to render a read-only badge; the button appears only while
   * cooling.
   */
  onClearCooldown?: () => void
  /** Ability name for the button's accessible label and tooltip. */
  abilityName?: string
}

export default function RechargeBadge({
  value,
  onCooldown,
  onClearCooldown,
  abilityName,
}: RechargeBadgeProps) {
  const title = onCooldown
    ? `On cooldown. At the start of this NPC's next turn, the Recharge Die (1d6) must roll ${value} or higher for this ability to be usable again.`
    : `Recharge ${value}: using this ability puts it on cooldown until the start of the NPC's next turn, where a Recharge Die (1d6) roll of ${value} or higher brings it back.`
  const name = abilityName || 'this ability'

  return (
    <span
      className={'gm-recharge' + (onCooldown ? ' gm-recharge--cooling' : '')}
      title={title}
    >
      <Hourglass size={11} aria-hidden="true" />
      {onCooldown ? `On cooldown — Recharge ${value}` : `Recharge ${value}`}
      {onCooldown && onClearCooldown && (
        <button
          type="button"
          className="btn btn--icon gm-recharge__clear"
          onClick={onClearCooldown}
          aria-label={`Take ${name} off cooldown`}
          title={`Take ${name} off cooldown without rolling the Recharge Die`}
        >
          <RotateCw size={11} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
