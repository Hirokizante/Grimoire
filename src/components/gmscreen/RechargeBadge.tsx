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
 */

import { Hourglass } from 'lucide-react'

export interface RechargeBadgeProps {
  /** The ability's Recharge value (`Recharge (4)` → 4). */
  value: number
  /** Whether the ability is currently waiting on a Recharge Die roll. */
  onCooldown: boolean
}

export default function RechargeBadge({ value, onCooldown }: RechargeBadgeProps) {
  const title = onCooldown
    ? `On cooldown. At the start of this NPC's next turn, the Recharge Die (1d6) must roll ${value} or higher for this ability to be usable again.`
    : `Recharge ${value}: using this ability puts it on cooldown until the start of the NPC's next turn, where a Recharge Die (1d6) roll of ${value} or higher brings it back.`

  return (
    <span
      className={'gm-recharge' + (onCooldown ? ' gm-recharge--cooling' : '')}
      title={title}
    >
      <Hourglass size={11} aria-hidden="true" />
      {onCooldown ? `On cooldown — Recharge ${value}` : `Recharge ${value}`}
    </span>
  )
}
