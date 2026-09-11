/**
 * Duration metadata for statuses a GM tracks on a GM Screen panel.
 *
 * The five durations are the SRD's condition taxonomy (".hermes.md" /
 * `Divergence SRD.md`): Quick, Persistent, Countdown, Permanent, Conditional.
 * They are **labels only** — the GM Screen runs no timers and expires nothing
 * automatically; a Countdown is ticked down by hand with the pill's stack
 * stepper.
 *
 * Each duration owns a lucide icon and a one-line rules reminder; the color
 * that goes with it per app theme lives in `themeUtils.STATUS_DURATION_COLORS`
 * (the GM Screen is app chrome, so those follow the active theme).
 */

import {
  GitBranch,
  Hourglass,
  Infinity as InfinityIcon,
  RefreshCw,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { PanelStatusDuration } from '@/types'

/**
 * Most stacks one tracked status can hold. Two digits fit the pill's stepper,
 * and no real condition stacks past a handful — the cap is there so a stuck
 * key or a hand-edited record cannot produce a three-digit pill.
 */
export const MAX_PANEL_STATUS_STACKS = 99

/** Display metadata for one status duration. */
export interface StatusDurationMeta {
  /** The stored value. */
  value: PanelStatusDuration
  /** Short label shown on the pill and the picker chip. */
  label: string
  /** One-line reminder of when the duration ends (SRD wording). */
  hint: string
  /** Icon shown beside the label. */
  Icon: LucideIcon
}

/**
 * Every duration, in picker order: shortest-lived first, ending with the two
 * open-ended ones. Stored order matters — `normalizeScreen` validates against
 * this list.
 */
export const STATUS_DURATIONS: StatusDurationMeta[] = [
  {
    value: 'quick',
    label: 'Quick',
    hint: 'Lasts until the end of the target’s next turn.',
    Icon: Zap,
  },
  {
    value: 'persistent',
    label: 'Persistent',
    hint: 'The target saves at the end of each of its turns to end it.',
    Icon: RefreshCw,
  },
  {
    value: 'countdown',
    label: 'Countdown',
    hint: 'Runs for a set number of rounds — tick the stacks down each round.',
    Icon: Hourglass,
  },
  {
    value: 'permanent',
    label: 'Permanent',
    hint: 'Lasts until the end of the conflict.',
    Icon: InfinityIcon,
  },
  {
    value: 'conditional',
    label: 'Conditional',
    hint: 'Lasts only while its condition holds.',
    Icon: GitBranch,
  },
]

/** Metadata for a duration value (never null — the list is exhaustive). */
export function statusDurationMeta(
  value: PanelStatusDuration,
): StatusDurationMeta {
  return STATUS_DURATIONS.find((d) => d.value === value) ?? STATUS_DURATIONS[0]
}

/** Whether an unknown value (e.g. from storage) is a valid duration. */
export function isPanelStatusDuration(
  value: unknown,
): value is PanelStatusDuration {
  return (
    typeof value === 'string' &&
    STATUS_DURATIONS.some((d) => d.value === value)
  )
}
