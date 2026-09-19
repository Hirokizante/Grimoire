/**
 * E2E: the capture buttons on Ability Blocks, roll results and status modals.
 *
 * The unit tests pin the clone's rules (off-screen, un-clamped, controls
 * hidden) and the component tests pin the button's wiring. What only a real
 * browser can answer is the whole pipeline: `html-to-image` rasterizes the
 * element, the PNG lands on the system clipboard, the result is cropped to the
 * element at the promised 2× density, and — the point of the clone — an
 * ancestor's dim never reaches the image. Chromium is granted clipboard
 * read/write so the test can read the image straight back out.
 *
 * Runs against the production build via `vite preview` (see playwright.config.ts).
 */

import { test, expect, type Page } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

/** Open the app at the home screen. */
async function gotoHome(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
}

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

/** Every ancestor's opacity multiplied down — what the eye actually sees. */
async function effectiveOpacity(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    let node: Element | null = el
    let opacity = 1
    while (node) {
      opacity *= parseFloat(getComputedStyle(node).opacity)
      node = node.parentElement
    }
    return opacity
  }, selector)
}

/**
 * Read the PNG the app just copied out of the system clipboard, with its mean
 * pixel value so callers can compare brightness between shots.
 */
async function clipboardPng(page: Page) {
  await page.bringToFront()
  return page.evaluate(async () => {
    const [item] = await navigator.clipboard.read()
    const blob = await item.getType('image/png')
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      bytes: blob.size,
      mean: sum / (data.length / 4),
    }
  })
}

/** The capture is rendered at 2× the element's own box, within rounding. */
function expectCroppedTo(
  image: { width: number; height: number; bytes: number },
  box: { width: number; height: number },
) {
  expect(image.bytes).toBeGreaterThan(0)
  expect(Math.abs(image.width - box.width * 2)).toBeLessThanOrEqual(4)
  expect(Math.abs(image.height - box.height * 2)).toBeLessThanOrEqual(4)
}

test('an ability block is copied to the clipboard, cropped to the card', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  const card = page.locator('.ability-card').first()
  const box = (await card.boundingBox())!

  await card.getByRole('button', { name: 'Copy ability image' }).click()
  await expect(
    page.getByText('Copied the ability image to the clipboard.'),
  ).toBeVisible()

  expectCroppedTo(await clipboardPng(page), box)
})

test('an ability card reveals its capture control only while hovered', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  const card = page.locator('.ability-card').first()
  const button = card.getByRole('button', { name: 'Copy ability image' })
  await expect(button).toHaveCSS('opacity', '0')

  await card.hover()
  await expect(button).toHaveCSS('opacity', '0.65')

  // Leaving the card hides it again; the modal's button is not affected.
  await page.mouse.move(0, 0)
  await expect(button).toHaveCSS('opacity', '0')
})

test('a roll result modal is copied whole, cropped to the dialog', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  // Roll the Basic Attack's damage from its own dice pill.
  await page.getByRole('button', { name: '1d6' }).first().click()

  const modal = page.locator('.dice-modal')
  await expect(modal).toBeVisible()
  // The dialog pops in; measure it only once that animation has settled.
  await modal.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  )
  const box = (await modal.boundingBox())!

  await modal.getByRole('button', { name: 'Copy roll result image' }).click()
  await expect(
    page.getByText('Copied the roll result image to the clipboard.'),
  ).toBeVisible()

  expectCroppedTo(await clipboardPng(page), box)
})

test('a status modal is copied whole, cropped to the dialog', async ({
  page,
}) => {
  await gotoHome(page)
  await page.getByText('Statuses', { exact: true }).click()
  await expect(page.locator('.status-grid')).toBeVisible()

  // Open the seeded "Blinded" condition's detail modal.
  await page.getByRole('button', { name: /^Blinded/ }).click()
  const modal = page.locator('.status-modal')
  await expect(modal).toBeVisible()
  // The dialog pops in; measure it only once that animation has settled.
  await modal.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  )
  const box = (await modal.boundingBox())!

  await modal.getByRole('button', { name: 'Copy status image' }).click()
  await expect(
    page.getByText('Copied the status image to the clipboard.'),
  ).toBeVisible()

  expectCroppedTo(await clipboardPng(page), box)
})

test('a dimmed GM panel card is captured at full strength', async ({ page }) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  // A screen with the character panel, expanded to show its ability cards.
  await page.getByRole('button', { name: 'GM Screen' }).first().click()
  await page.getByRole('button', { name: 'New Screen' }).first().click()
  await page.getByLabel('Screen name').fill('Session 4')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByRole('button', { name: /Vex/ }).click()

  const panel = page.locator('.gm-panel--character').first()
  await panel.getByRole('button', { name: /Expand/ }).click()
  const card = panel.locator('.ability-card').first()
  await expect(card).toBeVisible()

  const captureButton = card.getByRole('button', { name: 'Copy ability image' })
  const toast = page.getByText('Copied the ability image to the clipboard.')
  await captureButton.click()
  await expect(toast).toBeVisible()
  const bright = await clipboardPng(page)
  // Let the first toast clear so the next wait can only match the new one.
  await expect(toast).toHaveCount(0, { timeout: 6000 })

  // Spend the panel's whole AP budget: the panel dims everything but its AP
  // row to 0.55, this card included.
  const apMinus = panel.locator('.gm-ap .gm-step').first()
  for (let i = 0; i < 3; i += 1) await apMinus.click()
  await expect(panel).toHaveClass(/gm-panel--no-ap/)
  // The dim is a 150ms transition — poll until it has settled.
  await expect
    .poll(() => effectiveOpacity(page, '.gm-panel--character .ability-card'))
    .toBeCloseTo(0.55, 2)

  await captureButton.click()
  await expect(toast).toBeVisible()
  const dimmed = await clipboardPng(page)

  // Same card, same pixels: the shot never inherits the fade. A dimmed capture
  // would land around 55% of the brightness measured above.
  expect(dimmed.bytes).toBeGreaterThan(0)
  expect(Math.abs(dimmed.mean - bright.mean)).toBeLessThan(2)
})
