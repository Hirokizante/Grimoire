/**
 * E2E: compound dice notation in sheet prose.
 *
 * The unit tests pin the parser, the scanner and the breakdown in isolation, and
 * the component tests pin the pill and the operators it draws. This spec pins
 * what only the real app can answer, in a real browser against the production
 * build:
 *
 *   - a calculation written in a description — `(1d6+POW)*2/2d6+AGI` —
 *     highlights as ONE pill and nothing after it is swallowed,
 *   - clicking it rolls the whole expression: the terms wear the operators that
 *     join them (`× 2`, `÷ 2d6`) and the working line keeps its shape,
 *   - the documented `POW/MAR` alternative form still highlights as one term
 *     beside it, rather than being read as division, and
 *   - Advantage/Disadvantage is rolled after the initial roll and the new total
 *     replaces the same roll-log entry.
 *
 * Runs against the production build via `vite preview` (see playwright.config.ts)
 * in a fresh browser context, driving the app's real controls.
 */

import { test, expect, type Page } from '@playwright/test'

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

test('a compound expression is one pill and rolls its own working', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  await page
    .getByPlaceholder(/Describe the character's innate nature/)
    .fill(
      'Overload deals (1d6+POW)*2/2d6+AGI damage, or 1d6+POW/MAR at range.',
    )
  // Give the debounced autosave time to flush before leaving the page.
  await page.waitForTimeout(800)

  await page.getByRole('tab', { name: 'View', exact: true }).click()

  // One pill for the calculation, and the prose around it stays prose.
  const compound = page.getByRole('button', {
    name: '(1d6+POW)*2/2d6+AGI',
  })
  await expect(compound).toBeVisible()
  await expect(page.getByText(/damage, or/)).toBeVisible()

  await compound.click()

  // The operators joining the terms, in the order they were rolled: the added
  // POW wears its own sign, the multiplied 2 and the divisor 2d6 take a glyph.
  const operators = page.locator('.dice-modal__term-op')
  await expect(operators).toHaveText(['×', '÷'])
  await expect(page.locator('.dice-modal__terms')).toContainText('+POW(')
  await expect(page.locator('.dice-modal__breakdown')).toHaveText(
    /^\(1d6\+POW\)\*2\/2d6\+AGI → .+ × 2 ÷ .+ = -?\d+$/,
  )
  await page.getByRole('button', { name: 'Done' }).click()

  // The alternative form is still an alternative, not a division.
  await page.getByRole('button', { name: '1d6+POW/MAR' }).click()
  await expect(page.locator('.dice-modal__breakdown')).toHaveText(
    /^1d6\+POW\/MAR → .+ = \d+$/,
  )
  await page.getByRole('button', { name: 'Done' }).click()
})

test('advantage rolls d6s after the initial roll and updates the log entry', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  await page
    .getByPlaceholder(/Describe the character's innate nature/)
    .fill('Overload deals 1d20 damage at any range.')
  // Give the debounced autosave time to flush before leaving the page.
  await page.waitForTimeout(800)
  await page.getByRole('tab', { name: 'View', exact: true }).click()

  await page.getByRole('button', { name: '1d20' }).click()
  const modal = page.getByRole('dialog')
  const baseTotal = Number(
    await modal.locator('.dice-modal__total').textContent(),
  )

  // The d6s are rolled only when the button is pressed, after the initial roll.
  await modal.getByRole('spinbutton', { name: 'Roll advantage' }).fill('2')
  await modal.getByRole('button', { name: 'Roll Advantage' }).click()

  const modifier = Number(
    (await modal.locator('.dice-advantage__modifier').textContent())!.replace(
      '−',
      '-',
    ),
  )
  await expect(modal.locator('.dice-advantage__kind')).toHaveText('Advantage +2')
  await expect(modal.locator('.dice-advantage__rolls .dice-modal__roll')).toHaveCount(2)
  await expect(modal.locator('.dice-modal__total')).toHaveText(
    String(baseTotal + modifier),
  )

  // The roll-log entry is rewritten in place, not duplicated, and reads the
  // adjustment back.
  await page.getByRole('button', { name: 'Done' }).click()
  await page.locator('.roll-log-tab').click()
  const entries = page.locator('.roll-log-item')
  await expect(entries).toHaveCount(1)
  await expect(entries.first().locator('.roll-log-item__total')).toHaveText(
    String(baseTotal + modifier),
  )
  await entries.first().locator('.roll-log-item__head').click()
  await expect(entries.first().locator('.roll-log-item__advantage')).toContainText(
    /^Advantage \+2:/,
  )
})
