import { test, expect, Page, Locator } from '@playwright/test'

/** Handle a window.prompt dialog by filling in a provided name. */
function handlePrompt(page: Page, name: string) {
  page.once('dialog', (dialog) => dialog.accept(name))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Grimoire')).toBeVisible()
})

test('app launches with no characters', async ({ page }) => {
  await expect(page.getByText('No characters yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create New Character' })).toBeVisible()
})

test('create a character and navigate to its sheet', async ({ page }) => {
  handlePrompt(page, 'Nacht')
  await page.getByRole('button', { name: 'Create New Character' }).click()

  // Sheet should load with character name as heading
  await expect(page.getByRole('heading', { name: 'Nacht' })).toBeVisible()

  // Default HP for VIT 0 should be 20 — appears in the HP bar max
  await expect(page.getByText('/ 20').first()).toBeVisible()
})

test('new character has correct calculated stats', async ({ page }) => {
  handlePrompt(page, 'TestChar')
  await page.getByRole('button', { name: 'Create New Character' }).click()

  await expect(page.getByRole('heading', { name: 'TestChar' })).toBeVisible()

  // HP bar shows "20" as max: "20 / 20"
  await expect(page.getByText(/20/).first()).toBeVisible()

  // AGI 1 → Evasion 11, Movement 5
  await expect(page.getByText('11')).toBeVisible()
  // Movement + Evasion may both show; look for the movement token
  await expect(page.locator('text=/5/').first()).toBeVisible()
})

test('navigate back to character list', async ({ page }) => {
  handlePrompt(page, 'BackTest')
  await page.getByRole('button', { name: 'Create New Character' }).click()
  await expect(page.getByRole('heading', { name: 'BackTest' })).toBeVisible()

  // The back button has name="‹ Back" — click it by text match
  await page.getByText('‹ Back').click()

  // Character list now contains the created card
  await expect(page.getByText('BackTest')).toBeVisible()
})
