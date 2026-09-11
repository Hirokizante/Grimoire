/**
 * BokehMote — one mote of the Arcane Glow dust field.
 *
 * Shared by the home page scene (ArcaneGlowAnimation) and the Settings
 * picker's thumbnail, so both always show the same dust: the same tints, the
 * same depth tiers, and the same custom properties the stylesheet animates.
 * The class list comes from `moteClassName` in bokehField.ts; the styles live
 * under `.arcane-mote` in App.css.
 */

import type { CSSProperties } from 'react'

import { moteClassName, type BokehParticle } from './bokehField'

/** Inline custom properties the stylesheet reads for one mote. */
type MoteStyle = CSSProperties & Record<`--${string}`, string>

function moteStyle(mote: BokehParticle): MoteStyle {
  return {
    left: `${mote.x}%`,
    top: `${mote.y}%`,
    '--bokeh-size': `${mote.size}px`,
    '--bokeh-opacity': `${mote.opacity}`,
    '--drift-x': `${mote.driftX}px`,
    '--drift-y': `${mote.driftY}px`,
    '--drift-duration': `${mote.driftSeconds}s`,
    '--drift-delay': `${mote.driftDelay}s`,
    '--pulse-duration': `${mote.pulseSeconds}s`,
    '--pulse-delay': `${mote.pulseDelay}s`,
  }
}

export default function BokehMote({ mote }: { mote: BokehParticle }) {
  return <span className={moteClassName(mote)} style={moteStyle(mote)} />
}
