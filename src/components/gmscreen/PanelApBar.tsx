/**
 * PanelApBar — the Action Point meter every GM Screen panel shows under its HP
 * bar.
 *
 * Player panels and NPC instances own AP very differently: a character's
 * `currentAP` lives on its sheet record and is shared with the player, while an
 * NPC instance keeps its own turn budget on the panel. The *meter* is the same
 * thing though, so both kinds render this one component — the sheet's own
 * segmented bar wrapped in the panel's shared bar chrome (a label row plus a
 * `[−] track [+]` control row of {@link PanelStepper}s), directly below
 * {@link PanelHpBar}.
 *
 * Before this existed the two panel kinds read differently: an NPC panel had
 * the meter in its chrome while a player panel only had one inside the sheet
 * body, which is collapsed by default — so the resource a GM spends on every
 * activation was invisible until the panel was expanded.
 *
 * The turn button appears exactly when AP hits 0, which is the moment a GM
 * reaches for it. What a turn *does* belongs to the caller, because it differs
 * per entity: an NPC instance rolls its Recharge Die, a player character runs
 * the sheet's End Turn (AP → END, then END Recovery).
 */

import type { ReactNode } from 'react'
import { RotateCcw, Zap } from '@/components/ui/icons'

import SegmentedBar from '@/components/ui/SegmentedBar'
import PanelStepper from '@/components/gmscreen/PanelStepper'
import { MAX_AP } from '@/constants/gameData'
import { appThemeColorVars } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'

export interface PanelApBarProps {
  /** Action Points left this turn. */
  ap: number
  /** Spend 1 AP (the − stepper; disabled at 0). */
  onSpend: () => void
  /** Restore 1 AP (the + stepper; disabled at the 3 AP maximum). */
  onRestore: () => void
  /** Start the entity's next turn. Runs only from the button, which is
   *  rendered only once AP reaches 0. */
  onStartTurn: () => void
  /** Tooltip on the turn button, describing what a turn does for this entity. */
  startTurnTitle: string
  /** Optional pill pinned to the right of the label row (an NPC instance's
   *  "N on cooldown" count). */
  status?: ReactNode
}

export default function PanelApBar({
  ap,
  onSpend,
  onRestore,
  onStartTurn,
  startTurnTitle,
  status,
}: PanelApBarProps) {
  // Panel chrome follows the app theme, like every other token and bar in a
  // panel — never a sheet's own palette.
  const appTheme = useAppThemeStore((s) => s.theme)
  const apColor = appThemeColorVars(appTheme)['--ap-bar-color']

  return (
    <div className="gm-ap">
      <div className="gm-ap__row">
        <Zap
          size={14}
          className="gm-ap__icon"
          style={{ color: apColor }}
          aria-hidden="true"
        />
        <span className="gm-bar__label">Action Points</span>
        <span className="gm-bar__value">
          {ap}
          <span className="gm-bar__max">/{MAX_AP}</span>
        </span>
        {status}
      </div>
      <div className="gm-bar__controls">
        <PanelStepper
          direction="spend"
          onClick={onSpend}
          disabled={ap <= 0}
          label="Spend Action Points"
          title="Spend 1 AP"
        />
        <div className="gm-ap__track" title="Action Points for this turn">
          <SegmentedBar label="" value={ap} max={MAX_AP} color={apColor} />
        </div>
        <PanelStepper
          direction="restore"
          onClick={onRestore}
          disabled={ap >= MAX_AP}
          label="Restore Action Points"
          title="Restore 1 AP"
        />
        {ap === 0 && (
          <button
            type="button"
            className="btn btn--primary gm-ap__turn"
            onClick={onStartTurn}
            title={startTurnTitle}
          >
            <RotateCcw size={13} aria-hidden="true" />
            Start new turn
          </button>
        )}
      </div>
    </div>
  )
}
