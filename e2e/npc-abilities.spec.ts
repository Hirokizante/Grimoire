/**
 * E2E: the ability list of an NPC, reordered by dragging a card.
 *
 * Covers both surfaces the request names:
 *   1. the standalone NPC sheet page, and
 *   2. an NPC section embedded in a player character sheet's custom tab.
 *
 * The unit tests pin the section's drop handler (which index goes where, and
 * which record is written). This spec pins what they cannot: that a real
 * pointer drag in a real browser reaches that handler at all — dnd-kit's
 * sensors, collision detection and sortable transforms need layout, which jsdom
 * does not provide — and that both surfaces lay the list out identically.
 *
 * Runs against the production build via `vite preview` (see
 * playwright.config.ts) in a fresh browser context, driving the app's real
 * controls: the NPC create flow, the ability editor, the sheet's edit mode and
 * the custom-tab section chooser. Autosave is debounced 500ms, so each test
 * pauses before reloading.
 */

import { test, expect, type Locator, type Page } from '@playwright/test'

/** Open the app at the home screen. */
async function gotoHome(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
}

/** Create a fresh NPC through the NPC list page's real create flow. */
async function createNpc(page: Page, name: string) {
  await page.getByRole('button', { name: 'NPCs' }).first().click()
  await page
    .getByRole('button', { name: /Create New NPC|^New$/ })
    .first()
    .click()
  await page.getByLabel('Character Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('button', { name: 'NPCs' }).first().click()
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

/** Add one ability to whichever ability section is in edit mode. */
async function addAbility(page: Page, scope: Locator, name: string) {
  await scope.getByRole('button', { name: '+ Add Ability' }).click()
  await page.getByPlaceholder('Ability name').fill(name)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New Ability' })).toHaveCount(0)
}

/** The ability names, in the order the cards are rendered. */
function abilityNames(page: Page, scope: Locator) {
  return scope.locator('.ability-card__name')
}

/** Every card's drag grip — only edit mode renders one. */
function grips(scope: Locator) {
  return scope.locator('.drag-handle')
}

/**
 * Drag one ability card onto another with a real pointer. The drag has to
 * start on the card's grip handle: dnd-kit's listeners live there rather than
 * on the card body, which is what keeps the card's own buttons clickable.
 */
async function dragCardOnto(page: Page, from: Locator, to: Locator) {
  const handle = from.locator('.drag-handle')
  await handle.scrollIntoViewIfNeeded()
  await to.scrollIntoViewIfNeeded()

  const grip = await handle.boundingBox()
  const target = await to.boundingBox()
  if (!grip || !target) throw new Error('ability card is not visible')

  const startX = grip.x + grip.width / 2
  const startY = grip.y + grip.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // PointerSensor needs 6px of travel before the drag actually starts.
  await page.mouse.move(startX + 14, startY + 14, { steps: 5 })
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 14 },
  )
  await page.mouse.up()
}

/** Give the debounced autosave time to flush before reloading. */
async function settleAutosave(page: Page) {
  await page.waitForTimeout(800)
}

test('an NPC sheet reorders its abilities by dragging a card', async ({ page }) => {
  await gotoHome(page)
  await createNpc(page, 'Bandit')
  await sheetCard(page, 'Bandit').click()

  // Edit the NPC's own sheet and give it three abilities.
  await page.getByRole('tab', { name: 'Edit' }).click()
  const section = page.locator('.npc-abilities-section')
  await expect(section).toBeVisible()
  for (const name of ['Claw', 'Bite', 'Howl']) {
    await addAbility(page, section, name)
  }
  await expect(abilityNames(page, section)).toHaveText(['Claw', 'Bite', 'Howl'])
  // One grip per card: the list is draggable in edit mode.
  await expect(grips(section)).toHaveCount(3)
  // Grid view — the layout the embedded section has to match, in the browser.
  await expect(section.locator('.ability-grid')).toHaveClass(/ability-grid--cards/)
  expect(
    await section
      .locator('.ability-grid')
      .evaluate((el) => getComputedStyle(el).columnCount),
  ).toBe('3')

  // Drag the last card onto the first: "Howl" takes the top slot.
  const cards = section.locator('.ability-card-wrap')
  await dragCardOnto(page, cards.nth(2), cards.nth(0))
  await expect(abilityNames(page, section)).toHaveText(['Howl', 'Claw', 'Bite'])

  // The new order is written to the record, so it survives a reload.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'NPCs' }).first().click()
  await sheetCard(page, 'Bandit').click()
  await expect(
    abilityNames(page, page.locator('.npc-abilities-section')),
  ).toHaveText(['Howl', 'Claw', 'Bite'])
  // View mode is a static reference: cards render, grips do not.
  await expect(grips(page.locator('.npc-abilities-section'))).toHaveCount(0)
})

test('an NPC embedded in a player sheet reorders its abilities the same way', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()

  // Add a custom tab and attach a brand-new NPC to it.
  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.getByRole('textbox').last().press('Enter')
  await page.getByRole('button', { name: '+ Add Section' }).click()
  await page.getByRole('button', { name: /NPC Sheet/ }).click()
  await page.getByRole('button', { name: 'Create New NPC' }).click()
  await page.getByLabel('Character Name').fill('Goblin')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const section = page.locator('.npc-abilities-section--embedded')
  await expect(section).toBeVisible()
  await expect(
    section.getByRole('heading', { name: 'Abilities' }),
  ).toBeVisible()

  // The embedded list offers the same controls as the standalone sheet: the
  // grid/list toggle, the "+ Add Ability" button, and a grip per card.
  await expect(
    section.getByRole('tablist', { name: 'Abilities view' }),
  ).toBeVisible()
  for (const name of ['Claw', 'Bite', 'Howl']) {
    await addAbility(page, section, name)
  }
  await expect(abilityNames(page, section)).toHaveText(['Claw', 'Bite', 'Howl'])
  await expect(grips(section)).toHaveCount(3)

  // Same layout as the standalone section: the card grid, not the old
  // fixed-column embedded grid.
  await expect(section.locator('.ability-grid')).toHaveClass(/ability-grid--cards/)
  expect(
    await section
      .locator('.ability-grid')
      .evaluate((el) => getComputedStyle(el).columnCount),
  ).toBe('3')
  await expect(section.locator('.custom-npc-section__abilities')).toHaveCount(0)

  // Drag the last card onto the first — the same gesture as the sheet page.
  const cards = section.locator('.ability-card-wrap')
  await dragCardOnto(page, cards.nth(2), cards.nth(0))
  await expect(abilityNames(page, section)).toHaveText(['Howl', 'Claw', 'Bite'])

  // The reorder lands on the attached NPC record, so it survives a reload of
  // the parent character's sheet.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await sheetCard(page, 'Vex').click()
  await page.getByRole('tab', { name: 'New Tab' }).click()
  await expect(
    abilityNames(page, page.locator('.npc-abilities-section--embedded')),
  ).toHaveText(['Howl', 'Claw', 'Bite'])
})

test('the embedded list switches between grid and list like the sheet page', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()
  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.getByRole('textbox').last().press('Enter')
  await page.getByRole('button', { name: '+ Add Section' }).click()
  await page.getByRole('button', { name: /NPC Sheet/ }).click()
  await page.getByRole('button', { name: 'Create New NPC' }).click()
  await page.getByLabel('Character Name').fill('Goblin')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const section = page.locator('.npc-abilities-section--embedded')
  await addAbility(page, section, 'Claw')
  await addAbility(page, section, 'Bite')

  await section.getByRole('tab', { name: 'List view' }).click()
  await expect(section.locator('.ability-grid')).toHaveClass(/ability-grid--list/)
  await section.getByRole('tab', { name: 'Grid view' }).click()
  await expect(section.locator('.ability-grid')).toHaveClass(/ability-grid--cards/)

  // The choice belongs to the parent sheet's tab and is remembered there, so
  // the last one picked (list) is what the reloaded sheet shows.
  await section.getByRole('tab', { name: 'List view' }).click()
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await sheetCard(page, 'Vex').click()
  await page.getByRole('tab', { name: 'New Tab' }).click()
  await expect(
    page.locator('.npc-abilities-section--embedded .ability-grid'),
  ).toHaveClass(/ability-grid--list/)
})
