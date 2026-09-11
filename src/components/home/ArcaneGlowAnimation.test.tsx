/**
 * Component tests for the Arcane Glow background.
 *
 * The scene is generated from a fixed seed, so these tests pin the contract
 * the CSS depends on: a stable field across mounts (no `Math.random()` in
 * render — re-rendering must not reshuffle the sky), motes spread across the
 * frame at all three depths, and every mote carrying the custom properties
 * its animation reads.
 */

import { render } from '@testing-library/react'
import { expect, test } from 'vitest'

import ArcaneGlowAnimation from '@/components/home/ArcaneGlowAnimation'
import BokehMote from '@/components/home/BokehMote'
import {
  buildBokehField,
  buildPreviewMotes,
  moteClassName,
  type BokehTier,
} from '@/components/home/bokehField'

const TIERS: BokehTier[] = ['far', 'mid', 'near']

test('the bokeh field is deterministic', () => {
  expect(buildBokehField()).toEqual(buildBokehField())
})

test('the field covers all three depths, far the densest', () => {
  const field = buildBokehField()
  const counts = TIERS.map((tier) => field.filter((p) => p.tier === tier).length)

  expect(counts[0]).toBeGreaterThan(counts[1])
  expect(counts[1]).toBeGreaterThan(counts[2])
  expect(counts[2]).toBeGreaterThan(0)
})

test('motes stay near the frame, sized and lit within range', () => {
  for (const p of buildBokehField()) {
    // Some motes are parked just off-frame so the field has no hard edge.
    expect(p.x).toBeGreaterThanOrEqual(-10)
    expect(p.x).toBeLessThanOrEqual(110)
    expect(p.y).toBeGreaterThanOrEqual(-10)
    expect(p.y).toBeLessThanOrEqual(110)
    expect(p.size).toBeGreaterThan(0)
    expect(p.opacity).toBeGreaterThan(0)
    expect(p.opacity).toBeLessThanOrEqual(1)
    expect(p.lit).toBeGreaterThanOrEqual(0)
    expect(p.lit).toBeLessThanOrEqual(1)
    // Motes in the shaft are brightened by it, never dimmed.
    if (p.lit > 0) expect(p.opacity).toBeLessThanOrEqual(0.95)
  }
})

test('renders the scene layers and one element per mote', () => {
  const { container } = render(<ArcaneGlowAnimation />)
  const scene = container.querySelector('.home-page__arcane')

  expect(scene).not.toBeNull()
  expect(scene).toHaveAttribute('aria-hidden', 'true')
  for (const selector of [
    '.home-page__arcane-mist',
    '.home-page__arcane-shafts',
    '.home-page__arcane-shafts-svg polygon[fill="url(#arcaneShaftBroad)"]',
    '.home-page__arcane-shafts-svg polygon[fill="url(#arcaneShaftCore)"]',
    '.home-page__arcane-shafts-svg polygon[fill="url(#arcaneShaftRay)"]',
    '.home-page__arcane-vignette',
  ]) {
    expect(container.querySelectorAll(selector).length).toBeGreaterThan(0)
  }

  const motes = container.querySelectorAll<HTMLElement>('.arcane-mote')
  expect(motes.length).toBe(buildBokehField().length)

  // Every mote must carry the values its drift/twinkle animations read.
  for (const mote of motes) {
    for (const prop of [
      '--bokeh-size',
      '--bokeh-opacity',
      '--drift-x',
      '--drift-y',
      '--drift-duration',
      '--drift-delay',
      '--pulse-duration',
      '--pulse-delay',
    ]) {
      expect(mote.style.getPropertyValue(prop)).not.toBe('')
    }
    expect(mote.style.left).not.toBe('')
    expect(mote.style.top).not.toBe('')
    // Negative delays start every mote mid-drift instead of in lockstep.
    expect(mote.style.getPropertyValue('--drift-delay').startsWith('-')).toBe(
      true,
    )
  }
})

test('a re-render keeps the same mote positions', () => {
  const { container, rerender } = render(<ArcaneGlowAnimation />)
  const before = [...container.querySelectorAll<HTMLElement>('.arcane-mote')]
    .slice(0, 8)
    .map((mote) => `${mote.style.left}|${mote.style.top}`)

  rerender(<ArcaneGlowAnimation />)

  const after = [...container.querySelectorAll<HTMLElement>('.arcane-mote')]
    .slice(0, 8)
    .map((mote) => `${mote.style.left}|${mote.style.top}`)

  expect(after).toEqual(before)
})

test('the picker thumbnail samples the real field at thumbnail scale', () => {
  const preview = buildPreviewMotes()

  expect(preview).toEqual(buildPreviewMotes())
  expect(preview.length).toBeGreaterThan(8)

  // All three depths are represented, and every mote stays on the card.
  const tiers = new Set(preview.map((m) => m.tier))
  expect([...tiers].sort()).toEqual(['far', 'mid', 'near'])
  for (const mote of preview) {
    expect(mote.id.startsWith('preview-')).toBe(true)
    expect(mote.x).toBeGreaterThanOrEqual(6)
    expect(mote.x).toBeLessThanOrEqual(94)
    expect(mote.y).toBeGreaterThanOrEqual(10)
    expect(mote.y).toBeLessThanOrEqual(90)
    // Sized for a 3.6rem card: nothing wider than a sixth of it.
    expect(mote.size).toBeLessThanOrEqual(10)
    expect(mote.size).toBeGreaterThan(0)
    // A thumbnail has room for a shimmer, not a journey.
    expect(Math.abs(mote.driftX)).toBeLessThanOrEqual(2.5)
    expect(Math.abs(mote.driftY)).toBeLessThanOrEqual(2.5)
    expect(mote.pulseSeconds).toBeLessThanOrEqual(9)
  }
})

test('moteClassName carries tier, tint and the special cases', () => {
  const mote = buildBokehField()[0]
  expect(moteClassName(mote)).toBe(
    `arcane-mote arcane-mote--${mote.tier} arcane-mote--${mote.tone}`,
  )

  expect(
    moteClassName({ ...mote, lit: 1, ring: true, tone: 'cool' }),
  ).toBe('arcane-mote arcane-mote--far arcane-mote--cool arcane-mote--lit arcane-mote--ring')
})

test('a mote renders the custom properties its animation reads', () => {
  const mote = buildPreviewMotes()[0]
  const { container } = render(<BokehMote mote={mote} />)
  const el = container.querySelector<HTMLElement>('.arcane-mote')

  expect(el).not.toBeNull()
  expect(el?.style.getPropertyValue('--bokeh-size')).toBe(`${mote.size}px`)
  expect(el?.style.getPropertyValue('--bokeh-opacity')).toBe(`${mote.opacity}`)
  expect(el?.style.left).toBe(`${mote.x}%`)
  expect(el?.style.top).toBe(`${mote.y}%`)
})
