/**
 * E2E: Settings → Character Sheets → Match app theme.
 *
 * The unit tests pin the store, the sheet's rendered style, and the page
 * canvas in isolation. This spec pins the user-visible flow in a real browser
 * against the production build:
 *
 *   - the switch is off by default, so a sheet keeps its customization and its
 *     Customize button,
 *   - turning it on restyles the open sheet page with the app theme (palette,
 *     card and page backgrounds) and hides the Customize button,
 *   - the choice survives a reload, and
 *   - turning it back off restores the character's own palette and button.
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

/** Open a character's sheet from the character list. */
async function openSheet(page: Page, name: string) {
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await page.getByRole('button', { name: new RegExp(`^${name}\\b`) }).click()
  await expect(page.locator('.character-sheet')).toBeVisible()
}

/** The Character Sheets section's Match app theme toggle (not the GM one). */
function sheetThemeToggle(page: Page) {
  return page
    .locator('section[aria-labelledby="settings-character-sheets-heading"]')
    .locator('.settings-toggle-row')
}

/** The inline custom properties the sheet body rendered. */
async function sheetVars(page: Page) {
  return page.locator('.character-sheet').evaluate((el) => {
    const style = (el as HTMLElement).style
    return {
      accent: style.getPropertyValue('--accent-violet'),
      sheetBg: style.getPropertyValue('--sheet-bg'),
    }
  })
}

test('Match app theme strips sheet customization and survives a reload', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  // Default: the sheet owns its look and offers the Customize button.
  await expect(page.getByRole('button', { name: 'Customize' })).toBeVisible()

  // Parchment app theme, so the matching sheet's palette is unmistakable.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: /Parchment/ }).click()
  const toggle = sheetThemeToggle(page)
  await toggle.locator('.settings-toggle__track').click()
  await expect(toggle.getByRole('checkbox')).toBeChecked()

  await page.reload()
  await openSheet(page, 'Vex')

  const vars = await sheetVars(page)
  expect(vars.accent).toBe('#b3a48a') // PARCHMENT_SHEET_COLORS.accent
  expect(vars.sheetBg).toBe('#2e2b26') // PARCHMENT_SHEET_COLORS.bgSurface
  await expect(page.getByRole('button', { name: 'Customize' })).toHaveCount(0)
  await expect(page.locator('.sheet-page__bg-color')).toHaveCSS(
    'background-color',
    'rgb(38, 38, 38)', // PARCHMENT_SHEET_COLORS.bgBase
  )

  // Turn it back off: the character's own customization returns intact.
  await page.getByRole('button', { name: 'Settings' }).click()
  const toggleAgain = sheetThemeToggle(page)
  await toggleAgain.locator('.settings-toggle__track').click()
  await expect(toggleAgain.getByRole('checkbox')).not.toBeChecked()
  await page.reload()
  await openSheet(page, 'Vex')

  const restored = await sheetVars(page)
  expect(restored.accent).toBe('#9b7ed6') // DEFAULT_SHEET_COLORS.accent
  await expect(page.getByRole('button', { name: 'Customize' })).toBeVisible()
})
