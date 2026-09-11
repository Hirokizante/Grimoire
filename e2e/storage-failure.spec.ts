/**
 * E2E: storage-failure behavior.
 *
 * The GM Screen (and every list page) reads its data from IndexedDB on mount.
 * A version upgrade is **blocked**, not failed, while another connection holds
 * the database open — a stale Grimoire tab, or a cached older build whose
 * `DB_VERSION` is lower. In that state Chromium fires no event at all and the
 * open request simply never settles, so an unguarded `await` leaves the page
 * spinning on "Loading…" forever with no error and no way out.
 *
 * These tests pin the recovery contract:
 *   1. the load never hangs indefinitely (the open has a deadline),
 *   2. the failure is explained on screen with a Retry action,
 *   3. retrying once the blocking connection is gone succeeds.
 */

import { test, expect, type Page } from '@playwright/test'

/** Replace the app database with a v4 one (the pre-GM-Screen schema). */
async function seedV4Database(page: Page) {
  await page.goto('./')
  await page.waitForTimeout(300)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('grimoire')
        del.onsuccess = () => {
          const req = indexedDB.open('grimoire', 4)
          req.onupgradeneeded = () => {
            const db = req.result
            db.createObjectStore('characters', { keyPath: 'id' })
            const versions = db.createObjectStore('versions', { keyPath: 'id' })
            versions.createIndex('characterId', 'characterId', { unique: false })
            const logs = db.createObjectStore('roll_logs', { keyPath: 'id' })
            logs.createIndex('characterId', 'characterId', { unique: false })
            db.createObjectStore('statuses', { keyPath: 'id' })
          }
          req.onsuccess = () => {
            req.result.close()
            resolve()
          }
          req.onerror = () => reject(req.error)
        }
        del.onerror = () => reject(del.error)
      }),
  )
}

test('a blocked database upgrade shows a retryable error, not an endless spinner', async ({
  context,
  page,
}) => {
  await seedV4Database(page)

  // An "old build" tab holding a v4 connection open. Served as an inert
  // same-origin document so this tab parks the connection without the app
  // itself upgrading the schema first.
  const oldTab = await context.newPage()
  await oldTab.route('**/blank.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>holder</title>',
    }),
  )
  await oldTab.goto('./blank.html')
  expect(
    await oldTab.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('grimoire', 4)
          req.onsuccess = () => {
            // Deliberately never closed — this is what blocks the v5 upgrade.
            ;(window as unknown as Record<string, unknown>).__hold = req.result
            resolve('held')
          }
          req.onerror = () => resolve('failed')
        }),
    ),
  ).toBe('held')

  await page.goto('./')
  await page.getByRole('button', { name: 'GM Screen' }).first().click()

  // It starts out loading (the request is blocked, not failed)…
  await expect(page.getByText(/Loading GM screens/)).toBeVisible()

  // …but must not stay there: after the open deadline the page explains
  // itself and offers a way forward.
  await expect(page.getByText(/Couldn.t load your GM screens/)).toBeVisible({
    timeout: 25_000,
  })
  await expect(page.getByText(/locked by another Grimoire tab/)).toBeVisible()
  await expect(page.getByText(/Loading GM screens/)).toHaveCount(0)
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible()

  // Releasing the blocking connection makes Retry succeed.
  await oldTab.evaluate(() =>
    ((window as unknown as Record<string, unknown>).__hold as IDBDatabase)?.close(),
  )
  await retry.click()
  await expect(page.getByText(/No GM screen yet/)).toBeVisible({ timeout: 20_000 })
})

test('the character list recovers from the same blocked upgrade', async ({
  context,
  page,
}) => {
  await seedV4Database(page)

  const oldTab = await context.newPage()
  await oldTab.route('**/blank.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>holder</title>',
    }),
  )
  await oldTab.goto('./blank.html')
  await oldTab.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('grimoire', 4)
        req.onsuccess = () => {
          ;(window as unknown as Record<string, unknown>).__hold = req.result
          resolve('held')
        }
      }),
  )

  await page.goto('./')
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await expect(page.getByText(/Couldn.t load your library/)).toBeVisible({
    timeout: 25_000,
  })
  await expect(page.getByText(/Loading characters/)).toHaveCount(0)
})

/**
 * A half-applied schema upgrade: the database is stamped at the current
 * version but an object store was never created (the browser killing the
 * upgrade transaction, or an abandoned open landing late). Because re-opening
 * at the same version can never fire `upgradeneeded` again, such a database
 * fails EVERY query forever with:
 *
 *   "Failed to execute 'transaction' on 'IDBDatabase':
 *    One of the specified object stores was not found."
 *
 * `openDB` now verifies the schema and repairs it by bumping the version.
 * These tests pin that behaviour, and that user data survives the repair.
 */

/** Rewrite the database into the broken v5 shape, preserving characters. */
async function breakSchemaKeepingData(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await page
    .getByRole('button', { name: /Create New Character|^New$/ })
    .first()
    .click()
  await page.getByLabel('Character Name').fill('Precious Sheet')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('button', { name: 'Characters' }).first().click()
  // Let the initial write commit before rewriting the database.
  await page.waitForTimeout(1000)

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('grimoire')
        open.onsuccess = () => {
          const src = open.result
          const read = src
            .transaction('characters', 'readonly')
            .objectStore('characters')
            .getAll()
          read.onsuccess = () => {
            const chars = read.result
            src.close()
            const del = indexedDB.deleteDatabase('grimoire')
            del.onsuccess = () => {
              const req = indexedDB.open('grimoire', 5)
              req.onupgradeneeded = () => {
                const db = req.result
                // Everything EXCEPT `screens`, stamped at version 5.
                db.createObjectStore('characters', { keyPath: 'id' })
                const versions = db.createObjectStore('versions', { keyPath: 'id' })
                versions.createIndex('characterId', 'characterId', { unique: false })
                const logs = db.createObjectStore('roll_logs', { keyPath: 'id' })
                logs.createIndex('characterId', 'characterId', { unique: false })
                db.createObjectStore('statuses', { keyPath: 'id' })
              }
              req.onsuccess = () => {
                const db = req.result
                const tx = db.transaction('characters', 'readwrite')
                for (const c of chars) tx.objectStore('characters').put(c)
                tx.oncomplete = () => {
                  db.close()
                  resolve()
                }
                tx.onerror = () => reject(tx.error)
              }
              req.onerror = () => reject(req.error)
            }
            del.onerror = () => reject(del.error)
          }
        }
      }),
  )
}

test('a half-applied schema upgrade repairs itself without losing data', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await breakSchemaKeepingData(page)
  await page.reload()

  // The character written before the break is still there.
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await expect(page.getByText('Precious Sheet')).toBeVisible({ timeout: 15_000 })

  // The GM Screen loads instead of showing the missing-store error.
  await page.getByRole('button', { name: 'GM Screen' }).first().click()
  await expect(page.getByText(/Couldn.t load your GM screens/)).toHaveCount(0)
  await expect(page.getByText(/No GM screen yet/)).toBeVisible({ timeout: 15_000 })

  // Screens are writable again.
  await page.getByRole('button', { name: 'New Screen' }).first().click()
  await page.getByLabel('Screen name').fill('Session 4')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('tab', { name: 'Session 4' })).toBeVisible()

  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByRole('button', { name: /Precious Sheet/ }).click()
  await expect(page.locator('.gm-panel--character')).toHaveCount(1)

  // And the whole thing survives a reload.
  await page.waitForTimeout(800)
  await page.reload()
  await page.getByRole('button', { name: 'GM Screen' }).first().click()
  await expect(page.getByRole('tab', { name: 'Session 4' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.locator('.gm-panel--character')).toHaveCount(1)

  // No unhandled page errors anywhere in the recovery.
  expect(errors).toEqual([])
})

test('one connection is shared, so repeated reads and writes keep working', async ({
  page,
}) => {
  // The connection is a long-lived singleton now. Every helper used to close
  // it on exit, which silently broke every operation after the first
  // ("The database connection is closing."). Exercise a sequence of mixed
  // reads and writes to keep that regression out.
  await page.goto('./')
  await page.getByRole('button', { name: 'NPCs' }).first().click()
  await page
    .getByRole('button', { name: /Create New NPC|^New$/ })
    .first()
    .click()
  await page.getByLabel('Character Name').fill('Bandit')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  await page.getByRole('button', { name: 'GM Screen' }).first().click()
  await page.getByRole('button', { name: 'New Screen' }).first().click()
  await page.getByRole('button', { name: 'Create' }).click()

  // Spawn three instances: each is a write, and reads happen alongside.
  await page.getByRole('button', { name: 'Add NPC' }).first().click()
  const row = page
    .locator('.gm-picker__list .gm-picker__item')
    .filter({ hasText: 'Bandit' })
  await row.click()
  await row.click()
  await row.click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.locator('.gm-panel--npc')).toHaveCount(3)

  // All three persisted together.
  await page.waitForTimeout(800)
  await page.reload()
  await page.getByRole('button', { name: 'GM Screen' }).first().click()
  await expect(page.locator('.gm-panel--npc')).toHaveCount(3, { timeout: 15_000 })
})
