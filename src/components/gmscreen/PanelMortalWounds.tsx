/**
 * PanelMortalWounds — the Mortal Wound track of one NPC instance panel.
 *
 * An NPC instance follows the same rule as a player sheet (Divergence SRD "Hit
 * Points and Mortal Wounds"): at 0 HP it rolls a D20 on the Mortal Wounds
 * table, HP resets to its maximum and the excess damage spills over. Two
 * differences belong to the panel:
 *
 *  - the roll happens **automatically**, inside
 *    `gmScreenStore.damageInstance` — a GM running four bandits should not have
 *    to click a second card per knockout; and
 *  - how many wounds the NPC may take is the base record's
 *    `npcStats.mortalWounds` stat, so a mook with `0` simply goes down at 0 HP
 *    while a boss can soak two or three.
 *
 * This row is the visible mark of that track, in the panel chrome right under
 * the HP bar: `[skull Wounds n/max | chips… | ⚠ next 0 HP: Downed]`. It follows
 * the panel status strip's discipline — ONE line that scrolls sideways rather
 * than wraps, so a stack of wounds never makes one panel taller than its
 * neighbour — and it renders **nothing at all** for an NPC that can take no
 * wounds and has none (`mortalWounds: 0`), which is why adding it changes no
 * existing panel's height.
 *
 * Wounds persist until cleared (the chip's ✕, the panel menu's "Clear mortal
 * wounds", or an ability that removes one in play) — healing does not erase
 * them, exactly as on a sheet.
 */

import { Skull, TriangleAlert, X } from 'lucide-react'
import type { CSSProperties } from 'react'

import { mortalWoundByName } from '@/lib/mortalWounds'
import { appThemeStatColors } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import type { MortalWoundRoll } from '@/types'

export interface PanelMortalWoundsProps {
  screenId: string
  panelId: string
  /** Wounds this instance has sustained, in the order they were rolled. */
  wounds: MortalWoundRoll[]
  /** How many the base allows before 0 HP downs the instance. */
  allowance: number
  /** Display name used in control labels ("Clear Damaged Throat from Bandit"). */
  entityName: string
}

export default function PanelMortalWounds({
  screenId,
  panelId,
  wounds,
  allowance,
  entityName,
}: PanelMortalWoundsProps) {
  const clearWound = useGMScreenStore((s) => s.clearInstanceMortalWound)
  const appTheme = useAppThemeStore((s) => s.theme)
  // Panel chrome: the app theme's Mortal Wounds accent, the same one the
  // expanded body's stat row uses — never a per-sheet color.
  const tone = appThemeStatColors(appTheme).mortalWounds

  // An NPC with no wound allowance and none taken shows nothing: the mook case
  // (`npcStats.mortalWounds: 0`) renders exactly the panel it always did.
  if (allowance <= 0 && wounds.length === 0) return null

  // No wound left to take: the next time this instance reaches 0 HP it goes
  // down instead of rolling (the sheet's "Critical Condition" warning, in one
  // glance-readable line).
  const outOfWounds = wounds.length >= allowance

  return (
    <div className="gm-mw" style={{ '--mw-tone': tone } as CSSProperties}>
      <Skull size={14} className="gm-mw__icon" aria-hidden="true" />
      <span className="gm-bar__label" title="Mortal Wounds sustained / allowed">
        Wounds
      </span>
      <span className="gm-bar__value">
        {wounds.length}
        <span className="gm-bar__max">/{allowance}</span>
      </span>

      {wounds.length > 0 && (
        <div
          className="gm-mw__strip"
          role="list"
          aria-label={`Mortal Wounds on ${entityName}`}
        >
          {wounds.map((wound, index) => {
            const entry = mortalWoundByName(wound.name)
            const roll = wound.roll > 0 ? `d20 ${wound.roll}` : 'no roll recorded'
            return (
              <span
                key={`${wound.name}-${index}`}
                className="gm-mw__chip"
                role="listitem"
                title={`${wound.name} (${roll})${entry ? ` — ${entry.description}` : ''}`}
              >
                {wound.roll > 0 && <span className="gm-mw__roll">{wound.roll}</span>}
                <span className="gm-mw__name">{wound.name}</span>
                <button
                  type="button"
                  className="btn btn--icon gm-mw__clear"
                  onClick={() => clearWound(screenId, panelId, index)}
                  aria-label={`Clear ${wound.name} from ${entityName}`}
                  title={`Clear ${wound.name}`}
                >
                  <X size={11} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {outOfWounds && (
        <span
          className="gm-mw__warn"
          title="This NPC has no Mortal Wounds left — reaching 0 HP now downs it."
        >
          <TriangleAlert size={11} aria-hidden="true" />
          Next 0 HP: Downed
        </span>
      )}
    </div>
  )
}
