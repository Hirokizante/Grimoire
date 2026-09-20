/**
 * E2E: the Interface UI-style switch (Settings → Interface).
 *
 * The Terminal style is a global override layer (terminal-ui.css) gated on
 * `data-ui-style` on <html>, plus a style-aware icon set
 * (components/ui/icons.tsx) that swaps Lucide for Pixelarticons. The parts
 * worth pinning in a real browser are the ones jsdom cannot see: a component
 * that declares its own radius actually collapsing to 0, the choice surviving
 * a reload, the CRT overlay never intercepting clicks, the icon pack really
 * swapping in the DOM, pages and pop-ups opening with no entrance animation,
 * and phone-width geometry staying inside the viewport. The last test also
 * pins the intended pairing with the Terminal Boot home animation.
 *
 * Runs against the production build via `vite preview` (playwright.config.ts).
 */

import { expect, test, type Page } from '@playwright/test'

const UI_STYLE_PICKER = '[aria-label="UI style"]'

/** The UI style option card whose label starts with `name`. */
function styleRadio(page: Page, name: RegExp) {
  return page.locator(UI_STYLE_PICKER).getByRole('radio', { name })
}

/** Open the Settings page from the home screen and wait for the picker. */
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.locator(UI_STYLE_PICKER)).toBeVisible()
}

test('the Terminal style squares the UI, persists, and reverts cleanly', async ({
  page,
}) => {
  await page.goto('./')
  await openSettings(page)
  await styleRadio(page, /^Terminal /).click()

  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'terminal')
  await expect(styleRadio(page, /^Terminal /)).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // A component that declares its own radius (`.theme-option` is 12px) is the
  // proof the override layer wins the cascade — not just unstyled elements.
  const radius = await styleRadio(page, /^Terminal /).evaluate(
    (el) => getComputedStyle(el).borderRadius,
  )
  expect(radius).toBe('0px')

  const bodyFont = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  )
  expect(bodyFont).toContain('Iosevka')

  // Every icon on the page swaps to the pixel pack.
  const packs = await page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll('[data-icon-pack]')].map((el) =>
          el.getAttribute('data-icon-pack'),
        ),
      ),
    ],
  )
  expect(packs).toEqual(['pixelarticons'])

  // A page mounts with no entrance animation and a modal opens in place.
  expect(
    await page
      .locator('.page')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')

  // The CRT overlay is home-page-only — no global body layer on the work UI.
  const bodyOverlay = await page.evaluate(() => {
    const style = getComputedStyle(document.body, '::after')
    return { position: style.position, content: style.content }
  })
  expect(bodyOverlay.position).toBe('static')
  expect(
    await page.evaluate(() => localStorage.getItem('grimoire:ui-style')),
  ).toBe('terminal')

  // The choice applies before first paint on the next load.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'terminal')

  // Switching back restores the original UI exactly.
  await openSettings(page)
  await styleRadio(page, /^Default /).click()
  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'default')
  const restoredRadius = await styleRadio(page, /^Default /).evaluate(
    (el) => getComputedStyle(el).borderRadius,
  )
  expect(restoredRadius).toBe('12px')
  const restoredPacks = await page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll('[data-icon-pack]')].map((el) =>
          el.getAttribute('data-icon-pack'),
        ),
      ),
    ],
  )
  expect(restoredPacks).toEqual(['lucide'])
})

test('the Terminal style opens pop-ups in place and keeps sheet tabs flat', async ({
  page,
}) => {
  await page.goto('./')
  await page.evaluate(() =>
    localStorage.setItem('grimoire:ui-style', 'terminal'),
  )
  await page.reload()

  // Create a character and a custom tab through the real flows.
  await page.getByRole('button', { name: 'Characters' }).first().click()
  await page
    .getByRole('button', { name: /Create New Character|^New$/ })
    .first()
    .click()
  await page.getByLabel('Character Name').fill('Tab Tester')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('tab', { name: 'Edit' }).click()
  await page.getByRole('button', { name: 'Add new tab' }).click()
  await page.keyboard.press('Enter')

  // Back on Main so the tab sits above the hero section it must merge with.
  await page.getByRole('tab', { name: 'Main' }).click()

  // The active tab is flat: no glow halo to bleed onto the section below.
  const tab = page.locator('.tab-bar__tab--active')
  await expect(tab).toBeVisible()
  expect(
    await tab.evaluate((el) => {
      const style = getComputedStyle(el)
      return { boxShadow: style.boxShadow, textShadow: style.textShadow }
    }),
  ).toEqual({ boxShadow: 'none', textShadow: 'none' })

  // Its bottom border paints the section's own surface, so the tab and the
  // section below read as one surface — no seam line between them. The border
  // color transitions in, so retry until it settles.
  const sectionBg = await page
    .locator('.hero-section')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  await expect(tab).toHaveCSS('border-bottom-color', sectionBg)

  // A pop-up (the tab delete confirm) opens with no fade or pop.
  await page.getByRole('button', { name: 'Delete tab' }).click()
  const overlay = page.locator('.modal-overlay')
  await expect(overlay).toBeVisible()
  expect(
    await overlay.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')
  expect(
    await page
      .locator('.modal-content')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')
})

test('the Terminal style stays inside a phone viewport and pairs with Terminal Boot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('./')

  // Enable both the style and the matching home animation, then reload onto home.
  await page.evaluate(() => {
    localStorage.setItem('grimoire:ui-style', 'terminal')
    localStorage.setItem('grimoire:home-animation', 'terminal')
  })
  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('data-ui-style', 'terminal')
  await expect(page.locator('.home-page__terminal')).toBeVisible()

  const titleFont = await page
    .locator('.home-page__title')
    .evaluate((el) => getComputedStyle(el).fontFamily)
  expect(titleFont).toContain('Iosevka')

  // The scanline overlay lives on the home page itself, above its content but
  // never swallowing input.
  const overlay = await page.evaluate(() => {
    const style = getComputedStyle(
      document.querySelector('.home-page')!,
      '::after',
    )
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      zIndex: style.zIndex,
    }
  })
  expect(overlay).toEqual({
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: '2',
  })

  // Nav tiles render without the original lift/scale transforms.
  const tile = page.locator('.home-nav__btn').nth(1)
  await tile.hover()
  expect(await tile.evaluate((el) => getComputedStyle(el).transform)).toBe(
    'none',
  )

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360)
})
