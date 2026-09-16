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
 * real pointer, releasing over the given part of the target.
 *
 * The drag starts on the card's grip handle — the visible affordance, and the
 * one place that is unambiguously a drag surface — and travels in two moves so
 * the pointer sensor's 6px activation threshold is crossed before the long
 * haul, the way a person's hand does it.
 *
 * Where the pointer is *released* decides the destination: past the middle of
 * the hovered card means the far side of it. `side` therefore picks which half
 * to aim at, and the tests below use it to pin both.
 */
async function dragCardOnto(
  page: Page,
  from: Locator,
  to: Locator,
  side: 'near' | 'far' | 'middle' = 'middle',
) {
  const handle = from.locator('.drag-handle')
  await handle.scrollIntoViewIfNeeded()
  await to.scrollIntoViewIfNeeded()

  const grip = await handle.boundingBox()
  const target = await to.boundingBox()
  if (!grip || !target) throw new Error('ability card is not visible')

  const startX = grip.x + grip.width / 2
  const startY = grip.y + grip.height / 2
  const fraction = side === 'near' ? 0.2 : side === 'far' ? 0.8 : 0.5

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // PointerSensor needs 6px of travel before the drag actually starts.
  await page.mouse.move(startX + 14, startY + 14, { steps: 5 })
  await page.mouse.move(
    target.x + target.width * fraction,
    target.y + target.height / 2,
    { steps: 14 },
  )
  await page.mouse.up()
}

/**
 * Begin a drag and leave the pointer hovering `to`, returning what the sheet is
 * showing *while the card is in the air*. The caller releases it (or drops it
 * elsewhere); `dragCardOnto` is this plus the release, for the cases that only
 * care where the card ends up.
 */
async function dragInFlight(
  page: Page,
  from: Locator,
  to: Locator,
  side: 'near' | 'far' | 'middle' = 'middle',
) {
  // A previous drag's lifted copy stays mounted for its drop animation, and it
  // is a fixed overlay sitting exactly where its card landed — a press aimed
  // through it is swallowed, so the next drag never starts. Wait for the sheet
  // to be quiet first.
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(0)

  const handle = from.locator('.drag-handle')
  await handle.scrollIntoViewIfNeeded()
  await to.scrollIntoViewIfNeeded()

  const grip = await handle.boundingBox()
  const target = await to.boundingBox()
  if (!grip || !target) throw new Error('ability card is not visible')

  const startX = grip.x + grip.width / 2
  const startY = grip.y + grip.height / 2
  const fraction = side === 'near' ? 0.2 : side === 'far' ? 0.8 : 0.5

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 14, startY + 14, { steps: 5 })
  await page.mouse.move(
    target.x + target.width * fraction,
    target.y + target.height / 2,
    { steps: 14 },
  )
  // React needs a frame to paint the indicator for the position just reached, and
  // the cards slide into their preview positions on a 200ms transform
  // transition — so wait for both before measuring where the preview put them.
  await page.waitForTimeout(400)

  return page.evaluate(() => {
    const section = (el: Element | null) => el?.getAttribute('data-section') ?? null
    const wrapOf = (el: Element | null) => el?.closest('.ability-card-wrap') ?? null
    const indicator = document.querySelector('.ability-drop-indicator')
    const dragging = document.querySelector('.sortable-ability--dragging')
    // The slot the line is drawn on names the card it marks, so the same DOM
    // lookup answers "which card is the drop landing on" as before.
    const markedId = indicator?.closest('[data-drop-target]')?.getAttribute('data-drop-target')
    const marked = markedId
      ? document.querySelector(`.ability-card-wrap[data-ability-id="${markedId}"]`)
      : null
    /**
     * The indicator's own line. `getBoundingClientRect` would union it with the
     * end-cap, so the reported box would be a couple of pixels wider than the bar
     * that marks the slot.
     */
    const lineRect = (el: Element | null) => {
      if (!el) return null
      const rects = Array.from(el.getClientRects())
      const line = rects.sort((a, b) => b.width * b.height - a.width * a.height)[0]
      return line ? line.toJSON() : null
    }
    const rect = (el: Element | null) =>
      el ? el.getBoundingClientRect().toJSON() : null
    return {
      markedCard: marked?.querySelector('.ability-card__name')?.textContent ?? null,
      markedSection: section(marked),
      draggedCard: wrapOf(dragging)?.querySelector('.ability-card__name')?.textContent ?? null,
      /** The lifted card is still laid out — drawn in the slot it is taking. */
      sourceStillLaidOut: dragging !== null,
      /** Where the lifted card is drawn: the slot the drop will leave it in. */
      draggedRect: rect(wrapOf(dragging)),
      indicatorVisible: indicator
        ? getComputedStyle(indicator).display !== 'none'
        : false,
      indicatorRect: lineRect(indicator),
      markedRect: rect(marked),
      overlayCount: document.querySelectorAll('.sortable-ability--overlay').length,
    }
  })
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

  // Within a section: releasing past the second card's middle swaps the two.
  await dragCardOnto(page, card(offense, 'Cleave'), card(offense, 'Rush'), 'far')
  await expect(abilityNames(offense)).toHaveText(['Rush', 'Cleave'])

  // Across sections: releasing on the near side of the other section's card
  // drops it *in front of* that card, not tacked onto the end — the position
  // the indicator drew while the card was in the air.
  await dragCardOnto(page, card(offense, 'Cleave'), card(defense, 'Bulwark'), 'near')
  await expect(abilityNames(offense)).toHaveText(['Rush'])
  await expect(abilityNames(defense)).toHaveText(['Cleave', 'Bulwark'])

  // The move lands on the character record, so the layout survives a reload.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await sheetCard(page, 'Vex').click()
  await page.getByRole('tab', { name: 'New Tab' }).click()

  const reloaded = page.locator('.custom-tab-content')
  await expect(abilityNames(sections(reloaded).nth(0))).toHaveText(['Rush'])
  await expect(abilityNames(sections(reloaded).nth(1))).toHaveText([
    'Cleave',
    'Bulwark',
  ])
  // View mode is a static sheet: cards render, grips do not.
  await expect(reloaded.locator('.drag-handle')).toHaveCount(0)
})

test('the drop indicator shows which card the drop will land in front of', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()

  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.getByRole('textbox').last().press('Enter')
  await addSection(page, /^Ability Block/)
  const tab = page.locator('.custom-tab-content')
  const offense = sections(tab).nth(0)
  for (const name of ['Cleave', 'Rush', 'Feint']) {
    await addAbility(page, offense, name)
  }

  // Hovering the near half of the *next* card: the destination is the gap the
  // lifted card already occupies, so the line marks its own slot's leading edge.
  const near = await dragInFlight(page, card(offense, 'Cleave'), card(offense, 'Rush'), 'near')
  expect(near.draggedCard).toBe('Cleave')
  expect(near.markedCard).toBe('Cleave')
  // The card is still laid out — which is what makes the indicator's index and
  // the drop's index the same number — and the ghost following the pointer is a
  // second, lifted copy.
  expect(near.sourceStillLaidOut).toBe(true)
  expect(near.overlayCount).toBe(1)
  await page.mouse.up()
  await expect(abilityNames(offense)).toHaveText(['Cleave', 'Rush', 'Feint'])
  // Let the drop animation finish before the next press: it briefly leaves the
  // lifted copy in the DOM, which would swallow it.
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(0)

  // Crossing the hovered card's middle moves the destination one slot on: Rush
  // slides up into the lifted card's place and the lifted card is previewed in
  // the slot it is about to take. The line marks *that slot* — Rush's box as it
  // was, which the preview has handed to the lifted card — so it is measured
  // against the lifted card, not against where Rush has slid to.
  const far = await dragInFlight(page, card(offense, 'Cleave'), card(offense, 'Rush'), 'far')
  expect(far.draggedCard).toBe('Cleave')
  expect(far.markedCard).toBe('Rush')
  expect(far.indicatorVisible).toBe(true)
  expect(far.indicatorRect).not.toBeNull()
  expect(far.markedRect).not.toBeNull()

  // The line is a thin bar spanning the landing slot's full width, in the gap on
  // its leading edge — not the stretched vertical bar in the grid's gutter this
  // used to draw.
  expect(Math.abs(far.indicatorRect!.width - far.draggedRect!.width)).toBeLessThan(2)
  expect(far.indicatorRect!.height).toBeLessThan(6)
  expect(Math.abs(far.indicatorRect!.x - far.draggedRect!.x)).toBeLessThan(2)
  expect(Math.abs(far.indicatorRect!.bottom - far.draggedRect!.top)).toBeLessThan(8)
  // And the marked card really has slid away from it: measuring the line against
  // the card it is named for is what put it a slot behind the drop.
  expect(Math.abs(far.markedRect!.x - far.draggedRect!.x)).toBeGreaterThan(50)

  // And that slot is where the card really lands: releasing leaves it exactly
  // where the preview drew it. The card settles through dnd-kit's layout-change
  // transition, so this polls rather than reading the box once.
  await page.mouse.up()
  await expect(abilityNames(offense)).toHaveText(['Rush', 'Cleave', 'Feint'])
  await expect
    .poll(async () => {
      const landed = (await card(offense, 'Cleave').boundingBox())!
      return Math.max(
        Math.abs(landed.x - far.draggedRect!.x),
        Math.abs(landed.y - far.draggedRect!.y),
      )
    })
    .toBeLessThan(2)

  // Nothing drag-only survives the drop.
  await expect(page.locator('.ability-drop-indicator')).toHaveCount(0)
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(0)
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
