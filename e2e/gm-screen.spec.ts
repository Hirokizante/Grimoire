/**
 * E2E: the GM Screen end-to-end flow.
 *
 * Covers the acceptance path from the design spec: create a screen → add a
 * player character + spawn two instances of one NPC base → damage one
 * instance to 0 and confirm it going down leaves its sibling untouched →
 * reload the app and confirm the screen, panels, and HP all persisted.
 *
 * Runs against the production build via `vite preview` (see
 * playwright.config.ts) in a fresh browser context, so IndexedDB starts empty
 * and every record is created by the test itself. The app's own pages are
 * driven through their real controls — no store poking — so this doubles as a
 * smoke test for the refactored id-targeted mutations.
 */

import { test, expect, type Locator, type Page } from '@playwright/test'

/** Open the app at the home screen. */
async function gotoHome(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
}

/** Navigate to the GM Screen through the title bar. */
async function gotoGmScreen(page: Page) {
  await page.getByRole('button', { name: 'GM Screen' }).first().click()
  await expect(
    page.getByRole('heading', { name: 'GM Screen', exact: true }),
  ).toBeVisible()
}

/** Navigate to the character list through the title bar. */
async function gotoCharacters(page: Page) {
  await page.getByRole('button', { name: 'Characters' }).first().click()
}

/**
 * Create a fresh player character via the list page's real create flow and
 * return to the character list.
 */
async function createPlayerCharacter(page: Page, name: string) {
  await gotoCharacters(page)
  // The empty state offers "Create New Character"; a populated list offers
  // the header "New" button.
  await page
    .getByRole('button', { name: /Create New Character|^New$/ })
    .first()
    .click()
  await page.getByLabel('Character Name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // Creating a character navigates to its sheet — go back to the list. The
  // title bar's Characters button closes the open sheet.
  await gotoCharacters(page)
}

/** Create a fresh NPC via the NPC list page's real create flow. */
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

/** Open the panel's Damage dialog, apply a lethal amount with armor off. */
async function applyLethalDamage(page: Page, panelIndex: number) {
  const panel = page.locator('.gm-panel--npc').nth(panelIndex)
  await panel.getByRole('button', { name: 'Damage…' }).click()
  await page.getByRole('spinbutton').fill('999')
  await page.getByLabel(/Apply Armor/).uncheck()
  await page.getByRole('button', { name: 'Apply Damage' }).click()
  await page.getByRole('button', { name: '✕' }).click()
  return panel
}

/**
 * Track a compendium status on a panel through the Add Status picker: open the
 * panel's ＋ button, pick the duration chip on that status's row, then dismiss
 * the dialog (it stays open by design so several conditions can be applied).
 */
async function addStatus(
  page: Page,
  panel: Locator,
  statusName: string,
  duration: string,
) {
  await panel.getByRole('button', { name: /^Add status to/ }).click()
  await page
    .getByRole('group', { name: `Duration for ${statusName}` })
    .getByRole('button', { name: duration, exact: true })
    .click()
  await page.getByRole('button', { name: 'Done' }).click()
}

/** Measured geometry of a panel's tracked-status strip. */
function stripMetrics(panel: Locator) {
  return panel.evaluate((el) => {
    const strip = el.querySelector('.gm-statuses__strip') as HTMLElement
    const pills = Array.from(el.querySelectorAll('.gm-status-pill'))
    const row = el.querySelector('.gm-hp__row') as HTMLElement
    return {
      panelHeight: +el.getBoundingClientRect().height.toFixed(1),
      rowHeight: +row.getBoundingClientRect().height.toFixed(1),
      scrollWidth: strip.scrollWidth,
      clientWidth: strip.clientWidth,
      /** Column count of the canvas — 1 only once the phone layout is applied. */
      columns: document.querySelectorAll('.gm-screen__column').length,
      // Every pill's vertical centre — one line iff they all match.
      pillCentres: pills.map((p) => {
        const b = p.getBoundingClientRect()
        return +(b.top + b.height / 2).toFixed(1)
      }),
    }
  })
}

test.describe('GM Screen', () => {
  test('create a screen, mix panels, damage one instance, and persist', async ({
    page,
  }) => {
    await gotoHome(page)

    // ---- Assemble the roster through the normal pages ---------------------
    await createPlayerCharacter(page, 'Vex')
    await createNpc(page, 'Bandit')

    // ---- Create the screen ------------------------------------------------
    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByLabel('Screen name').fill('Session 4')
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('tab', { name: 'Session 4' })).toBeVisible()

    // ---- Add the player character ----------------------------------------
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()
    await expect(page.locator('.gm-panel--character')).toHaveCount(1)

    // ---- Spawn two instances of the same NPC base ------------------------
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    // Scope to the picker list: once the first instance exists, "Bandit" also
    // matches the panel's own controls behind the modal.
    const npcRow = page.locator('.gm-picker__list .gm-picker__item').filter({
      hasText: 'Bandit',
    })
    await npcRow.click()
    await npcRow.click()
    await page.getByRole('button', { name: 'Done' }).click()

    await expect(page.locator('.gm-panel--npc')).toHaveCount(2)

    // ---- Both instances spawn at the base's full HP (default statblock 20)
    for (const index of [0, 1]) {
      await expect(
        page
          .locator('.gm-panel--npc')
          .nth(index)
          .getByRole('img', { name: '20 of 20 hit points' }),
      ).toBeVisible()
    }

    // The HP track must actually paint a fill: it was blank because
    // `--hp-bar-color` is only injected inside sheet cards, so the fill's
    // `background` was invalid on the GM Screen chrome and rendered
    // transparent at every HP value.
    const hpFill = await page
      .locator('.gm-panel--npc')
      .nth(0)
      .locator('.gm-hp__fill')
      .evaluate((el) => {
        const track = el.parentElement!.getBoundingClientRect()
        const box = el.getBoundingClientRect()
        const bg = getComputedStyle(el).backgroundColor
        return { w: box.width, trackW: track.width, bg }
      })
    expect(hpFill.w).toBeGreaterThan(0)
    expect(hpFill.w / hpFill.trackW).toBeGreaterThan(0.9) // full HP ≈ full bar
    expect(hpFill.bg).not.toBe('rgba(0, 0, 0, 0)')
    expect(hpFill.bg).not.toBe('transparent')

    // Expanded panels: every attribute box is exactly the same width (the
    // sheet's `repeat(5, 1fr)` is `minmax(auto, 1fr)`, whose content floor made
    // MAR's column wider than VIT's), the full attribute names are hidden so
    // only the shorthand shows, and skill rows are uniform — in a two-column
    // grid the sheet's `nth-child(odd)` stripes land every odd row in the left
    // column and read as "the left column is highlighted".
    const characterPanel = page.locator('.gm-panel--character')
    await characterPanel.getByRole('button', { name: /Expand/ }).click()
    // Measure while expanded — the body only exists in the expanded state.
    await expect(characterPanel.locator('.gm-panel__sheet')).toBeVisible()

    const expanded = await characterPanel.evaluate((panel) => {
      const sheet = panel.querySelector('.gm-panel__sheet')!
      const boxes = Array.from(sheet.querySelectorAll('.attr-box'))
      const widths = boxes.map((b) => +b.getBoundingClientRect().width.toFixed(1))
      const skills = Array.from(sheet.querySelectorAll('.skill-list__item'))
      return {
        attrWidths: widths,
        attrNamesHidden: boxes.every(
          (b) =>
            getComputedStyle(b.querySelector('.attr-box__name') as Element)
              .display === 'none',
        ),
        attrAbbrShown: boxes.every(
          (b) =>
            getComputedStyle(b.querySelector('.attr-box__abbr') as Element)
              .display !== 'none',
        ),
        skillBackgrounds: [...new Set(skills.map((s) => getComputedStyle(s).backgroundColor))],
        skillNameColors: [
          ...new Set(
            skills.map((s) =>
              getComputedStyle(s.querySelector('.skill-list__name') as Element).color,
            ),
          ),
        ],
        skillWidths: [...new Set(skills.map((s) => +s.getBoundingClientRect().width.toFixed(1)))],
      }
    })
    // Equal widths (allow sub-pixel rounding).
    expect(Math.max(...expanded.attrWidths) - Math.min(...expanded.attrWidths)).toBeLessThan(1)
    expect(expanded.attrNamesHidden).toBe(true)
    expect(expanded.attrAbbrShown).toBe(true)
    // One background across all rows, and it is fully transparent.
    expect(expanded.skillBackgrounds).toEqual(['rgba(0, 0, 0, 0)'])
    expect(expanded.skillNameColors).toHaveLength(1)
    // Skill rows are laid out in even columns (two at this width, one on a
    // phone) — never a ragged mix of widths.
    expect(expanded.skillWidths.length).toBeGreaterThanOrEqual(1)
    expect(expanded.skillWidths.length).toBeLessThanOrEqual(2)

    await characterPanel.getByRole('button', { name: /Collapse/ }).click()

    // ---- Panel stat tokens are framed like the sheet's cost badges --------
    // A single thick left stripe was replaced by a hairline border on every
    // edge. Every token must stay the same height despite the added 1px edge.
    const tokens = await characterPanel.evaluate((panel) =>
      // The trailing "open sheet" control reuses .gm-token for placement; it
      // is not a stat token, so measure only the ones carrying a label.
      Array.from(panel.querySelectorAll('.gm-token')).filter((el) =>
        el.querySelector('.gm-token__label'),
      ).map((el) => {
        const cs = getComputedStyle(el)
        return {
          top: cs.borderTopWidth,
          right: cs.borderRightWidth,
          bottom: cs.borderBottomWidth,
          left: cs.borderLeftWidth,
          radius: cs.borderRadius,
          height: Math.round(el.getBoundingClientRect().height),
        }
      }),
    )
    expect(tokens.length).toBeGreaterThan(0)
    for (const token of tokens) {
      // Thin, and present on all four edges (not just the left).
      expect(token.top).toBe('1px')
      expect(token.right).toBe('1px')
      expect(token.bottom).toBe('1px')
      expect(token.left).toBe('1px')
      expect(token.radius).toBe('6px')
    }
    expect(new Set(tokens.map((t) => t.height)).size).toBe(1)

    // ---- The header controls and the Add Status button share one column -----
    // Two things had drifted here. (1) `.btn`'s text-button padding made the
    // expand/⋯ controls 49x35 with the ⋯ icon ~15px LEFT of the HP row's ⊕, and
    // the badge floated away from both. (2) After squaring them up, `.btn`'s
    // flex row only sets `align-items: center` — text buttons are centred by
    // their padding — so a `padding: 0` icon button left its icon hugging the
    // LEFT edge by ~4px, which is what made the ⋯ look crooked inside its own
    // hover pill. The assertions below therefore measure the ICON centres, not
    // the button boxes: box geometry alone passed while the icons were askew.
    const tidy = await characterPanel.evaluate((panel) => {
      const box = (sel: string) => {
        const b = (panel.querySelector(sel) as HTMLElement).getBoundingClientRect()
        return { left: b.left, right: b.right, w: b.width, h: b.height }
      }
      const icon = (sel: string) => {
        const node = panel.querySelector(sel) as HTMLElement
        const b = node.getBoundingClientRect()
        const s = (node.querySelector('svg') as SVGElement).getBoundingClientRect()
        return {
          box: { left: b.left, right: b.right, w: b.width, h: b.height },
          cx: s.left + s.width / 2,
          cy: s.top + s.height / 2,
          offX: s.left + s.width / 2 - (b.left + b.width / 2),
          offY: s.top + s.height / 2 - (b.top + b.height / 2),
        }
      }
      return {
        badge: box('.gm-panel__badge'),
        expand: icon('.gm-panel__density'),
        kebab: icon('.gm-panel__menu-btn'),
        add: icon('.gm-statuses__add'),
      }
    })
    // Every icon is centred in its own button — no left-hugging…
    for (const control of [tidy.expand, tidy.kebab, tidy.add]) {
      expect(Math.abs(control.offX)).toBeLessThan(0.5)
      expect(Math.abs(control.offY)).toBeLessThan(0.5)
    }
    // …the ⋯ and the ⊕ icons share one vertical line at the panel's right edge…
    expect(Math.abs(tidy.kebab.cx - tidy.add.cx)).toBeLessThan(1)
    expect(Math.abs(tidy.kebab.box.right - tidy.add.box.right)).toBeLessThan(1)
    // …the ⊕ sits right of the expand control, i.e. below the ⋯…
    expect(tidy.add.cx).toBeGreaterThan(tidy.expand.cx)
    // …the two header controls are the same compact square, pulled together…
    expect(Math.abs(tidy.expand.box.w - tidy.kebab.box.w)).toBeLessThan(0.5)
    expect(Math.abs(tidy.expand.box.h - tidy.kebab.box.h)).toBeLessThan(0.5)
    expect(tidy.kebab.box.left - tidy.expand.box.right).toBeLessThan(4)
    // …and the badge is grouped with them rather than floating away.
    expect(tidy.expand.box.left - tidy.badge.right).toBeLessThan(8)

    // ---- Expanding a panel animates rather than snapping -----------------
    // The body unmounts when collapsed, so the container transitions
    // `grid-template-rows: 0fr -> 1fr`; sample it mid-flight to prove the
    // height is genuinely interpolating.
    const npcPanel = page.locator('.gm-panel--npc').first()
    await npcPanel.getByRole('button', { name: /Expand/ }).click()
    const duringExpand = await npcPanel.evaluate((panel) => {
      const el = panel.querySelector('.gm-panel__expand') as HTMLElement | null
      return el ? el.getBoundingClientRect().height : -1
    })
    // Let it settle, then confirm the collapsed body is cleaned up.
    await expect
      .poll(async () =>
        npcPanel.evaluate((panel) => {
          const el = panel.querySelector('.gm-panel__expand') as HTMLElement | null
          return el ? +el.getBoundingClientRect().height.toFixed(0) : -1
        }),
      )
      .toBeGreaterThan(100)
    const settled = await npcPanel.evaluate((panel) => {
      const el = panel.querySelector('.gm-panel__expand') as HTMLElement
      return +el.getBoundingClientRect().height.toFixed(0)
    })
    // Mid-flight height is strictly between collapsed (0) and settled.
    expect(duringExpand).toBeLessThan(settled)

    await npcPanel.getByRole('button', { name: /Collapse/ }).click()
    await expect
      .poll(async () => page.locator('.gm-panel__expand').count())
      .toBe(0)

    // ---- Damage the first instance to 0 HP -------------------------------
    const first = await applyLethalDamage(page, 0)

    // The damaged instance is downed…
    await expect(first.getByText('Downed')).toBeVisible()
    await expect(
      first.getByRole('img', { name: '0 of 20 hit points' }),
    ).toBeVisible()

    // …and its sibling is completely unaffected.
    const second = page.locator('.gm-panel--npc').nth(1)
    await expect(second.getByText('Active')).toBeVisible()
    await expect(
      second.getByRole('img', { name: '20 of 20 hit points' }),
    ).toBeVisible()

    // ---- The save badge must never move the header ------------------------
    // `isSaving` toggles on EVERY debounced write, so an in-flow "saving…"
    // badge resized the title row and shoved the screen pills ~57px sideways
    // on every panel action — the "name flickers right" bug. Its slot
    // reserves the width permanently and only toggles `visibility`.
    // Probing triggers saves by dealing damage, so use the SECOND instance:
    // instance 0 must stay at 0 HP for the post-reload assertion, and its
    // sibling's HP is only asserted above (before this block).
    let prevHeader: string | null = null
    const headerOffsets = new Set<string>()
    for (let i = 0; i < 3; i++) {
      await page
        .locator('.gm-panel--npc')
        .nth(1)
        .getByRole('button', { name: /Deal 1 damage/ })
        .click()
      // Sample across the whole save cycle (badge on, then off).
      for (let tick = 0; tick < 6; tick++) {
        await page.waitForTimeout(60)
        const snapshot = await page.evaluate(() => {
          const row = document.querySelector('.gm-screen__title-row')!
          const switcher = document.querySelector('.gm-screen__switcher')!
          const badge = document.querySelector('.gm-screen__saving')!
          return [
            row.getBoundingClientRect().width.toFixed(1),
            switcher.getBoundingClientRect().left.toFixed(1),
            badge.getBoundingClientRect().width.toFixed(1),
          ].join('/')
        })
        headerOffsets.add(snapshot)
        prevHeader = snapshot
      }
    }
    expect(prevHeader).not.toBeNull()
    // Row width, switcher position and badge width are all invariant, whether
    // or not the badge is currently painted.
    expect([...headerOffsets]).toHaveLength(1)

    // The sibling's HP after probing (the probe itself deals damage) — the
    // reload below must reproduce exactly this value.
    const siblingHP = await page
      .locator('.gm-panel--npc')
      .nth(1)
      .locator('.gm-hp__value')
      .innerText()
    const siblingHPNumber = siblingHP.split('/')[0].trim()

    // And the reserved slot must not overlap the first screen pill.
    const badgeBox = await page.evaluate(() => {
      const badge = document.querySelector('.gm-screen__saving')!.getBoundingClientRect()
      const pill = document.querySelector('.gm-screen__screen-pill')!.getBoundingClientRect()
      return { badgeRight: badge.right, pillLeft: pill.left }
    })
    expect(badgeBox.badgeRight).toBeLessThanOrEqual(badgeBox.pillLeft)
    const names = page.locator('.gm-panel--npc .gm-panel__name')
    await expect(names.nth(0)).toHaveText('Bandit')
    await expect(names.nth(1)).toHaveText('Bandit 2')

    // The drag grip is the ONLY way to reorder a panel, so it must be visible
    // at rest. Its icon once computed to `width: 0px` inside this stretched
    // flex column (the svg's width attribute was ignored while its height
    // applied), leaving an invisible handle — assert real, non-zero geometry.
    const grip = page.locator('.gm-panel__drag').first()
    await expect(grip).toBeVisible()
    const gripBox = await grip.evaluate((el) => {
      const svg = el.querySelector('svg') as SVGElement | null
      const b = el.getBoundingClientRect()
      const s = svg?.getBoundingClientRect()
      return {
        hasIcon: !!svg,
        iconW: s?.width ?? 0,
        iconH: s?.height ?? 0,
        w: b.width,
        h: b.height,
        color: svg ? getComputedStyle(svg).color : '',
      }
    })
    expect(gripBox.hasIcon).toBe(true)
    expect(gripBox.iconW).toBeGreaterThanOrEqual(12)
    expect(gripBox.iconH).toBeGreaterThanOrEqual(12)
    // Touch-friendly target.
    expect(gripBox.w).toBeGreaterThanOrEqual(20)
    expect(gripBox.h).toBeGreaterThanOrEqual(20)
    // Painted with a legible color, not `transparent`/inherited-nothing.
    expect(gripBox.color).not.toBe('')

    // ---- Reload: everything persisted ------------------------------------
    // Autosave is debounced by 500ms; pause briefly like a real GM would
    // between finishing a damage step and reloading the page, so the write
    // has been committed. (Writes started *during* unload are cancelled by
    // the browser — see the note in gmScreenStore.ts.)
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)

    await expect(page.locator('.gm-panel--character')).toHaveCount(1)
    await expect(page.locator('.gm-panel--npc')).toHaveCount(2)
    // Two columns, not three — panels stay wide enough to read a full name.
    await expect(page.locator('.gm-screen__column')).toHaveCount(2)
    await expect(
      page.locator('.gm-panel--npc').nth(0).getByText('Downed'),
    ).toBeVisible()
    await expect(
      page
        .locator('.gm-panel--npc')
        .nth(1)
        .getByRole('img', { name: `${siblingHPNumber} of 20 hit points` }),
    ).toBeVisible()
  })

  test('a player panel and the character sheet share one source of truth', async ({
    page,
  }) => {
    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()

    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()

    const panel = page.locator('.gm-panel--character')
    await expect(panel).toHaveCount(1)
    // The default character is at full HP on the panel.
    await expect(panel.locator('.gm-hp__value')).toContainText('/')

    // Damage 6 from the GM screen…
    await panel.getByRole('button', { name: 'Damage…' }).click()
    await page.getByRole('spinbutton').fill('6')
    await page.getByLabel(/Apply Armor/).uncheck()
    await page.getByRole('button', { name: 'Apply Damage' }).click()
    await page.getByRole('button', { name: '✕' }).click()

    const panelHP = await panel.locator('.gm-hp__value').innerText()

    // …then open the player's own sheet: identical state, same record.
    await panel.getByRole('button', { name: /Open .* sheet/ }).click()
    await expect(page.locator('.character-sheet')).toBeVisible()

    // The sheet's HP readout shows the same current value as the panel did.
    // (The standalone sheet renders stats "flat" inside the hero, so the HP
    // row is a labelled button rather than a `.sheet-section--stats` bar.)
    const currentHP = panelHP.split('/')[0].trim()
    await expect(
      page.getByRole('button', { name: new RegExp(`^HP ${currentHP} / `) }),
    ).toBeVisible()
  })

  test('deleting a referenced NPC leaves a removable placeholder panel', async ({
    page,
  }) => {
    await gotoHome(page)
    await createNpc(page, 'Bandit')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page.locator('.gm-picker__list .gm-picker__item').filter({ hasText: 'Bandit' }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.locator('.gm-panel--npc')).toHaveCount(1)

    // Delete the NPC base from the NPC list — the confirm dialog warns first.
    await page.getByRole('button', { name: 'NPCs' }).first().click()
    await page.getByRole('button', { name: 'Delete Bandit' }).click()
    await expect(page.getByText(/Referenced on GM screen/)).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    // The panel survives as a placeholder with a Remove action.
    await gotoGmScreen(page)
    await expect(page.getByText(/Missing NPC/)).toBeVisible()
    await page.getByRole('button', { name: 'Remove panel' }).click()
    await expect(page.getByText(/Missing NPC/)).toHaveCount(0)
  })

  test('statuses are tracked per panel without growing it', async ({ page }) => {
    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')
    await createNpc(page, 'Bandit')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page.locator('.gm-picker__list .gm-picker__item').filter({ hasText: 'Bandit' }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    const npcPanel = page.locator('.gm-panel--npc')
    const pills = npcPanel.locator('.gm-status-pill')

    // ---- Apply one status through the picker -----------------------------
    await addStatus(page, npcPanel, 'Poisoned', 'Countdown')
    await expect(pills).toHaveCount(1)
    await expect(pills.first()).toContainText('Poisoned')
    // The duration is an icon only (the label would cost a third of the pill);
    // it is still named for assistive tech and carries the rules reminder.
    await expect(
      pills.first().getByRole('img', { name: 'Duration: Countdown' }),
    ).toBeVisible()
    await expect(
      pills.first().locator('.gm-status-pill__count'),
    ).toHaveText('1')

    // The name is never truncated, at any width: the strip scrolls instead.
    const namesFit = await npcPanel.locator('.gm-status-pill__name').evaluateAll(
      (nodes) =>
        nodes.map((name) => ({
          text: name.textContent,
          // No ellipsis rule may apply to a status name…
          truncated: getComputedStyle(name).textOverflow === 'ellipsis',
          // …and the box must be wide enough for the whole text (1px of
          // sub-pixel rounding tolerance).
          clipped: name.scrollWidth > name.clientWidth + 1,
        })),
    )
    expect(namesFit.map((n) => n.text)).toContain('Poisoned')
    expect(namesFit.every((n) => !n.truncated && !n.clipped)).toBe(true)

    // The pill sits on the HP row, vertically in line with the HP number —
    // "inline with the HP number", not on a row of its own.
    const inline = await npcPanel.evaluate((el) => {
      const value = el.querySelector('.gm-hp__value')!.getBoundingClientRect()
      const pill = el.querySelector('.gm-status-pill')!.getBoundingClientRect()
      return {
        sameRow: pill.top < value.bottom && pill.bottom > value.top,
        centreDelta: Math.abs(
          pill.top + pill.height / 2 - (value.top + value.height / 2),
        ),
      }
    })
    expect(inline.sameRow).toBe(true)
    expect(inline.centreDelta).toBeLessThan(4)

    const withOne = await stripMetrics(npcPanel)

    // ---- Add four more: the panel must not get taller --------------------
    for (const [name, duration] of [
      ['Blinded', 'Quick'],
      ['Prone', 'Permanent'],
      ['Hidden', 'Persistent'],
      ['Dazed', 'Conditional'],
    ] as const) {
      await addStatus(page, npcPanel, name, duration)
    }
    await expect(pills).toHaveCount(5)

    const withFive = await stripMetrics(npcPanel)
    // Same panel and row height with five statuses as with one: the strip
    // scrolls sideways instead of wrapping onto a second line.
    expect(withFive.panelHeight).toBe(withOne.panelHeight)
    expect(withFive.rowHeight).toBe(withOne.rowHeight)
    expect(withFive.scrollWidth).toBeGreaterThan(withFive.clientWidth)
    // All five pills share one centre line — no ragged second row.
    expect(new Set(withFive.pillCentres).size).toBe(1)
    expect(await npcPanel.locator('.gm-status-pill__name').allTextContents()).toEqual([
      'Poisoned',
      'Blinded',
      'Prone',
      'Hidden',
      'Dazed',
    ])

    // ---- Stacks increment, decrement, and remove explicitly --------------
    const poisonedPill = pills.first()
    await poisonedPill
      .getByRole('button', { name: 'Add a stack of Poisoned to Bandit' })
      .click()
    await poisonedPill
      .getByRole('button', { name: 'Add a stack of Poisoned to Bandit' })
      .click()
    await expect(poisonedPill.locator('.gm-status-pill__count')).toHaveText('3')
    await poisonedPill
      .getByRole('button', { name: 'Remove one stack of Poisoned from Bandit' })
      .click()
    await expect(poisonedPill.locator('.gm-status-pill__count')).toHaveText('2')

    // Statuses are per panel: the player panel is still clean.
    await expect(page.locator('.gm-panel--character .gm-status-pill')).toHaveCount(0)
    await addStatus(page, page.locator('.gm-panel--character'), 'Stunned', 'Quick')
    await expect(page.locator('.gm-panel--character .gm-status-pill')).toHaveCount(1)

    // ---- Phones: still one line, still no horizontal page overflow -------
    await page.setViewportSize({ width: 360, height: 720 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    // Switching 2 columns → 1 re-parents every panel (React mounts a fresh
    // column subtree), so a measurement taken right after the resize can land
    // on a node that has not been laid out yet and read all zeros — which is
    // exactly how this assertion used to flake. Capture the snapshot INSIDE the
    // poll and assert on that same snapshot: it is only accepted once the phone
    // layout is applied, the panel has a real box and the strip overflows. A
    // strip that never overflows still fails, on timeout.
    let narrow = await stripMetrics(npcPanel)
    await expect
      .poll(async () => {
        narrow = await stripMetrics(npcPanel)
        return (
          narrow.columns === 1 &&
          narrow.rowHeight > 0 &&
          narrow.clientWidth > 0 &&
          narrow.scrollWidth > narrow.clientWidth
        )
      })
      .toBe(true)
    expect(narrow.rowHeight).toBe(withFive.rowHeight)
    expect(narrow.scrollWidth).toBeGreaterThan(narrow.clientWidth)
    expect(new Set(narrow.pillCentres).size).toBe(1)
    await page.setViewportSize({ width: 1280, height: 900 })

    // ---- Reload: tracked statuses, durations, and stacks persist ---------
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)

    const reloaded = page.locator('.gm-panel--npc .gm-status-pill')
    await expect(reloaded).toHaveCount(5)
    await expect(reloaded.first()).toContainText('Poisoned')
    await expect(
      reloaded.first().getByRole('img', { name: 'Duration: Countdown' }),
    ).toBeVisible()
    await expect(reloaded.first().locator('.gm-status-pill__count')).toHaveText('2')
    await expect(
      page.locator('.gm-panel--character .gm-status-pill'),
    ).toHaveCount(1)
    await expect(page.locator('.gm-panel--character .gm-status-pill')).toContainText(
      'Stunned',
    )

    // ---- …and never leak onto the player's own sheet ---------------------
    await page
      .locator('.gm-panel--character')
      .getByRole('button', { name: /Open .* sheet/ })
      .click()
    await expect(page.locator('.character-sheet')).toBeVisible()
    await expect(page.locator('.gm-status-pill')).toHaveCount(0)
    await expect(page.locator('.gm-statuses')).toHaveCount(0)
  })

  test('the picker dialog scrolls its list from anywhere in the dialog', async ({
    page,
  }) => {
    // A short viewport guarantees the compendium list overflows its dialog.
    await page.setViewportSize({ width: 900, height: 620 })
    await gotoHome(page)
    await createNpc(page, 'Bandit')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page.locator('.gm-picker__list .gm-picker__item').filter({ hasText: 'Bandit' }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    const panel = page.locator('.gm-panel--npc')
    await panel.getByRole('button', { name: /^Add status to/ }).click()
    const dialog = page.locator('.gm-status-picker')
    await expect(dialog).toBeVisible()

    // The BODY is the scroller, not the dialog. `.gm-picker__body` used to be
    // sized by its content while still carrying `overflow-y: auto`, so it never
    // scrolled itself — and because it also sets `overscroll-behavior: none`,
    // it swallowed the wheel instead of chaining it to `.modal-content` (the
    // only element that could scroll). A wheel then did nothing except over the
    // dialog's own scrollbar strip.
    const scroller = dialog.locator('.gm-picker__body')
    expect(
      await scroller.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true)

    // Wheel over the MIDDLE of the dialog, nowhere near the scrollbar.
    const box = (await dialog.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 220)
    await expect
      .poll(() => scroller.evaluate((el) => Math.round(el.scrollTop)))
      .toBeGreaterThan(0)

    // …and the chrome stays put, so ✕ and Done are reachable at any offset.
    const dialogBox = (await dialog.boundingBox())!
    const headerBox = (await dialog.locator('.modal-header').boundingBox())!
    const footerBox = (await dialog.locator('.modal-footer').boundingBox())!
    expect(Math.abs(headerBox.y - dialogBox.y)).toBeLessThan(2)
    expect(
      Math.abs(footerBox.y + footerBox.height - (dialogBox.y + dialogBox.height)),
    ).toBeLessThan(2)

    // The whole compendium is reachable: the last row scrolls into view.
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect(
      dialog.getByText('Stunned', { exact: true }),
    ).toBeVisible()
  })

  test('a phone-width layout keeps panels on one column without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 720 })
    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')
    await createNpc(page, 'Bandit')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page.locator('.gm-picker__list .gm-picker__item').filter({ hasText: 'Bandit' }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    // One column, and nothing spills horizontally.
    const columnCount = await page.locator('.gm-screen__column').count()
    expect(columnCount).toBe(1)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    // A long instance name truncates rather than widening the panel.
    await expect(page.locator('.gm-panel__name').first()).toHaveCSS(
      'text-overflow',
      'ellipsis',
    )
  })
})
