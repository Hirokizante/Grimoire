/**
 * E2E: a custom tab's sections — reordering them with the ↑/↓ arrows, and
 * dragging an ability card within an ability section or across into another.
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
 * The drag test covers the other interaction those sections own: dnd-kit's
 * sensors, collision detection and sortable transforms all need layout, so a
 * real pointer drag is the only place the card-to-card and card-to-list drops
 * can be exercised at all.
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

/** Add one ability to whichever ability section is in edit mode. */
async function addAbility(page: Page, scope: Locator, name: string) {
  await scope.getByRole('button', { name: '+ Add Ability' }).click()
  await page.getByPlaceholder('Ability name').fill(name)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New Ability' })).toHaveCount(0)
}

/** The ability names of one section, in the order the cards are rendered. */
function abilityNames(section: Locator) {
  return section.locator('.ability-card__name')
}

/** One ability card of a section, by the name on it. */
function card(section: Locator, name: string) {
  return section.locator('.ability-card-wrap').filter({ hasText: name })
}

/**
 * Drag one ability card onto another (or onto a section's drop zone) with a
 * real pointer. The drag has to start on the card's grip handle: dnd-kit's
 * listeners live there rather than on the card body, which is what keeps the
 * card's own buttons clickable.
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

test('a custom tab drags ability cards between its ability sections', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()

  // One tab with two ability sections holding a card each.
  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.getByRole('textbox').last().press('Enter')
  await addSection(page, /^Ability Block/)
  await addSection(page, /^Ability Block/)

  const tab = page.locator('.custom-tab-content')
  await expect(sections(tab)).toHaveCount(2)
  const offense = sections(tab).nth(0)
  const defense = sections(tab).nth(1)

  await addAbility(page, offense, 'Cleave')
  await addAbility(page, offense, 'Rush')
  await addAbility(page, defense, 'Bulwark')
  await expect(abilityNames(offense)).toHaveText(['Cleave', 'Rush'])
  await expect(abilityNames(defense)).toHaveText(['Bulwark'])
  // One grip per card: the lists are draggable in edit mode.
  await expect(offense.locator('.drag-handle')).toHaveCount(2)

  // Within a section: dropping a card on another card reorders the list.
  await dragCardOnto(page, card(offense, 'Cleave'), card(offense, 'Rush'))
  await expect(abilityNames(offense)).toHaveText(['Rush', 'Cleave'])

  // Across sections: dropping a card on a card in the other section moves it
  // there (to the end of that section's list, like a pool ↔ slotted move).
  await dragCardOnto(page, card(offense, 'Cleave'), card(defense, 'Bulwark'))
  await expect(abilityNames(offense)).toHaveText(['Rush'])
  await expect(abilityNames(defense)).toHaveText(['Bulwark', 'Cleave'])

  // The move lands on the character record, so the layout survives a reload.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await sheetCard(page, 'Vex').click()
  await page.getByRole('tab', { name: 'New Tab' }).click()

  const reloaded = page.locator('.custom-tab-content')
  await expect(abilityNames(sections(reloaded).nth(0))).toHaveText(['Rush'])
  await expect(abilityNames(sections(reloaded).nth(1))).toHaveText([
    'Bulwark',
    'Cleave',
  ])
  // View mode is a static sheet: cards render, grips do not.
  await expect(reloaded.locator('.drag-handle')).toHaveCount(0)
})

test('a card can be dragged onto an empty ability section', async ({ page }) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()

  // Two short sections — one holding a card, one empty — so both ends of the
  // drag stay inside the viewport (dnd-kit auto-scrolls a longer page, which
  // would move the drop zone out from under a fixed pointer path).
  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.getByRole('textbox').last().press('Enter')
  await addSection(page, /^Ability Block/)
  await addSection(page, /^Ability Block/)

  const tab = page.locator('.custom-tab-content')
  const offense = sections(tab).nth(0)
  const empty = sections(tab).nth(1)
  await addAbility(page, offense, 'Rush')
  await expect(empty.locator('.ability-dropzone--empty')).toBeVisible()

  // Dropping on the empty section's own drop zone moves the card there: the
  // list is a droppable in its own right, not just its cards.
  await dragCardOnto(page, card(offense, 'Rush'), empty.locator('.ability-dropzone'))
  await expect(abilityNames(offense)).toHaveText([])
  await expect(abilityNames(empty)).toHaveText(['Rush'])

  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await sheetCard(page, 'Vex').click()
  await page.getByRole('tab', { name: 'New Tab' }).click()
  await expect(
    abilityNames(sections(page.locator('.custom-tab-content')).nth(1)),
  ).toHaveText(['Rush'])
})
