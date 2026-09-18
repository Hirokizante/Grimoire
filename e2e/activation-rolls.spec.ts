/**
 * E2E: automatic dice rolls on ability activation.
 *
 * The unit and component tests pin the config's shape, the roll order, and the
 * modal's markup in isolation. This spec pins what only the real app can
 * answer, in a real browser against the production build:
 *
 *   - the ability editor offers **Roll Dice on Activation** and stores the
 *     accuracy / damage / custom configuration,
 *   - pressing **Activate** on a player sheet's card performs every roll and
 *     shows them TOGETHER in one result window, accuracy first,
 *   - a hidden custom roll starts collapsed and can be revealed,
 *   - an NPC's ability never activates on the standalone base sheet, and
 *   - it does activate on the GM Screen under an NPC **instance**, rolling with
 *     the instance's own stats and spending the instance's AP.
 *
 * Runs against the production build via `vite preview` (see playwright.config.ts)
 * in a fresh browser context, driving the app's real controls.
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

/** Create a fresh NPC and land on its sheet. */
async function createNpc(page: Page, name: string) {
  await page.getByRole('button', { name: 'NPCs' }).first().click()
  await page
    .getByRole('button', { name: /Create New NPC|^New$/ })
    .first()
    .click()
  await page.getByLabel('Character Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
}

/** Navigate to the GM Screen through the title bar. */
async function gotoGmScreen(page: Page) {
  await page.getByRole('button', { name: 'GM Screen' }).first().click()
  await expect(
    page.getByRole('heading', { name: 'GM Screen', exact: true }),
  ).toBeVisible()
}

/** Give the debounced autosave time to flush before leaving the page. */
async function settleAutosave(page: Page) {
  await page.waitForTimeout(800)
}

/**
 * Author one ability in whichever ability editor is open, with automatic rolls:
 * accuracy on MAR, its own damage, one named custom roll, and a second custom
 * roll whose result starts hidden.
 */
async function addRollingAbility(
  page: Page,
  opts: { name: string; damage: string; traits?: string; apCost?: string },
) {
  await page.getByPlaceholder('Ability name').fill(opts.name)
  if (opts.traits) {
    await page.getByLabel('Traits (comma-separated)').fill(opts.traits)
  }
  if (opts.apCost) {
    await page.getByLabel('AP Cost').fill(opts.apCost)
  }
  await page.getByLabel('Damage').fill(opts.damage)

  await page.getByRole('checkbox', { name: 'Roll Dice on Activation' }).check()
  // Accuracy is seeded on MAR by the toggle itself.
  await expect(page.getByRole('button', { name: /Accuracy attribute/ })).toContainText(
    'd20 + MAR',
  )
  await page.getByRole('checkbox', { name: 'Roll damage' }).check()

  await page.getByRole('button', { name: '+ Add Custom Roll' }).click()
  await page.getByLabel('Custom roll 1 notation').fill('1d4')
  await page.getByLabel('Custom roll 1 name').fill('Bleed')

  await page.getByRole('button', { name: '+ Add Custom Roll' }).click()
  await page.getByLabel('Custom roll 2 notation').fill('1d8')
  await page.getByLabel('Custom roll 2 name').fill('Secret')
  await page.locator('.ability-editor__activation-roll-hidden input').nth(1).check()

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New Ability' })).toHaveCount(0)
}

/** The rolls inside the activation window, in the order they are shown. */
function activationRolls(page: Page): Locator {
  return page
    .locator('.dice-activation')
    .getByRole('article')
}

test('a player ability rolls accuracy, damage and custom rolls on activation', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  const slotted = page.locator('.sheet-section--slotted')
  await slotted.getByRole('button', { name: '+ Add Ability' }).click()
  await addRollingAbility(page, { name: 'Cleave', damage: '2d6', apCost: '1' })
  await page.getByRole('tab', { name: 'View', exact: true }).click()

  // The Activate button is the card wrapper's footer, a sibling of the card.
  const card = page.locator('.ability-activation').filter({ hasText: 'Cleave' })
  await expect(card.getByRole('button', { name: 'Activate' })).toBeVisible()
  await card.getByRole('button', { name: 'Activate' }).click()

  // One window for the whole action, named after the ability.
  const modal = page.getByRole('dialog', { name: 'Cleave' })
  await expect(modal).toBeVisible()

  // All four rolls are there at once, in the authored order.
  await expect(activationRolls(page)).toHaveCount(4)
  await expect(activationRolls(page).nth(0)).toContainText('Accuracy')
  await expect(activationRolls(page).nth(0)).toContainText('d20+MAR')
  await expect(activationRolls(page).nth(1)).toContainText('Damage')
  await expect(activationRolls(page).nth(1)).toContainText('2d6')
  await expect(activationRolls(page).nth(2)).toContainText('Bleed')
  await expect(activationRolls(page).nth(3)).toContainText('Secret')

  // The dice landed: each roll prints its working and a total.
  await expect(activationRolls(page).nth(0)).toContainText(/d20\+MAR → \d+ \+ \d+ = \d+/)
  await expect(activationRolls(page).nth(1)).toContainText(/2d6 → \d+ \+ \d+ = \d+/)

  // The hidden roll keeps its number but folds its working away until asked.
  const secret = activationRolls(page).nth(3)
  await expect(secret.locator('.dice-modal__breakdown')).toHaveCount(0)
  await secret.getByRole('button', { name: 'Show result' }).click()
  await expect(secret).toContainText(/1d8 → \d+ = \d+/)

  // The activation spent the AP, exactly as it did before this feature.
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(modal).toHaveCount(0)
  await expect(
    page.locator('.resource-bar').filter({ hasText: 'Action Points' }).locator('.resource-bar__value'),
  ).toContainText('2')
})

test('an NPC ability rolls on the GM Screen under an instance, never on the base sheet', async ({
  page,
}) => {
  await gotoHome(page)
  await createNpc(page, 'Bandit')

  // ---- Author the ability on the NPC BASE sheet --------------------------
  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: '+ Add Ability' }).first().click()
  // Recharge is what makes an ability activatable on a GM panel without a cost
  // (the NPC editor offers no AP/END/FP fields — an NPC has no pools of its
  // own). It also proves the panel's Activate rule is untouched by this feature.
  await addRollingAbility(page, {
    name: 'Cleave',
    damage: '1d6',
    traits: 'Action, Melee, Recharge (5)',
  })
  await page.getByRole('tab', { name: 'View', exact: true }).click()

  // A base NPC record is a static reference: no Activate button anywhere.
  await expect(page.locator('.ability-activation__btn')).toHaveCount(0)

  await settleAutosave(page)

  // ---- Spawn it on the GM Screen ----------------------------------------
  await gotoGmScreen(page)
  await page.getByRole('button', { name: 'New Screen' }).first().click()
  await page.getByLabel('Screen name').fill('Session 4')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: 'Add NPC' }).first().click()
  await page
    .locator('.gm-picker__list .gm-picker__item')
    .filter({ hasText: 'Bandit' })
    .click()
  await page.getByRole('button', { name: 'Done' }).click()

  const panel = page.locator('.gm-panel--npc').first()
  await panel.getByRole('button', { name: /Expand/ }).click()
  await expect(panel.locator('.gm-panel__sheet')).toBeVisible()

  // ---- The instance activates and rolls ---------------------------------
  // Every NPC panel also carries a pinned Basic Attack card, which activates on
  // its own, so the click is aimed at the authored ability's card.
  const cleave = panel.locator('.ability-activation').filter({ hasText: 'Cleave' })
  const activate = cleave.locator('.ability-activation__btn')
  await expect(activate).toBeVisible()
  await activate.click()

  const modal = page.getByRole('dialog', { name: 'Cleave' })
  await expect(modal).toBeVisible()
  await expect(activationRolls(page)).toHaveCount(4)
  // The notation resolved against the NPC base's stats, which the instance
  // reads — accuracy is still d20+MAR, and the damage is the authored 1d6.
  await expect(activationRolls(page).nth(0)).toContainText('d20+MAR')
  await expect(activationRolls(page).nth(1)).toContainText(/1d6 → \d+ = \d+/)

  // Closing the window leaves the panel showing the activation's aftermath:
  // the instance's own Recharge cooldown (the NPC editor offers no AP/END/FP
  // fields — an NPC has no pools of its own — so Recharge is what makes an
  // ability activatable on a panel, and the cooldown is the panel's own state,
  // never the base record's).
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(modal).toHaveCount(0)
  await expect(panel.locator('.gm-recharge--cooling')).toBeVisible()
  await expect(panel.getByText(/1 on cooldown/)).toBeVisible()
})

test('a damage-only activation can be marked as a critical hit by hand', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  const slotted = page.locator('.sheet-section--slotted')
  await slotted.getByRole('button', { name: '+ Add Ability' }).click()

  // Damage only, so there is no attack roll to auto-crit from.
  await page.getByPlaceholder('Ability name').fill('Heavy Swing')
  await page.getByLabel('Damage').fill('2d6')
  await page.getByRole('checkbox', { name: 'Roll Dice on Activation' }).check()
  await page.getByRole('checkbox', { name: 'Roll accuracy' }).uncheck()
  await page.getByRole('checkbox', { name: 'Roll damage' }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'View', exact: true }).click()

  const card = page.locator('.ability-activation').filter({ hasText: 'Heavy Swing' })
  await card.getByRole('button', { name: 'Activate' }).click()

  const modal = page.getByRole('dialog', { name: 'Heavy Swing' })
  await expect(modal).toBeVisible()

  const roll = activationRolls(page).nth(0)
  await expect(roll).toContainText('Damage')
  await expect(roll).toContainText('2d6')

  // Damage carries the Critical control — never Advantage/Disadvantage.
  const critToggle = roll.getByRole('button', { name: 'Critical Hit' })
  await expect(critToggle).toBeVisible()
  await expect(roll.getByRole('spinbutton')).toHaveCount(0)

  await critToggle.click()

  // The damage was rolled a second time: both totals show, the higher is kept,
  // and the card's big total is that higher number.
  const chips = roll.locator('.dice-critical__roll')
  await expect(chips).toHaveCount(2)
  const first = Number(await chips.nth(0).textContent())
  const second = Number(await chips.nth(1).textContent())
  await expect(roll.locator('.dice-critical__kept')).toHaveText(
    `keeps ${Math.max(first, second)}`,
  )
  await expect(roll.locator('.dice-activation__roll-total')).toHaveText(
    String(Math.max(first, second)),
  )
  await expect(roll.getByText('✦ CRIT')).toBeVisible()

  // Removing it restores the first roll exactly.
  await roll.getByRole('button', { name: 'Remove Critical' }).click()
  await expect(roll.locator('.dice-activation__roll-total')).toHaveText(
    String(first),
  )
  await expect(roll.locator('.dice-critical__result')).toHaveCount(0)
})

test('an accuracy total of 20+ crits the activation damage automatically', async ({
  page,
}) => {
  await gotoHome(page)
  await createPlayer(page, 'Vex')

  await page.getByRole('tab', { name: 'Edit', exact: true }).click()
  const slotted = page.locator('.sheet-section--slotted')
  await slotted.getByRole('button', { name: '+ Add Ability' }).click()

  // The +20 accuracy bonus makes any d20 roll reach the critical threshold,
  // so the auto-crit does not depend on the dice landing a certain way.
  await page.getByPlaceholder('Ability name').fill('Executioner')
  await page.getByLabel('Damage').fill('2d6')
  await page.getByRole('checkbox', { name: 'Roll Dice on Activation' }).check()
  await page.getByLabel('Extra accuracy bonus').fill('+20')
  await page.getByRole('checkbox', { name: 'Roll damage' }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('tab', { name: 'View', exact: true }).click()

  const card = page.locator('.ability-activation').filter({ hasText: 'Executioner' })
  await card.getByRole('button', { name: 'Activate' }).click()

  const modal = page.getByRole('dialog', { name: 'Executioner' })
  await expect(modal).toBeVisible()

  // Accuracy 20+, so the damage arrives already critical: two evaluations on
  // screen, the higher kept, and the control offering to remove it.
  const damage = activationRolls(page).nth(1)
  await expect(damage).toContainText('Damage')
  await expect(damage.getByText('✦ CRIT')).toBeVisible()
  await expect(damage.locator('.dice-critical__roll')).toHaveCount(2)
  await expect(
    damage.getByRole('button', { name: 'Remove Critical' }),
  ).toBeVisible()
})
