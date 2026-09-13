/**
 * E2E: reordering the sections of a custom tab with the ↑/↓ arrows.
 *
 * The unit tests pin the store's move contract and each section's wiring in
 * isolation. This spec pins what they cannot: that `CustomTabContent` hands
 * every section its real position (a section that receives the defaults has
 * both arrows disabled, so a missing prop reads as a dead control), that the
 * pair really sits in the heading row's upper-right corner in a real layout,
 * that a click reorders the rendered tab, and that the new order survives the
 * debounced autosave. One tab is built with one section of each kind —
 * ability, text, and bundled NPC — so every heading row is walked.
 *
 * Runs against the production build via `vite preview` (see
 * playwright.config.ts) in a fresh browser context, driving the app's real
 * controls: the character create flow, the sheet's edit mode, the section
 * chooser and the NPC create flow.
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

/** The list card that opens a saved sheet — never its "Delete …" button. */
function sheetCard(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(`^${name}\\b`) })
}

/** Open the "+ Add Section" chooser and pick one kind. */
async function addSection(page: Page, title: RegExp) {
  await page.getByRole('button', { name: '+ Add Section' }).click()
  await page
    .getByRole('dialog', { name: 'Add a section' })
    .getByRole('button', { name: title })
    .click()
}

/** The custom tab's own section elements, in render order. */
function sections(tab: Locator) {
  return tab.locator(':scope > section.sheet-section--custom')
}

/** The section kinds, in render order. */
function kindOrder(tab: Locator): Promise<string[]> {
  return sections(tab).evaluateAll((els) =>
    els.map((el) => {
      if (el.classList.contains('sheet-section--custom-text')) return 'text'
      if (el.classList.contains('sheet-section--custom-npc')) return 'npc'
      return 'ability'
    }),
  )
}

/** The ↑ / ↓ pair inside one section's heading row. */
function moveUp(section: Locator) {
  return section.locator('.section-reorder__btn').nth(0)
}
function moveDown(section: Locator) {
  return section.locator('.section-reorder__btn').nth(1)
}

/** Give the debounced autosave time to flush before reloading. */
async function settleAutosave(page: Page) {
  await page.waitForTimeout(800)
}

test('a custom tab shifts its sections with the heading arrows', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()

  // One tab holding one section of each kind: ability, text, NPC.
  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.getByRole('textbox').last().press('Enter')
  await addSection(page, /^Ability Block/)
  await addSection(page, /^Text/)
  await addSection(page, /^NPC Sheet/)
  await page.getByRole('button', { name: 'Create New NPC' }).click()
  await page.getByLabel('Character Name').fill('Goblin')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const tab = page.locator('.custom-tab-content')
  await expect(sections(tab)).toHaveCount(3)
  await expect.poll(() => kindOrder(tab)).toEqual(['ability', 'text', 'npc'])

  // The pair lives in the heading row's upper-right corner: right of the
  // heading, inside the section, and both arrows on one line.
  const first = sections(tab).nth(0)
  const headingBox = await first.locator('h3.sheet-section__heading').boundingBox()
  const upBox = await moveUp(first).boundingBox()
  const downBox = await moveDown(first).boundingBox()
  const sectionBox = await first.boundingBox()
  if (!headingBox || !upBox || !downBox || !sectionBox) {
    throw new Error('heading or reorder arrows are not visible')
  }
  expect(upBox.x).toBeGreaterThan(headingBox.x + headingBox.width)
  expect(upBox.x + upBox.width).toBeLessThanOrEqual(
    sectionBox.x + sectionBox.width,
  )
  expect(Math.abs(upBox.y - downBox.y)).toBeLessThan(4)

  // Boundary arrows are disabled, the middle section's pair is live.
  await expect(moveUp(first)).toBeDisabled()
  await expect(moveDown(first)).toBeEnabled()
  const last = sections(tab).nth(2)
  await expect(moveDown(last)).toBeDisabled()
  await expect(moveUp(sections(tab).nth(1))).toBeEnabled()

  // Shift the ability section down one place, then the NPC section up one.
  await moveDown(first).click()
  await expect.poll(() => kindOrder(tab)).toEqual(['text', 'ability', 'npc'])
  await moveUp(sections(tab).nth(2)).click()
  await expect.poll(() => kindOrder(tab)).toEqual(['text', 'npc', 'ability'])

  // The new order is written to the record, so it survives a reload.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await sheetCard(page, 'Vex').click()
  await page.getByRole('tab', { name: 'New Tab' }).click()

  const reloaded = page.locator('.custom-tab-content')
  await expect.poll(() => kindOrder(reloaded)).toEqual(['text', 'npc', 'ability'])

  // View mode is a read-only sheet: the arrows are edit-mode chrome.
  await expect(page.locator('.section-reorder__btn')).toHaveCount(0)
})
