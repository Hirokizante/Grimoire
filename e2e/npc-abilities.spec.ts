/**
 * E2E: the ability list of an NPC, reordered by dragging a card.
 *
 * Covers both surfaces the request names:
 *   1. the standalone NPC sheet page, and
 *   2. an NPC section embedded in a player character sheet's custom tab.
 *
 * The unit tests pin the section's drop handler (which index goes where, and
 * which record is written) and where its drop resolver registers. This spec pins
 * what they cannot: that a real pointer drag in a real browser reaches that
 * handler at all — dnd-kit's sensors, collision detection and sortable transforms
 * need layout, which jsdom does not provide — that both surfaces lay the list out
 * identically, and that a drag draws the **same preview the player sheet's
 * ability sections draw**: the insertion line on the slot the card lands in, the
 * cards slid into the slots the drop leaves them in, the lifted card faded in its
 * own slot, and the ghost under the pointer. The last test compares an NPC drag
 * and a player drag card for card, so "identical" means identical, not merely
 * "both show something".
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
async function addAbility(
  page: Page,
  scope: Locator,
  name: string,
  description?: string,
) {
  await scope.getByRole('button', { name: '+ Add Ability' }).click()
  await page.getByPlaceholder('Ability name').fill(name)
  // A description is what makes one card taller than another, which is the
  // interesting case in a masonry grid: a preview that scales a card into the
  // box it moves onto has something to squash.
  if (description) await page.getByLabel('Description').fill(description)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New Ability' })).toHaveCount(0)
}

/**
 * The authored abilities' names, in the order the list renders them.
 *
 * The **pinned Basic Attack** card every NPC carries is filtered out on purpose:
 * it leads the list on every surface and in both sheet modes, while this spec is
 * about the reorderable list (the pinned card has its own assertions below).
 */
function abilityNames(page: Page, scope: Locator) {
  return scope
    .locator('.ability-card__name')
    .filter({ hasNotText: 'Basic Attack' })
}

/** The sortable cards — everything a drag can pick up. */
function sortableCards(scope: Locator) {
  return scope.locator('.sortable-ability[data-ability-id]')
}

/** Every card's drag grip — only edit mode renders one. */
function grips(scope: Locator) {
  return scope.locator('.drag-handle')
}

/**
 * Pick one ability card up and hold it over another with a real pointer,
 * leaving the button down so a test can read what the list is drawing. The drag
 * has to start on the card's grip handle: dnd-kit's listeners live there rather
 * than on the card body, which is what keeps the card's own buttons clickable.
 */
async function beginCardDrag(page: Page, from: Locator, to: Locator) {
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
  // The preview slides the cards onto their new slots on a 200ms transform
  // transition, so let them arrive before anything is measured.
  await page.waitForTimeout(400)
}

/**
 * Release a drag started by {@link beginCardDrag}, and let the drop animation
 * finish: it briefly leaves the lifted copy in the DOM, and a press aimed
 * through it (the next card's buttons, the title bar's nav) is swallowed.
 */
async function endCardDrag(page: Page) {
  await page.mouse.up()
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(0)
}

/** Give the debounced autosave time to flush before reloading. */
async function settleAutosave(page: Page) {
  await page.waitForTimeout(800)
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Everything a list draws while a card is in the air — read off the live DOM, so
 * the same measurement works for an NPC list and a player section.
 */
interface DropPreview {
  /** The lifted copy following the pointer. */
  overlay: number
  /** The insertion line, and the invisible slot box it is drawn on. */
  indicators: number
  dropSlots: number
  /** The card left behind in its own slot, faded. */
  lifted: number
  /** True when any card is drawn at a size other than its laid-out one: a scale. */
  scaled: boolean
  /** Which edge of the marked slot the line sits on. */
  edge: string | null
  /** The card in the air — the one previewed in the marked slot. */
  draggedName: string | null
  /** The card whose slot the line marks — the slot the drop lands in. */
  markedName: string | null
  /** Where each card has been previewed: `Claw → Bite` means onto Bite's slot. */
  landing: Record<string, string>
  /** Each card's drawn box, to check the drop lands where the line drew it. */
  drawn: Record<string, Rect>
  /** The line, and the slot box it is drawn on. */
  line: Rect | null
  slot: Rect | null
}

/**
 * Read the preview `sectionSelector` is drawing right now. The slots are read
 * from the cards' own layout boxes (`offsetLeft`/`offsetTop`, which a transform
 * does not move) and each card's preview translation is added to them, so the
 * answer is a permutation of the list — "Claw is now drawn on Bite's slot" —
 * that two different lists can be compared by directly.
 */
async function readPreview(
  page: Page,
  sectionSelector: string,
): Promise<DropPreview> {
  return page.evaluate((selector) => {
    const section = document.querySelector(selector)
    if (!section) throw new Error(`no ability section matched ${selector}`)
    const nameOf = (el: Element) =>
      el.querySelector('.ability-card__name')?.textContent ?? ''
    const box = (el: Element | null): Rect | null =>
      el ? (el.getBoundingClientRect().toJSON() as Rect) : null
    const cards = [...section.querySelectorAll<HTMLElement>('.sortable-ability[data-ability-id]')]
    /** The slots as laid out, which is what a preview translation lands on. */
    const slots = cards.map((el) => ({
      name: nameOf(el),
      x: el.offsetLeft,
      y: el.offsetTop,
    }))
    const slotUnder = (x: number, y: number) =>
      slots.find((s) => Math.abs(s.x - x) <= 2 && Math.abs(s.y - y) <= 2)?.name ??
      'off-list'
    const drawnAt = (el: HTMLElement) => {
      const transform = getComputedStyle(el).transform
      if (!transform || transform === 'none') {
        return { x: el.offsetLeft, y: el.offsetTop }
      }
      const matrix = new DOMMatrixReadOnly(transform)
      return { x: el.offsetLeft + matrix.m41, y: el.offsetTop + matrix.m42 }
    }
    const dragging = section.querySelector('.sortable-ability--dragging')
    const line = section.querySelector('.ability-drop-indicator')
    const slot = line?.closest('[data-drop-target]') ?? null
    const markedId = slot?.getAttribute('data-drop-target')
    const marked = markedId
      ? section.querySelector(`.sortable-ability[data-ability-id="${markedId}"]`)
      : null

    return {
      overlay: document.querySelectorAll('.sortable-ability--overlay').length,
      indicators: section.querySelectorAll('.ability-drop-indicator').length,
      dropSlots: section.querySelectorAll('.ability-drop-slot').length,
      lifted: section.querySelectorAll('.sortable-ability--dragging').length,
      scaled: cards.some((el) => {
        const rect = el.getBoundingClientRect()
        return (
          Math.abs(rect.width - el.offsetWidth) > 1 ||
          Math.abs(rect.height - el.offsetHeight) > 1
        )
      }),
      edge: slot?.getAttribute('data-drop-edge') ?? null,
      draggedName: dragging ? nameOf(dragging) : null,
      markedName: marked ? nameOf(marked) : null,
      landing: Object.fromEntries(
        cards.map((el) => {
          const at = drawnAt(el)
          return [nameOf(el), slotUnder(at.x, at.y)]
        }),
      ),
      drawn: Object.fromEntries(cards.map((el) => [nameOf(el), box(el)])),
      line: box(line),
      slot: box(slot),
    }
  }, sectionSelector)
}

/**
 * Everything both surfaces must draw mid-drag: the ghost, the lifted card faded
 * in its own slot, the insertion line drawn on the slot the card is previewed
 * in — at that slot's leading edge, exactly as wide as the card — the cards slid
 * onto the slots the drop leaves them in, and nothing scaled.
 */
function expectDropPreview(
  preview: DropPreview,
  landing: Record<string, string>,
) {
  expect(preview.overlay).toBe(1)
  expect(preview.indicators).toBe(1)
  expect(preview.dropSlots).toBe(1)
  expect(preview.lifted).toBe(1)
  expect(preview.scaled).toBe(false)
  expect(preview.edge).toBe('before')
  expect(preview.draggedName).toBe('Howl')
  expect(preview.markedName).toBe('Claw')
  expect(preview.landing).toEqual(landing)

  // The line belongs to the slot the lifted card is previewed in — the card is
  // drawn in the slot it is about to take, which is what lets the line's index
  // and the drop's index be the same number.
  const drawn = preview.drawn['Howl']
  expect(Math.abs(drawn.x - preview.slot!.x)).toBeLessThan(2)
  expect(Math.abs(drawn.y - preview.slot!.y)).toBeLessThan(2)
  expect(Math.abs(drawn.width - preview.slot!.width)).toBeLessThan(2)
  // And the bar sits in the gap on that slot's leading edge, spanning it.
  expect(Math.abs(preview.line!.width - drawn.width)).toBeLessThan(2)
  expect(Math.abs(preview.line!.x - drawn.x)).toBeLessThan(2)
  expect(Math.abs(preview.line!.bottom - drawn.top)).toBeLessThan(8)
}

/**
 * Three cards of different heights, and how the preview must draw them once
 * "Howl" is dragged onto the top slot: every card takes the slot the drop leaves
 * it in — the array move `[Claw, Bite, Howl] → [Howl, Claw, Bite]` written as
 * slots.
 */
const DRAG_CARDS: [name: string, description: string][] = [
  ['Claw', 'Short one.'],
  [
    'Bite',
    'A description long enough to wrap over several lines of the card body, so this card stands a good deal taller than the ones beside it.',
  ],
  ['Howl', 'Tiny.'],
]
const DRAG_LANDING = { Claw: 'Bite', Bite: 'Howl', Howl: 'Claw' }

test('an NPC sheet reorders its abilities by dragging a card', async ({ page }) => {
  await gotoHome(page)
  await createNpc(page, 'Bandit')
  await sheetCard(page, 'Bandit').click()

  // Edit the NPC's own sheet and give it three abilities.
  await page.getByRole('tab', { name: 'Edit' }).click()
  const section = page.locator('.npc-abilities-section')
  await expect(section).toBeVisible()

  // A brand-new NPC is never ability-less: its Basic Attack is pinned to the
  // head of the list, in the same grid — with an Edit button and, unlike every
  // authored ability beside it, no Remove (it is not a deletable block) and no
  // grip (nothing drags it).
  await expect(
    section.locator('.ability-card-wrap--pinned .ability-card__name'),
  ).toHaveText('Basic Attack')
  await expect(
    section.locator('.ability-card-wrap--pinned').getByRole('button', { name: 'Edit' }),
  ).toBeVisible()

  for (const name of ['Claw', 'Bite', 'Howl']) {
    await addAbility(page, section, name)
  }
  await expect(abilityNames(page, section)).toHaveText(['Claw', 'Bite', 'Howl'])
  // One grip per authored card: the list is draggable in edit mode.
  await expect(grips(section)).toHaveCount(3)
  // One Remove per authored card — the pinned Basic Attack offers none.
  await expect(section.getByRole('button', { name: 'Remove' })).toHaveCount(3)
  // Grid view — the layout the embedded section has to match, in the browser.
  await expect(section.locator('.ability-grid')).toHaveClass(/ability-grid--cards/)
  expect(
    await section
      .locator('.ability-grid')
      .evaluate((el) => getComputedStyle(el).columnCount),
  ).toBe('3')

  // Drag the last card onto the first: "Howl" takes the top slot.
  const cards = sortableCards(section)
  await beginCardDrag(page, cards.nth(2), cards.nth(0))
  // The drag is live and the list is drawing the drop: the ghost follows the
  // pointer, the source card is faded in its slot, the insertion line marks the
  // slot "Howl" will take, and the cards have slid onto the slots the drop will
  // leave them in.
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(1)
  await expect(section.locator('.sortable-ability--dragging')).toHaveCount(1)
  await expect(section.locator('.ability-drop-indicator')).toHaveCount(1)
  await expect(section.locator('.ability-drop-slot')).toHaveCount(1)
  await endCardDrag(page)
  await expect(abilityNames(page, section)).toHaveText(['Howl', 'Claw', 'Bite'])

  // The new order is written to the record, so it survives a reload.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'NPCs' }).first().click()
  await sheetCard(page, 'Bandit').click()
  const reloaded = page.locator('.npc-abilities-section')
  await expect(abilityNames(page, reloaded)).toHaveText(['Howl', 'Claw', 'Bite'])
  // The Basic Attack is still the list's first card in view mode too.
  await expect(reloaded.locator('.ability-card__name').first()).toHaveText(
    'Basic Attack',
  )
  // View mode is a static reference: cards render, grips do not.
  await expect(grips(reloaded)).toHaveCount(0)
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
  // grid/list toggle, the "+ Add Ability" button, a grip per card — and the same
  // pinned Basic Attack at the head of the list.
  await expect(
    section.getByRole('tablist', { name: 'Abilities view' }),
  ).toBeVisible()
  await expect(
    section.locator('.ability-card-wrap--pinned .ability-card__name'),
  ).toHaveText('Basic Attack')
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

  // Drag the last card onto the first — the same gesture as the sheet page,
  // drawing the same preview.
  const cards = sortableCards(section)
  await beginCardDrag(page, cards.nth(2), cards.nth(0))
  await expect(page.locator('.sortable-ability--overlay')).toHaveCount(1)
  await expect(section.locator('.ability-drop-indicator')).toHaveCount(1)
  await expect(section.locator('.ability-drop-slot')).toHaveCount(1)
  await endCardDrag(page)
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

test('the NPC list draws the player sheet’s drag preview, card for card', async ({
  page,
}) => {
  // The reference drawing: a player sheet's Ability Pool, dragged with the same
  // gesture the NPC test below uses. The pool is the plainest player section —
  // no slot budget — and it is the one the NPC list has to match.
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()
  const pool = page.locator('.sheet-section--pool')
  for (const [name, description] of DRAG_CARDS) {
    await addAbility(page, pool, name, description)
  }
  await pool.scrollIntoViewIfNeeded()

  const poolCards = sortableCards(pool)
  await beginCardDrag(page, poolCards.nth(2), poolCards.nth(0))
  const playerPreview = await readPreview(page, '.sheet-section--pool')
  expectDropPreview(playerPreview, DRAG_LANDING)
  await endCardDrag(page)
  await expect(abilityNames(page, pool)).toHaveText(['Howl', 'Claw', 'Bite'])

  // The same three cards, the same gesture, on an NPC sheet in edit mode…
  await createNpc(page, 'Bandit')
  await sheetCard(page, 'Bandit').click()
  await page.getByRole('tab', { name: 'Edit' }).click()
  const section = page.locator('.npc-abilities-section')
  for (const [name, description] of DRAG_CARDS) {
    await addAbility(page, section, name, description)
  }
  await section.scrollIntoViewIfNeeded()

  const cards = sortableCards(section)
  await beginCardDrag(page, cards.nth(2), cards.nth(0))
  const npcPreview = await readPreview(page, '.npc-abilities-section')

  // …draws the same picture: the same line on the same slot, the same cards
  // moved onto the same slots, nothing scaled.
  expectDropPreview(npcPreview, DRAG_LANDING)
  expect(npcPreview.landing).toEqual(playerPreview.landing)
  // The lifted card is drawn in the slot it is about to take, which is what
  // makes the line's index and the drop's index the same number.
  expect(npcPreview.draggedName).toBe(playerPreview.draggedName)

  // And it really lands there: the card settles into the box the preview drew
  // it in, not merely into the right position in the list.
  await endCardDrag(page)
  await expect(abilityNames(page, section)).toHaveText(['Howl', 'Claw', 'Bite'])
  await expect
    .poll(async () => {
      const landed = (await section
        .locator('.ability-card-wrap')
        .filter({ hasText: 'Howl' })
        .boundingBox())!
      return Math.max(
        Math.abs(landed.x - npcPreview.drawn['Howl'].x),
        Math.abs(landed.y - npcPreview.drawn['Howl'].y),
      )
    })
    .toBeLessThan(2)
})
