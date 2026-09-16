/**
 * E2E: the feel of dragging an ability card — what can be grabbed, what the
 * sheet shows while a card is in the air, and what a drag refuses to do.
 *
 * The unit tests pin the drop arithmetic and each section's wiring in isolation,
 * and `custom-sections.spec.ts` covers the custom-tab drag path. What needs a
 * real browser is everything about the *interaction*: which parts of a card
 * start a drag, that the card's own buttons still click, that a refused drop
 * says so before the release rather than after it, and that a keyboard user can
 * pick a card up at all. All of those are dnd-kit sensor and CSS behaviour, so
 * jsdom cannot see them.
 *
 * Runs against the production build via `vite preview` (see
 * playwright.config.ts) in a fresh browser context.
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

/** One ability card of a section, by the name on it. */
function card(section: Locator, name: string) {
  return section.locator('.ability-card-wrap').filter({ hasText: name })
}

/** The ability names in a section, in render order. */
function abilityNames(section: Locator) {
  return section.locator('.ability-card__name')
}

/** Add an ability to a section through its editor. */
async function addAbility(
  page: Page,
  section: Locator,
  name: string,
  description?: string,
) {
  await section.getByRole('button', { name: '+ Add Ability' }).click()
  await page.getByLabel('Name').fill(name)
  // A description is what makes one card taller than another, which is the
  // interesting case in a masonry grid.
  if (description) await page.getByLabel('Description').fill(description)
  await page.getByRole('button', { name: 'Save' }).click()
}

test('a card can be picked up anywhere except its own buttons', async ({ page }) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()
  const pool = page.locator('.sheet-section--pool')
  for (const name of ['Alpha', 'Bravo', 'Charlie']) {
    await addAbility(page, pool, name)
  }
  await pool.scrollIntoViewIfNeeded()

  // Grab the card by its *name*, not the grip, and drag it past the last card.
  const nameBox = (await card(pool, 'Alpha').locator('.ability-card__name').boundingBox())!
  const charlie = (await card(pool, 'Charlie').boundingBox())!
  await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(nameBox.x + 20, nameBox.y + 20, { steps: 5 })
  await page.mouse.move(
    charlie.x + charlie.width * 0.8,
    charlie.y + charlie.height / 2,
    { steps: 14 },
  )
  // The card is in the air: a lifted copy follows the pointer and the drop
  // indicator has appeared.
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(1)
  await expect(page.locator('.ability-drop-indicator')).toHaveCount(1)
  await page.mouse.up()

  await expect(abilityNames(pool)).toHaveText(['Bravo', 'Charlie', 'Alpha'])
  // Let the drop animation finish before the next press: it briefly leaves the
  // lifted copy in the DOM, which would swallow a click aimed at a button.
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(0)

  // A press on a card's own button is still a click, not the start of a drag —
  // the sensor declines it and the editor opens as it always did.
  await card(pool, 'Bravo').getByRole('button', { name: 'Edit' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit Ability' })
  await expect(editor).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
})

test('the drag preview draws the landing slot without deforming any card', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()
  const pool = page.locator('.sheet-section--pool')

  // Three cards of different heights, so a preview that scales a card into the
  // box it is moving onto has something to squash.
  await addAbility(page, pool, 'Alpha', 'Short one.')
  await addAbility(
    page,
    pool,
    'Bravo',
    'A description long enough to wrap over several lines of the card body, so this card stands a good deal taller than the ones beside it.',
  )
  await addAbility(page, pool, 'Charlie', 'Tiny.')
  await pool.scrollIntoViewIfNeeded()

  const grip = (await card(pool, 'Alpha').locator('.drag-handle').boundingBox())!
  const target = (await card(pool, 'Charlie').boundingBox())!

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + 20, grip.y + 20, { steps: 5 })
  // Past the last card's middle, so Alpha lands after it — in this row, Charlie's
  // slot, which is what the preview has to show.
  await page.mouse.move(
    target.x + target.width * 0.8,
    target.y + target.height / 2,
    { steps: 14 },
  )
  await expect(page.locator('.ability-drop-indicator')).toHaveCount(1)
  // The cards slide into their preview positions on a 200ms transform
  // transition, so let them arrive before measuring where the preview put them.
  await page.waitForTimeout(400)

  const preview = await page.evaluate(() => {
    const dragging = document.querySelector('.sortable-ability--dragging')
    const line = document.querySelector('.ability-drop-indicator')
    const slot = line?.closest('[data-drop-target]')
    const markedId = slot?.getAttribute('data-drop-target')
    const box = (el: Element | null) => (el ? el.getBoundingClientRect().toJSON() : null)
    return {
      /**
       * Every card's drawn box next to its laid-out size: a transform that scales
       * the card shows up as a difference between the two.
       */
      cards: [
        ...document.querySelectorAll('.sheet-section--pool .ability-card-wrap'),
      ].map((el) => ({
        name: el.querySelector('.ability-card__name')?.textContent ?? '',
        rect: el.getBoundingClientRect().toJSON(),
        layoutWidth: (el as HTMLElement).offsetWidth,
        layoutHeight: (el as HTMLElement).offsetHeight,
      })),
      draggedName:
        dragging?.querySelector('.ability-card__name')?.textContent ?? null,
      draggedRect: box(dragging),
      lineRect: box(line),
      /** The card whose slot the line marks — the slot the drop lands in. */
      markedName: markedId
        ? (document.querySelector(
            `.ability-card-wrap[data-ability-id="${markedId}"] .ability-card__name`,
          )?.textContent ?? null)
        : null,
    }
  })

  // Nothing is scaled anywhere in the list — not the cards sliding up to close
  // the gap, and not the lifted card itself.
  for (const drawn of preview.cards) {
    expect(Math.abs(drawn.rect.width - drawn.layoutWidth)).toBeLessThan(1)
    expect(Math.abs(drawn.rect.height - drawn.layoutHeight)).toBeLessThan(1)
  }

  // The line is a thin bar spanning the slot the card is about to take, in the
  // gap on that slot's leading edge. It is drawn on the slot itself, which is
  // the box the lifted card is previewed in.
  expect(preview.draggedName).toBe('Alpha')
  expect(preview.markedName).toBe('Charlie')
  expect(
    Math.abs(preview.lineRect!.width - preview.draggedRect!.width),
  ).toBeLessThan(2)
  expect(preview.lineRect!.height).toBeLessThan(6)
  expect(Math.abs(preview.lineRect!.x - preview.draggedRect!.x)).toBeLessThan(2)
  expect(
    Math.abs(preview.lineRect!.bottom - preview.draggedRect!.top),
  ).toBeLessThan(8)

  // Releasing lands the card exactly where the preview drew it: the slot the
  // line marked. The card then settles through dnd-kit's layout-change
  // transition, so this polls rather than reading the box once.
  await page.mouse.up()
  await expect(abilityNames(pool)).toHaveText(['Bravo', 'Charlie', 'Alpha'])
  await expect
    .poll(async () => {
      const landed = (await card(pool, 'Alpha').boundingBox())!
      return Math.max(
        Math.abs(landed.x - preview.draggedRect!.x),
        Math.abs(landed.y - preview.draggedRect!.y),
      )
    })
    .toBeLessThan(2)
})

test('a full slotted section refuses a pooled card while it is still in the air', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()
  const slotted = page.locator('.sheet-section--slotted')
  const pool = page.locator('.sheet-section--pool')

  // Fill the budget exactly, then leave one card waiting in the pool. The cards
  // are deliberately different heights: the line marks a slot *in a column*, and
  // a grid where every card is the same height cannot tell a line drawn on the
  // right slot from one drawn a column away.
  await expect(slotted.locator('.sheet-section__counter')).toHaveText(/\/ 3 slots/)
  await addAbility(page, slotted, 'One', 'Short one.')
  await addAbility(
    page,
    slotted,
    'Two',
    'A description that wraps over a couple of lines of the card body.',
  )
  await addAbility(page, slotted, 'Three', 'Another short one.')
  await addAbility(page, pool, 'Spare')
  await expect(slotted.locator('.sheet-section__counter')).toHaveText('3 / 3 slots')

  const grip = (await card(pool, 'Spare').locator('.drag-handle').boundingBox())!
  const target = (await card(slotted, 'Two').boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + 20, grip.y + 20, { steps: 5 })
  await page.mouse.move(
    target.x + target.width * 0.8,
    target.y + target.height / 2,
    { steps: 16 },
  )

  // The indicator says "not here" before the release, rather than the drop
  // being accepted and silently discarded afterwards.
  await expect(page.locator('.ability-drop-indicator--invalid')).toHaveCount(1)
  await page.mouse.up()
  await expect(abilityNames(slotted)).toHaveText(['One', 'Two', 'Three'])
  await expect(abilityNames(pool)).toHaveText(['Spare'])

  // Free a slot and the same drag is accepted at the position it drew. Wait for
  // the refused drag to finish settling first: its drop animation leaves a copy
  // of the card in the DOM for a moment, and a click aimed through it is lost.
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(0)
  await card(slotted, 'Three').getByRole('button', { name: 'Move to Pool' }).click()
  await expect(slotted.locator('.sheet-section__counter')).toHaveText('2 / 3 slots')
  await expect(abilityNames(pool)).toHaveText(['Spare', 'Three'])

  const freed = (await card(pool, 'Spare').locator('.drag-handle').boundingBox())!
  const target2 = (await card(slotted, 'Two').boundingBox())!
  await page.mouse.move(freed.x + freed.width / 2, freed.y + freed.height / 2)
  await page.mouse.down()
  await page.mouse.move(freed.x + 20, freed.y + 20, { steps: 5 })
  await page.mouse.move(
    target2.x + target2.width * 0.8,
    target2.y + target2.height / 2,
    { steps: 16 },
  )
  // The card really is in the air on the second attempt, and the same indicator
  // is now violet: the destination is available again.
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(1)
  await expect(page.locator('.ability-drop-indicator--invalid')).toHaveCount(0)

  // The pointer is past the last card's middle, so the destination is the end of
  // the list. Nothing in Slotted Abilities moves — the card is arriving from the
  // pool, so it vacates no slot here — and the line is drawn in the gap under
  // the card it will follow, across that card's full width, in that card's own
  // column.
  const appended = await page.evaluate(() => {
    const line = document.querySelector('.ability-drop-indicator')
    const slot = line?.closest('[data-drop-target]')
    const markedId = slot?.getAttribute('data-drop-target')
    const marked = markedId
      ? document.querySelector(`.ability-card-wrap[data-ability-id="${markedId}"]`)
      : null
    const box = (el: Element | null) => (el ? el.getBoundingClientRect().toJSON() : null)
    return {
      edge: slot?.getAttribute('data-drop-edge') ?? null,
      markedCard: marked?.querySelector('.ability-card__name')?.textContent ?? null,
      lineRect: box(line),
      markedRect: box(marked),
    }
  })
  expect(appended.markedCard).toBe('Two')
  expect(appended.edge).toBe('after')
  expect(Math.abs(appended.lineRect!.width - appended.markedRect!.width)).toBeLessThan(2)
  expect(Math.abs(appended.lineRect!.x - appended.markedRect!.x)).toBeLessThan(2)
  expect(
    Math.abs(appended.lineRect!.top - appended.markedRect!.bottom),
  ).toBeLessThan(8)

  await page.mouse.up()
  await expect(abilityNames(slotted)).toHaveText(['One', 'Two', 'Spare'])
})

test('a keyboard user can pick an ability card up and cancel the drag', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()
  const pool = page.locator('.sheet-section--pool')
  await addAbility(page, pool, 'Alpha')
  await pool.scrollIntoViewIfNeeded()

  // The grip is a real button and the keyboard's way in: focusing it and
  // pressing space lifts the card, exactly as a mouse press would.
  const grip = pool.locator('.drag-handle').first()
  await grip.focus()
  await expect(grip).toHaveAttribute('aria-label', 'Drag Alpha')
  await page.keyboard.press('Space')
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(1)
  // Let the keyboard sensor finish arming before cancelling: pressing escape in
  // the same tick as the pickup races the drag that is still starting.
  await page.waitForTimeout(200)

  // Escape puts it back where it came from.
  await page.keyboard.press('Escape')
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(0, {
    timeout: 10_000,
  })
  await expect(abilityNames(pool)).toHaveText(['Alpha'])
})
