/**
 * E2E: custom attributes in the hero section, and their dice notation.
 *
 * The unit tests pin the store helpers, the strip's markup and the highlighter
 * in isolation. This spec pins what only a real layout can answer:
 *   - "+ Add Attribute" really sits in the same edit-mode row as "+ Add Resource
 *     Bar", and the modal adds the attribute,
 *   - the strip is a **horizontal, centered** row of boxes between the resource
 *     bars and the Mortal Wounds block (measured, not eyeballed),
 *   - the view-mode steppers move the number without leaving the sheet, only
 *     for the attributes that opted in,
 *   - a custom attribute is usable in dice notation: `1d6+SAN` written in the
 *     innate description highlights as one token and rolls the attribute's
 *     *current* value, and clicking the box itself rolls `d20 + value`,
 *   - a phone-width viewport keeps the strip centered with no sideways scroll.
 *
 * Runs against the production build via `vite preview` (see playwright.config.ts)
 * in a fresh browser context, driving the app's real controls.
 */

import { test, expect, type Locator, type Page } from '@playwright/test'

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

/** Fill the Add Attribute dialog and confirm it. */
async function addAttribute(
  page: Page,
  opts: { name: string; value: string; shorthand?: string; steppers?: boolean },
) {
  await page.getByRole('button', { name: '+ Add Attribute' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Attribute' })
  await dialog.getByLabel('Name').fill(opts.name)
  await dialog.getByLabel('Value').fill(opts.value)
  if (opts.shorthand) {
    await dialog.getByLabel('Shorthand (optional)').fill(opts.shorthand)
  }
  if (opts.steppers) {
    await dialog.getByLabel(/steppers in view mode/).check()
  }
  await dialog.getByRole('button', { name: 'Add Attribute' }).click()
  await expect(dialog).toHaveCount(0)
}

/** Give the debounced autosave time to flush before reloading. */
async function settleAutosave(page: Page) {
  await page.waitForTimeout(800)
}

/** The strip's boxes, in render order. */
function boxes(page: Page) {
  return page.locator('.custom-attr-strip .custom-attr-box')
}

/** One box by its visible label. */
function box(page: Page, label: string): Locator {
  return page.locator('.custom-attr-box', { hasText: label })
}

/** No page may scroll sideways (the project's mobile rule). */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test('the strip is a centered row between the bars and the wounds', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit', exact: true }).click()

  // "Add Attribute" is a peer of "Add Resource Bar": same row, same line.
  const addAttributeBtn = page.getByRole('button', { name: '+ Add Attribute' })
  const addBarBtn = page.getByRole('button', { name: '+ Add Resource Bar' })
  await expect(addAttributeBtn).toBeVisible()
  await expect(addBarBtn).toBeVisible()
  const attrBtnBox = await addAttributeBtn.boundingBox()
  const barBtnBox = await addBarBtn.boundingBox()
  if (!attrBtnBox || !barBtnBox) throw new Error('add buttons are not visible')
  expect(Math.abs(attrBtnBox.y - barBtnBox.y)).toBeLessThan(4)
  expect(attrBtnBox.x).toBeGreaterThan(barBtnBox.x)

  await addAttribute(page, {
    name: 'Sanity',
    value: '5',
    shorthand: 'SAN',
    steppers: true,
  })
  await addAttribute(page, { name: 'Doom', value: '0' })

  await expect(boxes(page)).toHaveCount(2)

  // One horizontal row, in the order they were added.
  const first = await boxes(page).nth(0).boundingBox()
  const second = await boxes(page).nth(1).boundingBox()
  if (!first || !second) throw new Error('attribute boxes are not visible')
  expect(Math.abs(first.y - second.y)).toBeLessThan(4)
  expect(second.x).toBeGreaterThan(first.x + first.width - 1)

  // The row of boxes is centered inside the hero's stat block: the span they
  // occupy has the same midpoint as the block (measured on the boxes, because
  // the strip element itself is full-width).
  const block = await page.locator('.stat-block--flat').boundingBox()
  if (!block) throw new Error('hero stat block is not visible')
  const spanCenter = (first.x + second.x + second.width) / 2
  expect(Math.abs(spanCenter - (block.x + block.width / 2))).toBeLessThan(3)

  // Between the resource bars above and the Mortal Wounds block below.
  const bars = await page.locator('.stat-bars').boundingBox()
  if (!bars) throw new Error('resource bars are not visible')
  expect(first.y).toBeGreaterThan(bars.y + bars.height - 1)

  // Edit mode adds the block, so the strip is also built to persist: it comes
  // back after a reload.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await page.getByRole('button', { name: /^Vex\b/ }).click()
  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  await expect(boxes(page)).toHaveCount(2)
})

test('view mode nudges the value and rolls it from notation', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  await addAttribute(page, {
    name: 'Sanity',
    value: '5',
    shorthand: 'SAN',
    steppers: true,
  })
  await addAttribute(page, { name: 'Doom', value: '0' })

  // The feature's primary use: the attribute referenced from prose.
  await page
    .getByPlaceholder(/Describe the character's innate nature/)
    .fill('Overload deals 1d6+SAN psychic damage.')
  await settleAutosave(page)

  await page.getByRole('tab', { name: 'View', exact: true }).click()
  await expectNoSidewaysScroll(page)

  // In view mode the strip sits BELOW the Recover / End Turn row and still
  // above the wound block (which always renders in view mode).
  const recover = await page.locator('.recover-action').boundingBox()
  const stripBox = await page.locator('.custom-attr-strip').boundingBox()
  const mortals = await page.locator('.stat-mortals').boundingBox()
  if (!recover || !stripBox || !mortals) {
    throw new Error('turn actions, strip or wound block is missing')
  }
  expect(stripBox.y).toBeGreaterThanOrEqual(recover.y + recover.height - 1)
  expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(mortals.y)

  // Steppers are opt-in: Sanity has them, Doom does not.
  await expect(page.getByRole('button', { name: 'Increase Sanity' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Decrease Sanity' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Increase Doom' })).toHaveCount(0)

  // Nudge it: the box re-reads at once and the mutation autosaves.
  await page.getByRole('button', { name: 'Increase Sanity' }).click()
  await expect(box(page, 'Sanity').locator('.custom-attr-box__value')).toHaveText(
    '+6',
  )
  await page.getByRole('button', { name: 'Decrease Sanity' }).click()
  await expect(box(page, 'Sanity').locator('.custom-attr-box__value')).toHaveText(
    '+5',
  )

  // The notation token resolves through the attribute's live value.
  const token = page.getByRole('button', { name: '1d6+SAN' })
  await expect(token).toBeVisible()
  await token.click()
  await expect(page.locator('.dice-modal__term--variable')).toContainText(
    '+SAN(5)',
  )
  await expect(page.locator('.dice-modal__breakdown')).toContainText('1d6+SAN →')
  await page.getByRole('button', { name: 'Done' }).click()

  // A box click rolls d20 + value, like the built-in attribute boxes.
  await box(page, 'Sanity').click()
  await expect(page.locator('.dice-modal__breakdown')).toContainText('d20+5')
  await page.getByRole('button', { name: 'Done' }).click()

  // Phone width: the strip wraps without overflowing or drifting off-centre.
  await page.setViewportSize({ width: 360, height: 800 })
  await expectNoSidewaysScroll(page)
  const phoneBlock = await page.locator('.stat-block--flat').boundingBox()
  const phoneFirst = await boxes(page).nth(0).boundingBox()
  const phoneLast = await boxes(page).nth(1).boundingBox()
  if (!phoneBlock || !phoneFirst || !phoneLast) {
    throw new Error('phone-width attribute boxes are not visible')
  }
  const phoneSpanCenter =
    (phoneFirst.x + phoneLast.x + phoneLast.width) / 2
  expect(Math.abs(phoneSpanCenter - (phoneBlock.x + phoneBlock.width / 2))).toBeLessThan(
    3,
  )
})
