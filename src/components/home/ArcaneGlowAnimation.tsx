/**
 * ArcaneGlowAnimation — the default home page background: a slow, cinematic
 * "light through a dark hall" scene in the spirit of a console dynamic
 * background.
 *
 * Four layers, painted back to front by the CSS in App.css:
 *   1. a cool haze pooled where the light lands, in the bottom-left corner;
 *   2. a fan of light shafts entering from above the frame — a broad cone, a
 *      hotter core inside it and a fainter third ray — so the beam reads as
 *      light in air, not a decal;
 *   3. a drifting bokeh field — out-of-focus motes at three depths, the ones
 *      caught inside the shaft glowing warmer and brighter;
 *   4. a vignette that keeps the centre (title + nav) legible.
 *
 * The field itself is authored from a fixed seed in `bokehField.ts`. Each
 * mote animates only `transform` and `opacity`, so the scene composites on
 * the GPU instead of repainting.
 *
 * Deliberately inert: `pointer-events: none` and `aria-hidden`, and the CSS
 * freezes every animation under `prefers-reduced-motion: reduce`.
 */

import BokehMote from './BokehMote'
import { buildBokehField } from './bokehField'

/** The authored field — generated once per module load. */
const BOKEH_FIELD = buildBokehField()

export default function ArcaneGlowAnimation() {
  return (
    <div className="home-page__arcane" aria-hidden="true">
      {/* Air: a cool pool of haze where the light lands, bottom-left. */}
      <div className="home-page__arcane-mist" />

      {/* The shafts: a broad cone, the bright core inside it and a fainter
          third ray, drawn as SVG polygons so their edges converge on an apex
          above the frame (a rotated rectangle cannot diverge). The wrapper
          blurs them and blends them with `screen`; each polygon fades along
          its own length, so the light is gone by the lower third. */}
      <div className="home-page__arcane-shafts">
        <svg
          className="home-page__arcane-shafts-svg"
          viewBox="0 -14 100 128"
          preserveAspectRatio="none"
          focusable="false"
        >
          <defs>
            <linearGradient
              id="arcaneShaftBroad"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="-14"
              x2="0"
              y2="114"
            >
              <stop offset="0" stopColor="var(--arcane-light)" stopOpacity="0.2" />
              <stop offset="0.2" stopColor="var(--arcane-light)" stopOpacity="0.15" />
              <stop offset="0.4" stopColor="var(--arcane-light)" stopOpacity="0.15" />
              <stop offset="0.6" stopColor="var(--arcane-light)" stopOpacity="0.11" />
              <stop offset="0.78" stopColor="var(--arcane-light)" stopOpacity="0.06" />
              <stop offset="0.95" stopColor="var(--arcane-light)" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="arcaneShaftCore"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="-14"
              x2="0"
              y2="114"
            >
              <stop offset="0" stopColor="var(--arcane-light)" stopOpacity="0.74" />
              <stop offset="0.12" stopColor="var(--arcane-light)" stopOpacity="0.4" />
              <stop offset="0.28" stopColor="var(--arcane-light)" stopOpacity="0.16" />
              <stop offset="0.45" stopColor="var(--arcane-light)" stopOpacity="0.09" />
              <stop offset="0.62" stopColor="var(--arcane-light)" stopOpacity="0.04" />
              <stop offset="0.78" stopColor="var(--arcane-light)" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="arcaneShaftRay"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="-14"
              x2="0"
              y2="114"
            >
              <stop offset="0" stopColor="var(--arcane-light)" stopOpacity="0.12" />
              <stop offset="0.25" stopColor="var(--arcane-light)" stopOpacity="0.07" />
              <stop offset="0.45" stopColor="var(--arcane-light)" stopOpacity="0.03" />
              <stop offset="0.65" stopColor="var(--arcane-light)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points="0,-14 28,-14 53,114 5,114"
            fill="url(#arcaneShaftBroad)"
          />
          <polygon
            points="7,-14 19,-14 34,98.6 10,98.6"
            fill="url(#arcaneShaftCore)"
          />
          <polygon
            points="15,-14 29,-14 66,96.1 32,96.1"
            fill="url(#arcaneShaftRay)"
          />
        </svg>
      </div>

      {/* Dust hanging in the light. */}
      <div className="home-page__arcane-bokeh">
        {BOKEH_FIELD.map((mote) => (
          <BokehMote key={mote.id} mote={mote} />
        ))}
      </div>

      <div className="home-page__arcane-vignette" />
    </div>
  )
}
