/**
 * E2E: duplicating an ability block and moving blocks with the copy/paste
 * clipboard — within a section, between sections, and between tabs.
 *
 * The unit tests pin the copy rules (fresh ids everywhere, a full uses budget,
 * switches off — `abilityClone.test.ts`) and the store's index-insertion
 * contract (`characterStore.test.ts`). What needs the real app is the wiring
 * this spec walks: that Duplicate really lands the copy after its original,
 * that Copy raises the toast and arms a Paste button in *every* ability
 * section, that a paste into another tab's section lands on the record, and
 * that all of it survives the debounced autosave and a reload.
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

/** Give the debounced autosave time to flush before reloading. */
async function settleAutosave(page: Page) {
  await page.waitForTimeout(800)
}

/** Add one ability to whichever section is in edit mode. */
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

test('duplicate, copy and paste move blocks between sections and tabs', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()

  // Two slotted abilities, so the duplicate's landing position is meaningful.
  const slotted = page.locator('.sheet-section--slotted')
  await addAbility(page, slotted, 'Alpha')
  await addAbility(page, slotted, 'Bravo')
  await expect(abilityNames(slotted)).toHaveText(['Alpha', 'Bravo'])

  // Duplicate inserts the copy directly after its original.
  await card(slotted, 'Alpha')
    .getByRole('button', { name: 'Duplicate' })
    .click()
  await expect(abilityNames(slotted)).toHaveText(['Alpha', 'Alpha', 'Bravo'])

  // Copy arms the clipboard and says so; every ability section grows a Paste.
  await card(slotted, 'Bravo').getByRole('button', { name: 'Copy' }).click()
  await expect(page.getByText('Copied “Bravo”')).toBeVisible()
  const pool = page.locator('.sheet-section--pool')
  await expect(pool.getByRole('button', { name: 'Paste' })).toBeVisible()

  // The pair reads as two controls, not one smudged button: Paste sits on the
  // same row as "+ Add Ability", with a real gap between their edges.
  const addBox = (await pool.getByRole('button', { name: '+ Add Ability' }).boundingBox())!
  const pasteBox = (await pool.getByRole('button', { name: 'Paste' }).boundingBox())!
  expect(Math.abs(pasteBox.y - addBox.y)).toBeLessThan(4)
  expect(pasteBox.x - (addBox.x + addBox.width)).toBeGreaterThan(4)

  // Paste into the pool (another section on the same tab)…
  await pool.getByRole('button', { name: 'Paste' }).click()
  await expect(abilityNames(pool)).toHaveText(['Bravo'])

  // …and into Core Innate Abilities, the third list on this tab.
  const core = page.locator('.sheet-section--core')
  await core.getByRole('button', { name: 'Paste' }).click()
  await expect(abilityNames(core).first()).toHaveText('Bravo')
  // The Core section is a flex column, not block flow: the row keeps the pair
  // side by side there too instead of letting the column stretch them.
  const coreAdd = (await core
    .getByRole('button', { name: '+ Add Innate Ability' })
    .boundingBox())!
  const corePaste = (await core.getByRole('button', { name: 'Paste' }).boundingBox())!
  expect(Math.abs(corePaste.y - coreAdd.y)).toBeLessThan(4)
  expect(corePaste.x - (coreAdd.x + coreAdd.width)).toBeGreaterThan(4)

  // A custom tab's ability section gets the same Paste, from the same
  // clipboard — the cross-tab half of the feature.
  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.getByRole('textbox').last().press('Enter')
  await addSection(page, /^Ability Block/)
  const tab = page.locator('.custom-tab-content')
  await tab.getByRole('button', { name: 'Paste' }).click()
  await expect(abilityNames(tab)).toHaveText(['Bravo'])

  // Every paste landed on the character record, so the layout survives a reload.
  await settleAutosave(page)
  await page.reload()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await sheetCard(page, 'Vex').click()

  await expect(abilityNames(page.locator('.sheet-section--slotted'))).toHaveText(
    ['Alpha', 'Alpha', 'Bravo'],
  )
  await expect(abilityNames(page.locator('.sheet-section--pool'))).toHaveText([
    'Bravo',
  ])
  await expect(
    abilityNames(page.locator('.sheet-section--core')).first(),
  ).toHaveText('Bravo')
  await page.getByRole('tab', { name: 'New Tab' }).click()
  await expect(abilityNames(page.locator('.custom-tab-content'))).toHaveText([
    'Bravo',
  ])

  // View mode is a static sheet: the clipboard controls are edit-mode chrome.
  await expect(page.getByRole('button', { name: 'Paste' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Duplicate' })).toHaveCount(0)
})

test('a pasted block is a fresh copy, not a second view of the original', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')
  await page.getByRole('tab', { name: 'Edit' }).click()

  const pool = page.locator('.sheet-section--pool')
  await addAbility(page, pool, 'Rush')
  await card(pool, 'Rush').getByRole('button', { name: 'Duplicate' }).click()
  await expect(abilityNames(pool)).toHaveText(['Rush', 'Rush'])

  // Edit the copy: the original keeps its name, and removing the copy leaves
  // the original in place — the two cards share nothing but their authored
  // fields.
  await card(pool, 'Rush').nth(1).getByRole('button', { name: 'Edit' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit Ability' })
  await expect(editor).toBeVisible()
  await editor.getByPlaceholder('Ability name').fill('Rush II')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(abilityNames(pool)).toHaveText(['Rush', 'Rush II'])

  await card(pool, 'Rush II').getByRole('button', { name: 'Remove' }).click()
  await page
    .getByRole('dialog', { name: 'Remove Ability?' })
    .getByRole('button', { name: 'Remove', exact: true })
    .click()
  await expect(abilityNames(pool)).toHaveText(['Rush'])
})
