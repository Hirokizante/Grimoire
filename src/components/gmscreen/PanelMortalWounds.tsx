/**
 * PanelMortalWounds — the Mortal Wound track of one GM Screen panel.
 *
 * BOTH panel kinds carry the same track, because the rule behind it is the
 * same for both (Divergence SRD "Hit Points and Mortal Wounds"): at 0 HP the
 * target rolls a D20 on the Mortal Wounds table, HP resets to its maximum and
 * the excess damage spills over. The panel resolves that roll **for the GM** on
 * either kind — `gmScreenStore.damageInstance` for an NPC instance, which reads
 * its allowance from the base's `npcStats.mortalWounds` (`0` = the mook case,
 * downed at 0 HP with no roll), and `characterStore.takePanelDamage` for a
 * player character, whose two slots are then named rather than left on
 * "Pending Roll" (the player's own sheet keeps its Mortal Wound card and its
 * manual roll; see `takeDamage`).
 *
 * This row is the visible mark of that track, in the panel chrome right under
 * the HP bar: `[skull Wounds n/max | chips… | ⚠ next 0 HP: …]`. It follows
 * the panel status strip's discipline — ONE line that scrolls sideways rather
 * than wraps, so a stack of wounds never makes one panel taller than its
 * neighbour — and, like that strip, it hides its scrollbar and answers a mouse
 * wheel through `useHorizontalWheelScroll`.
 *
 * Wounds persist until cleared (the chip's ✕, the panel menu's "Clear mortal
 * wounds", or an ability that removes one in play) — healing does not erase
 * them, exactly as on a sheet. A slot still awaiting its D20 — which only a
 * player's own sheet can produce — is shown as a dashed `?` chip rather than a
 * made-up result, and the panel's ⋯ menu carries the roll for it: the row is
 * deliberately the same shape on both kinds, so no panel grows a control the
 * other one lacks (the row has no width to spare at phone sizes — see
 * gmscreen.css). The menu carries the manual counterpart too — **Add mortal
 * wound…**, a specific table entry applied with no D20 — for both panel kinds
 * and for the same reason: one line, one shape, both panels.
 *
 * The row is deliberately **props-driven**: it owns no target of its own, so
 * the same markup renders an instance's track (a `{ roll, name }[]` in panel
 * state) and a character's sheet slots (names, two of them) without either kind
 * growing its own copy of the row — the two could not then drift apart.
 */

import { Skull, TriangleAlert, X } from '@/components/ui/icons'
import type { CSSProperties } from 'react'

import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'
import { PENDING_MORTAL_WOUND, mortalWoundByName } from '@/lib/mortalWounds'
import { appThemeStatColors } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import type { MortalWoundRoll } from '@/types'

export interface PanelMortalWoundsProps {
  /** Wounds sustained, in the order they were rolled (or `roll: 0` if pending). */
  wounds: MortalWoundRoll[]
  /** How many the target allows before 0 HP takes it out of the fight. */
  allowance: number
  /** Display name used in control labels ("Clear Damaged Throat from Bandit"). */
  entityName: string
  /** Clear the wound at this index **of `wounds`**, not of any slot list. */
  onClear: (index: number) => void
  /**
   * What a full track means on the next 0 HP. An NPC instance goes `downed`; a
   * character is knocked out and starts Death Saves — the sheet's own word for
   * it. Defaults to "Downed".
   */
  outOfWoundsLabel?: string
  /** Tooltip for the full-track warning, spelling out what happens next. */
  outOfWoundsTitle?: string
}

export default function PanelMortalWounds({
  wounds,
  allowance,
  entityName,
  onClear,
  outOfWoundsLabel = 'Downed',
  outOfWoundsTitle = 'No Mortal Wounds left — reaching 0 HP takes this target out of the fight.',
}: PanelMortalWoundsProps) {
  const appTheme = useAppThemeStore((s) => s.theme)
  // Panel chrome: the app theme's Mortal Wounds accent, the same one the
  // expanded body's stat row uses — never a per-sheet color.
  const tone = appThemeStatColors(appTheme).mortalWounds
  /** The strip hides its scrollbar, so a mouse wheel must move it by hand —
   *  see `useHorizontalWheelScroll`. */
  const setStripNode = useHorizontalWheelScroll<HTMLDivElement>()

  // A target with no wound allowance and none taken shows nothing: the mook
  // case (`npcStats.mortalWounds: 0`) renders exactly the panel it always did.
  if (allowance <= 0 && wounds.length === 0) return null

  // No wound left to take: the next time this target reaches 0 HP it goes
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
          ref={setStripNode}
          role="list"
          aria-label={`Mortal Wounds on ${entityName}`}
        >
          {wounds.map((wound, index) => {
            const isPending = wound.name === PENDING_MORTAL_WOUND
            const entry = mortalWoundByName(wound.name)
            const roll = isPending
              ? 'not rolled yet'
              : wound.roll > 0
                ? `d20 ${wound.roll}`
                : 'no roll recorded'
            return (
              <span
                key={`${wound.name}-${index}`}
                className={`gm-mw__chip${isPending ? ' gm-mw__chip--pending' : ''}`}
                role="listitem"
                title={
                  isPending
                    ? 'Pending Roll — this wound has no D20 result yet; roll it from the panel menu.'
                    : `${wound.name} (${roll})${entry ? ` — ${entry.description}` : ''}`
                }
              >
                {isPending ? (
                  <span className="gm-mw__roll gm-mw__roll--pending">?</span>
                ) : (
                  wound.roll > 0 && <span className="gm-mw__roll">{wound.roll}</span>
                )}
                <span className="gm-mw__name">{wound.name}</span>
                <button
                  type="button"
                  className="btn btn--icon gm-mw__clear"
                  onClick={() => onClear(index)}
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
        <span className="gm-mw__warn" title={outOfWoundsTitle}>
          <TriangleAlert size={11} aria-hidden="true" />
          Next 0 HP: {outOfWoundsLabel}
        </span>
      )}
    </div>
  )
}
