/**
 * The Arcane Glow bokeh field — where every dust mote in the home page
 * background sits, how big it is, and how it drifts.
 *
 * Kept out of ArcaneGlowAnimation.tsx so that file exports components only
 * (React Fast Refresh), and so the field can be unit-tested on its own.
 *
 * The field is generated from a fixed seed: the scene is *authored*, not
 * random per mount, so navigating away from the home page and back does not
 * reshuffle the sky. (The inline `Math.random()` this replaced had exactly
 * that bug — every re-render teleported every mote.)
 */

/** Depth of a mote. Near motes are large and soft (heavy bokeh), far ones are
 *  near-pinpoint specks that read as distance. */
export type BokehTier = 'far' | 'mid' | 'near'

/** Tint of a mote: warm light-caught dust, cool background dust, or a mote
 *  carrying the app theme's accent. */
export type BokehTone = 'warm' | 'cool' | 'arcane'

export interface BokehParticle {
  id: string
  /** Centre position, as a percentage of the layer's width/height. */
  x: number
  y: number
  /** Diameter in pixels. */
  size: number
  tier: BokehTier
  tone: BokehTone
  /** Rendered opacity; motes in the light are already boosted here. */
  opacity: number
  /** How strongly the shaft lights this mote, 0 (outside) → 1 (core). */
  lit: number
  /** Peak drift offset in pixels, and how long one there-and-back lap takes. */
  driftX: number
  driftY: number
  driftSeconds: number
  /** Negative, so motes start mid-drift instead of all moving in lockstep. */
  driftDelay: number
  /** Twinkle period and phase offset, in seconds. */
  pulseSeconds: number
  pulseDelay: number
  /** Out-of-focus disc with a bright rim (a true bokeh ball) rather than a
   *  plain soft blob. Only some large motes render this way. */
  ring: boolean
}

interface TierSpec {
  count: number
  size: [number, number]
  opacity: [number, number]
  drift: [number, number]
  seconds: [number, number]
  /** Share of this tier's motes placed in the dense right-hand cloud. */
  cloudBias: number
}

const TIERS: Record<BokehTier, TierSpec> = {
  // Pinpoint dust: most of the field, nearly still.
  far: {
    count: 80,
    size: [1.1, 2.8],
    opacity: [0.34, 0.78],
    drift: [8, 26],
    seconds: [110, 190],
    cloudBias: 0.45,
  },
  // Mid-depth motes: soft, but still small.
  mid: {
    count: 36,
    size: [3, 7.5],
    opacity: [0.26, 0.58],
    drift: [14, 42],
    seconds: [80, 150],
    cloudBias: 0.55,
  },
  // Near motes: the big out-of-focus discs that sell the depth of field.
  near: {
    count: 16,
    size: [10, 26],
    opacity: [0.3, 0.55],
    drift: [22, 64],
    seconds: [60, 125],
    cloudBias: 0.72,
  },
}

/**
 * Mulberry32 — a tiny deterministic PRNG. The field must be identical on
 * every mount, so the scene is authored from a fixed seed rather than from
 * `Math.random()`.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * How strongly the shaft lights a point, 0 (outside) → 1 (centre of the
 * beam). Mirrors the geometry the CSS beams use — a cone leaving the
 * top-left corner, widening as it descends — so motes that sit in the light
 * glow and motes in the dark corners stay dim.
 */
function beamLight(x: number, y: number): number {
  // Matches the SVG shaft polygons in ArcaneGlowAnimation.tsx: the cone's
  // centre line drifts right as it falls and its half-width grows with depth.
  const halfWidth = 0.11 + 0.16 * y
  const centre = 0.18 + 0.2 * y
  const offset = Math.abs(x - centre)
  return offset >= halfWidth ? 0 : 1 - offset / halfWidth
}

/**
 * Build the bokeh field. Pure and seeded: the same field comes back every
 * call, which is what the unit test pins.
 */
export function buildBokehField(seed = 0x5eed1e): BokehParticle[] {
  const rand = mulberry32(seed)
  const range = ([min, max]: [number, number]) => min + rand() * (max - min)
  const round = (n: number) => Math.round(n * 10) / 10
  const particles: BokehParticle[] = []

  const tiers: BokehTier[] = ['far', 'mid', 'near']

  for (const tier of tiers) {
    const spec = TIERS[tier]
    for (let i = 0; i < spec.count; i += 1) {
      // Placement: a dense cloud on the right, a loose scatter through the
      // lower-left where the shaft lands, and a thin dusting everywhere else.
      const roll = rand()
      let x: number
      let y: number
      if (roll < spec.cloudBias) {
        x = 52 + rand() * 52
        y = 22 + rand() * 52
      } else if (roll < spec.cloudBias + 0.34) {
        x = -4 + rand() * 60
        y = 36 + rand() * 66
      } else {
        x = rand() * 100
        y = rand() * 100
      }

      const lit = beamLight(x / 100, y / 100)
      // Motes in the beam catch the light: brighter, and warmed by it.
      const opacity = Math.min(0.95, range(spec.opacity) * (1 + 1.15 * lit))

      const toneRoll = rand()
      const tone: BokehTone =
        lit > 0.35
          ? 'warm'
          : toneRoll < 0.72
            ? 'warm'
            : toneRoll < 0.9
              ? 'cool'
              : 'arcane'

      particles.push({
        id: `${tier}-${i}`,
        x: round(x),
        y: round(y),
        size: round(range(spec.size)),
        tier,
        tone,
        opacity: Math.round(opacity * 1000) / 1000,
        lit: Math.round(lit * 100) / 100,
        driftX: round(range([-spec.drift[1], spec.drift[1]])),
        driftY: round(-range(spec.drift)),
        driftSeconds: round(range(spec.seconds)),
        driftDelay: -round(rand() * range(spec.seconds)),
        pulseSeconds: round(range([6, 17])),
        pulseDelay: -round(rand() * 17),
        // A third of the near discs get a rim, the way real bokeh does.
        ring: tier === 'near' && i % 3 === 0,
      })
    }
  }

  return particles
}

/**
 * Class list for one mote: the base class the stylesheet animates, its depth
 * tier (`far` / `mid` / `near`), its tint, and its two special cases — lit by
 * the shaft, and an out-of-focus disc with a bright rim.
 *
 * Used by BokehMote, so the scene and the Settings thumbnail cannot drift
 * apart in how they name a mote.
 */
export function moteClassName(mote: BokehParticle): string {
  return (
    'arcane-mote' +
    ` arcane-mote--${mote.tier}` +
    ` arcane-mote--${mote.tone}` +
    (mote.lit > 0.5 ? ' arcane-mote--lit' : '') +
    (mote.ring ? ' arcane-mote--ring' : '')
  )
}

/** Deterministic even sample of a list: `count` entries spread across it. */
function sampleEvenly<T>(list: T[], count: number): T[] {
  if (count >= list.length) return [...list]
  const step = list.length / count
  return Array.from({ length: count }, (_, i) => list[Math.floor(i * step)])
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** How many motes the Settings thumbnail shows at each depth. */
const PREVIEW_COUNTS: Record<BokehTier, number> = { far: 8, mid: 3, near: 2 }

/** Thumbnail scale per tier: the scene's near discs are 26px across, which is
 *  most of a 3.6rem card. Everything is nudged up from a straight proportional
 *  shrink, because at card size the smallest specks would otherwise disappear. */
const PREVIEW_SIZE_SCALE: Record<BokehTier, number> = {
  far: 1.5,
  mid: 1.05,
  near: 0.5,
}

/**
 * A handful of the scene's own motes, resized for the Settings picker's
 * thumbnail (see `ANIMATION_OPTIONS` in SettingsPage). It samples the real
 * field rather than inventing dots, so the preview keeps showing the dust the
 * animation actually draws — same tones, same depth tiers — and stays in step
 * if the field is retuned.
 *
 * The sample is taken across each tier sorted by x, so the dust spreads over
 * the slot instead of inheriting the scene's cluster (which is off to the
 * right, where the light is). Three other things are adapted for a small,
 * backdrop-less slot: sizes shrink (near discs most of all), positions stay
 * clear of the edges, and drift is cut right down — the scene's drift would
 * carry a mote clean across it.
 */
export function buildPreviewMotes(): BokehParticle[] {
  const field = buildBokehField()
  const tiers: BokehTier[] = ['far', 'mid', 'near']

  return tiers.flatMap((tier) =>
    sampleEvenly(
      field.filter((p) => p.tier === tier).sort((a, b) => a.x - b.x),
      PREVIEW_COUNTS[tier],
    ).map((p) => ({
      ...p,
      id: `preview-${p.id}`,
      x: round1(clamp(p.x, 6, 94)),
      y: round1(clamp(p.y, 10, 90)),
      size: round1(clamp(p.size * PREVIEW_SIZE_SCALE[tier], 1.6, 10)),
      // A thumbnail has room for a shimmer, not a journey.
      driftX: round1(clamp(p.driftX * 0.12, -2.5, 2.5)),
      driftY: round1(clamp(p.driftY * 0.12, -2.5, 2.5)),
      driftSeconds: Math.round(p.driftSeconds * 0.35),
      // Twinkle fast enough to read as "alive" in a small card.
      pulseSeconds: round1(clamp(p.pulseSeconds, 4, 9)),
      opacity: Math.round(clamp(p.opacity * 1.5, 0.4, 1) * 1000) / 1000,
    })),
  )
}
