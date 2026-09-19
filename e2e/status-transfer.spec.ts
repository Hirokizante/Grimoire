/**
 * End-to-end coverage for status import / export.
 *
 * Component tests cover the UI flow, but they mock IndexedDB — so the one
 * thing they cannot see is that a compendium import really REPLACES the
 * `statuses` store atomically and survives a reload. This spec drives the
 * production build: it exports a seeded condition from its modal, imports the
 * very file back (updating in place), imports a hand-authored condition, and
 * then replaces the whole compendium from a file.
 */

import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

/** Open the status compendium from the home screen. */
async function openCompendium(page: Page) {
  await page.goto('/')
  await page.getByText('Statuses', { exact: true }).click()
  await expect(page.locator('.status-grid')).toBeVisible()
}

test('a single status exports from its modal and imports back in place', async ({
  page,
}) => {
  await openCompendium(page)

  // Export the seeded "Blinded" condition from its modal.
  await page.getByRole('button', { name: /^Blinded/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Status details' })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('Status - Blinded.json')

  const path = await download.path()
  const exported = JSON.parse(readFileSync(path!, 'utf8'))
  expect(exported).toMatchObject({ app: 'grimoire', kind: 'status' })
  expect(exported.status.name).toBe('Blinded')

  await page.keyboard.press('Escape')

  // Re-importing the exported file updates the same-named condition in place.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'Blinded.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  })
  await expect(page.getByText(/Updated “Blinded”/)).toBeVisible()

  // A hand-authored condition imports with its missing fields back-filled.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'exhausted.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ name: 'Exhausted' })),
  })
  await expect(
    page.locator('.status-card', { hasText: 'Exhausted' }),
  ).toHaveCount(1)

  // The import is persisted, not just in-memory.
  await page.reload()
  await page.getByText('Statuses', { exact: true }).click()
  await expect(
    page.locator('.status-card', { hasText: 'Exhausted' }),
  ).toHaveCount(1)
})

test('a compendium file replaces the whole compendium, permanently', async ({
  page,
}) => {
  await openCompendium(page)

  // Export the compendium (the page head's Export is the only one here).
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(
    /^Grimoire Status Compendium \d{4}-\d{2}-\d{2}\.json$/,
  )
  const path = await download.path()
  const exported = JSON.parse(readFileSync(path!, 'utf8'))
  expect(exported.kind).toBe('status-compendium')
  expect(exported.statuses.length).toBeGreaterThan(0)

  // Importing a different compendium asks first, then replaces everything.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'compendium.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'grimoire',
        kind: 'status-compendium',
        fileVersion: 1,
        exportedAt: new Date().toISOString(),
        count: 2,
        statuses: [
          {
            name: 'Poisoned',
            icon: '☠️',
            iconType: 'emoji',
            description: 'Takes damage.',
          },
          { name: 'Hidden' },
        ],
      }),
    ),
  })

  const confirm = page.getByRole('dialog', {
    name: 'Import Status Compendium?',
  })
  await expect(confirm).toContainText('replace your entire compendium')
  await confirm
    .getByRole('button', { name: 'Replace Compendium' })
    .click()

  await expect(page.locator('.status-card')).toHaveCount(2)
  await expect(
    page.locator('.status-card', { hasText: 'Blinded' }),
  ).toHaveCount(0)

  // The replacement is what the database holds after a reload.
  await page.reload()
  await page.getByText('Statuses', { exact: true }).click()
  await expect(page.locator('.status-card')).toHaveCount(2)
})
