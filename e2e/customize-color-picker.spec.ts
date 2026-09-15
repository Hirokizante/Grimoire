/**
 * E2E: the customize drawer's color picker must open fully on-screen.
 *
 * `.customize__popover` hangs off its swatch's LEFT edge (`left: 0`) and
 * react-colorful's picker is a fixed 200px wide, while the drawer is 340px
 * wide against the right edge of the screen (~305px of grid content, two
 * columns). A right-column swatch starts ~176px into the body, so its picker
 * ended ~37px past the drawer — and the drawer IS the right edge of the
 * screen. The body's `overflow-y: auto` computes `overflow-x: auto`, so the
 * overhang was clipped at the drawer edge, hue slider included, with nothing
 * to scroll it back: the color of a swatch near that edge could not be picked
 * by eye at all. (`ColorSwatch` now clamps the popover into the viewport with
 * the shared `useViewportClampedPanel`, which for a right-docked drawer is
 * the drawer's own right edge.)
 *
 * jsdom has no layout, so this can only be pinned in a real browser: every
 * swatch in the drawer is opened in turn and its picker must sit inside the
 * drawer's sides — both at desktop width (side drawer) and at phone width
 * (bottom-sheet drawer), since the two lay the drawer out differently. The
 * picker may hang below the fold, but only where the body's own scroll can
 * bring it back, which is asserted too.
 */

import { expect, test, type Page } from '@playwright/test'

/** A desktop viewport: the drawer is a right-edge side panel. */
const DESKTOP = { width: 1280, height: 900 }
/** A small phone: the drawer is a full-width bottom sheet. */
const PHONE = { width: 360, height: 780 }

/** Create a fresh player character through the character list's real flow. */
async function createPlayer(page: Page, name: string) {
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await page
    .getByRole('button', { name: /Create New Character|^New$/ })
    .first()
    .click()
  await page.getByLabel('Character Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
}

/** Open the sheet's customization drawer and let its slide-in finish. */
async function openCustomizeDrawer(page: Page) {
  await createPlayer(page, 'Swatches')
  await page.getByRole('button', { name: 'Customize' }).first().click()
  await expect(page.locator('.customize-drawer')).toBeVisible()
  // The drawer slides in (0.3s); the popovers are placed once it has settled.
  await page.waitForTimeout(500)
}

/**
 * The open popover's geometry, in viewport coordinates, next to its scrolling
 * body's box and scroll extent (so a picker below the fold can be checked
 * against what that body can actually scroll to).
 */
async function pickerBox(page: Page) {
  return page.locator('.customize__popover').evaluate((el) => {
    const popover = el.getBoundingClientRect()
    const body = document.querySelector('.customize-panel__body')!
    const rect = body.getBoundingClientRect()
    return {
      left: popover.left,
      right: popover.right,
      /** Popover bottom measured in the body's scrollable content space. */
      bottomInBody: body.scrollTop + (popover.bottom - rect.top),
      bodyLeft: rect.left,
      bodyRight: rect.right,
      bodyScrollHeight: body.scrollHeight,
    }
  })
}

/** A label for failure messages: the swatch's own accessible name. */
async function labelOf(page: Page, index: number) {
  return (
    (await page.locator('.customize__swatch').nth(index).getAttribute('aria-label')) ??
    `swatch #${index}`
  )
}

test('every swatch picker opens inside the drawer at desktop width', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('./')
  await openCustomizeDrawer(page)

  const swatches = page.locator('.customize__swatch')
  const count = await swatches.count()
  expect(count).toBeGreaterThan(10)

  const clipped: { label: string; overhang: number }[] = []
  const unreachable: string[] = []
  const anchorMismatch: string[] = []
  let clampedRightColumn = false

  for (let i = 0; i < count; i++) {
    const swatch = swatches.nth(i)
    const label = await labelOf(page, i)
    const swatchBox = (await swatch.boundingBox())!
    await swatch.click()
    const picker = page.locator('.customize__popover')
    await expect(picker, label).toHaveCount(1)
    const box = await pickerBox(page)

    // The whole picker — saturation field and hue slider alike — must be
    // inside the drawer's sides, not merely inside the viewport by luck.
    const overhang = Math.max(box.bodyLeft - box.left, box.right - box.bodyRight)
    if (overhang > 0.5) clipped.push({ label, overhang })

    // Hanging below the fold is fine only if that body can scroll to it.
    if (box.bottomInBody > box.bodyScrollHeight + 0.5) unreachable.push(label)

    if (swatchBox.x + (box.right - box.left) <= box.bodyRight) {
      // Room to spare: the picker still hugs its own swatch's left edge.
      if (Math.abs(box.left - swatchBox.x) > 0.5) anchorMismatch.push(label)
    } else {
      // The reported case: the picker is pulled back inside the drawer.
      if (box.left >= swatchBox.x) anchorMismatch.push(label)
      clampedRightColumn = true
    }

    await swatch.click()
    await expect(picker, label).toHaveCount(0)
  }

  expect(clipped).toEqual([])
  expect(unreachable).toEqual([])
  // The drawer really does hold a swatch that needs clamping — otherwise this
  // spec would pass on a layout where the bug cannot happen at all.
  expect(clampedRightColumn, 'a right-column swatch needed clamping').toBe(true)
  expect(anchorMismatch, 'swatches whose picker ignored its anchor').toEqual([])
})

test('a clamped right-column picker still picks a color', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('./')
  await openCustomizeDrawer(page)

  // The third swatch ("Raised") sits in the drawer's right column, so its
  // picker is one of the clamped ones.
  const wrap = page.locator('.customize__swatch-wrap').nth(2)
  const hex = wrap.locator('.customize__hex-input')
  const before = await hex.inputValue()
  await wrap.locator('.customize__swatch').click()

  // The far right of the saturation field is the part that used to be clipped
  // away, outside the drawer — it must be there, and it must respond.
  const saturation = page.locator('.customize__popover .react-colorful__saturation')
  await expect(saturation).toBeVisible()
  const box = (await saturation.boundingBox())!
  await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2)

  await expect(hex).not.toHaveValue(before)
})

test('every swatch picker opens inside the phone bottom sheet', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await page.goto('./')
  await openCustomizeDrawer(page)

  const swatches = page.locator('.customize__swatch')
  const count = await swatches.count()

  const clipped: { label: string; overhang: number }[] = []
  for (let i = 0; i < count; i++) {
    const swatch = swatches.nth(i)
    const label = await labelOf(page, i)
    await swatch.click()
    const picker = page.locator('.customize__popover')
    await expect(picker, label).toHaveCount(1)
    const box = await pickerBox(page)
    const overhang = Math.max(box.bodyLeft - box.left, box.right - box.bodyRight)
    if (overhang > 0.5) clipped.push({ label, overhang })
    await swatch.click()
    await expect(picker, label).toHaveCount(0)
  }

  expect(clipped).toEqual([])
})
