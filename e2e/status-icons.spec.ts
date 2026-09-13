/**
 * End-to-end coverage for the status icon picker.
 *
 * Component tests pin the picker's behaviour in jsdom, where no stylesheet or
 * font is ever loaded — so the one thing they cannot see is whether the
 * bundled RPG-Awesome pack actually reaches the browser. This walk opens a real
 * status, searches both tabs, and asserts the picked icons survive being saved
 * and reloaded on the production build, including that the pack's `@font-face`
 * resolved (a dropped CSS import would leave every pack icon a blank box).
 */

import { expect, test } from '@playwright/test'

test('a status icon can be searched for, picked, and survives a reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByText('Statuses', { exact: true }).click()

  // The seeded "Blinded" condition: open it, then its editor.
  await page.getByRole('button', { name: /^Blinded/ }).click()
  await page.getByRole('button', { name: 'Edit' }).click()

  const picker = page.locator('.status-icon-picker')

  // --- Emoji: search the Unicode catalog, not a paste box -------------------
  await page.getByLabel('Search emoji').fill('crossed swords')
  await expect(picker.getByText('1 match')).toBeVisible()
  await picker.getByRole('button', { name: 'crossed swords' }).click()
  await expect(picker.locator('.status-icon-picker__preview')).toHaveText(/Emoji/)

  // --- Icon pack: RPG-Awesome, searched by name ----------------------------
  await page.getByRole('tab', { name: 'Icon Pack' }).click()
  await page.getByLabel('Search icon pack').fill('potion')
  const potion = picker.getByRole('button', { name: 'Bubbling potion' })
  await expect(potion).toBeVisible()

  // The glyph is the pack's font: its class must come from the packaged CSS…
  const glyph = potion.locator('i.ra.ra-bubbling-potion')
  await expect(glyph).toHaveCSS('font-family', /RPGAwesome/)
  // …and the font file itself must have loaded (a dropped import renders
  // private-use boxes instead).
  await page.evaluate(() => document.fonts.ready)
  expect(
    await page.evaluate(() => document.fonts.check('16px RPGAwesome')),
  ).toBe(true)

  await potion.click()
  await expect(picker.locator('.status-icon-picker__preview')).toHaveText(
    'Icon pack · Bubbling potion',
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // --- Saved, rendered on the card, and still there after a reload ---------
  const card = page.locator('.status-card', { hasText: 'Blinded' }).first()
  await expect(card.locator('i.ra.ra-bubbling-potion')).toHaveCount(1)

  await page.reload()
  await page.getByText('Statuses', { exact: true }).click()
  await expect(
    page.locator('.status-card', { hasText: 'Blinded' }).first().locator('i.ra.ra-bubbling-potion'),
  ).toHaveCount(1)
})
