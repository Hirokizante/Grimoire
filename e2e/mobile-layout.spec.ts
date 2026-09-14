/**
 * E2E: phone-width layout regressions on the gallery list pages.
 *
 * Both bugs this spec pins are pure geometry, and jsdom — where every
 * component test runs — has no layout at all, so neither can be caught there:
 *
 *   1. The Filter / Sort dropdown panels are much wider than their trigger
 *      button and were anchored to it with `right: 0`. At phone widths the
 *      list head wraps its actions and the Filter button ends up a button's
 *      width from the LEFT gutter, so a 16rem panel hanging off its right edge
 *      started ~108px off-screen at 360px: the panel's own header and its
 *      first column of options were unreachable, with no way to scroll them
 *      back. (`useViewportClampedPanel` measures the panel and clamps it into
 *      the viewport instead.)
 *   2. `.status-grid` used `repeat(2, 1fr)`. `1fr` is `minmax(auto, 1fr)` and
 *      that auto floor is the item's MIN-CONTENT width, so a single long
 *      unbroken status name widened its own track, the tracks stopped
 *      shrinking, and the second column was cut off by the right edge of the
 *      screen. (`minmax(0, 1fr)` plus a `min-width: 0` card removes the floor,
 *      and the phone card sizes make two per row fit at 360px.)
 *
 * Runs against the production build via `vite preview` (playwright.config.ts),
 * driving the app's real create flows — an NPC (its list is the shortest path
 * to a five-button page head) and a status whose name is one long token.
 */

import { expect, test, type Locator, type Page } from '@playwright/test'

/** A small phone — the width the panel overflow was reported at. */
const PHONE = { width: 360, height: 780 }
/** A large phone — still two status cards per row. */
const WIDE_PHONE = { width: 430, height: 900 }

/** The element's box, in viewport coordinates. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box, `${await locator.evaluate((el) => el.className)} has a box`).not.toBeNull()
  return box!
}

/** Nothing may start left of, or end right of, the viewport. */
async function expectInsideViewport(locator: Locator, viewportWidth: number) {
  const box = await boxOf(locator)
  expect(box.x, 'left edge').toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, 'right edge').toBeLessThanOrEqual(viewportWidth)
}

/** Create an NPC through the NPC list's real flow and return to the list. */
async function createNpc(page: Page, name: string) {
  await page.getByRole('button', { name: 'NPCs' }).click()
  await page.getByRole('button', { name: 'Create New NPC' }).click()
  await page.getByLabel('Character Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // The create flow opens the new NPC's sheet; the list head is what we need.
  await page.getByRole('button', { name: 'NPCs' }).click()
  await expect(page.locator('.page-head__actions')).toBeVisible()
}

test('filter and sort panels stay on-screen at phone width', async ({ page }) => {
  // The list page head, not the sheet: at 360px the actions form a right-aligned
  // row whose first button (Filter) sits near the left gutter.
  await page.setViewportSize(PHONE)
  await page.goto('./')
  await createNpc(page, 'Bandit')
  await expect(page.locator('.page-head__actions')).toBeVisible()

  await page.locator('.filter-dropdown__btn').click()
  const filterPanel = page.locator('.filter-dropdown__panel')
  await expect(filterPanel).toBeVisible()
  // The panel's own header must be readable, not just its right-hand side.
  await expect(filterPanel.locator('.filter-dropdown__title')).toBeVisible()
  await expectInsideViewport(filterPanel, PHONE.width)

  await page.keyboard.press('Escape')
  await expect(filterPanel).toHaveCount(0)

  await page.locator('.sort-dropdown__btn').click()
  const sortPanel = page.locator('.sort-dropdown__panel')
  await expect(sortPanel).toBeVisible()
  await expectInsideViewport(sortPanel, PHONE.width)
})

test('the status compendium keeps two cards per row inside the screen', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByText('Statuses', { exact: true }).click()

  // One 34-character unbroken name is exactly the content that used to blow
  // the column out (a grid track cannot shrink below its min-content width
  // unless it is `minmax(0, …)`).
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page
    .getByPlaceholder('Enter a name…')
    .fill('Supercalifragilisticexpialidocious')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // The create flow opens the new status in the editor; close it to see the grid.
  await page.keyboard.press('Escape')
  await expect(page.locator('.status-grid')).toBeVisible()
  await expect(
    page.locator('.status-card', { hasText: 'Supercalifragilistic' }),
  ).toHaveCount(1)

  for (const phone of [WIDE_PHONE, PHONE]) {
    await page.setViewportSize(phone)

    const grid = page.locator('.status-grid')
    const columns = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    )
    expect(columns, `cards per row at ${phone.width}px`).toBe(2)

    const cards = await grid.evaluate((el) =>
      [...el.querySelectorAll('.status-card')].map((card) => {
        const rect = card.getBoundingClientRect()
        const name = card
          .querySelector('.status-card__name')!
          .getBoundingClientRect()
        const del = card
          .querySelector('.status-card__delete')!
          .getBoundingClientRect()
        return { left: rect.left, right: rect.right, nameToDelete: name.right - del.left }
      }),
    )
    expect(cards.length).toBeGreaterThan(1)
    for (const card of cards) {
      expect(card.left, `card left at ${phone.width}px`).toBeGreaterThanOrEqual(0)
      expect(card.right, `card right at ${phone.width}px`).toBeLessThanOrEqual(
        phone.width,
      )
      // The always-visible delete ✕ must not land on the status name.
      expect(card.nameToDelete).toBeLessThanOrEqual(1)
    }

    // …and the page itself never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      phone.width,
    )
  }
})
