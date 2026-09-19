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

/** The milestone badge in a player panel's header. */
function characterPanelBadge(page: Page) {
  return page.locator('.gm-panel--character .gm-panel__badge').first()
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

/**
 * Give a character milestones through the sheet's own Level Up flow, skipping
 * the wizard's choices each time, and come back to the GM Screen. Two
 * milestones grant a +1 Milestone Bonus, so 4 gives the "+2" the Milestones
 * token prints beside its label.
 */
async function addMilestones(page: Page, name: string, count: number) {
  await gotoGmScreen(page)
  const panel = page.locator('.gm-panel--character').filter({ hasText: name })
  await panel.getByRole('button', { name: new RegExp(`${name} options`) }).click()
  await page.getByRole('menuitem', { name: 'Open sheet' }).click()
  for (let i = 0; i < count; i += 1) {
    await page.getByRole('button', { name: 'Level Up' }).click()
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    // The wizard closes on Skip; wait for it to be gone before the next round.
    await expect(page.getByRole('button', { name: 'Skip', exact: true })).toHaveCount(0)
  }
  await gotoGmScreen(page)
  await expect(panel).toBeVisible()
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
  await page.locator('.damage-dialog input[type=number]').fill('999')
  await page.getByLabel(/Apply Armor/).uncheck()
  await page.getByRole('button', { name: 'Apply Damage' }).click()
  await page.getByRole('button', { name: '✕' }).click()
  return panel
}

/**
 * Apply a specific amount of damage to one panel with armor off, leaving the
 * dialog open so the caller can read its result grid before dismissing it.
 */
async function damageFor(page: Page, panel: Locator, amount: number) {
  await panel.getByRole('button', { name: 'Damage…' }).click()
  await page.locator('.damage-dialog input[type=number]').fill(String(amount))
  await page.getByLabel(/Apply Armor/).uncheck()
  await page.getByRole('button', { name: 'Apply Damage' }).click()
}

/**
 * What the eye actually sees: every ancestor's `opacity` multiplies down the
 * tree, so an element renders translucent even when its own opacity is 1 — a
 * dimmed panel fades everything mounted inside it. A selector matching nothing
 * returns null.
 */
async function effectiveOpacity(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    let node: Element | null = el
    let opacity = 1
    while (node) {
      opacity *= parseFloat(getComputedStyle(node).opacity)
      node = node.parentElement
    }
    return opacity
  }, selector)
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

/**
 * Record an element's height every animation frame for `ms`, resolving with the
 * samples. Started BEFORE the click that triggers the animation, because a
 * collapsing panel unmounts its body (recorded as -1) before the run ends.
 *
 * A single sample after the click is not enough to prove an animation is
 * running: right after the click the body is still at its start height whether
 * or not a transition exists, which is how a `transition` shorthand that
 * replaced the grid-row transition slipped through and snapped the panel open
 * and shut.
 */
function recordHeights(page: Page, selector: string, maxMs = 1200) {
  return page.evaluate(
    ([sel, cap]) =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = []
        const started = performance.now()
        let moved = false
        const tick = () => {
          const el = document.querySelector(sel)
          const height = el ? +el.getBoundingClientRect().height.toFixed(1) : -1
          if (samples.length > 0 && height !== samples[samples.length - 1]) {
            moved = true
          }
          samples.push(height)
          // Stop as soon as the run has moved and then held still for a few
          // frames — the animation is ~190ms, so this ends right after it
          // settles instead of burning the whole cap, and it starts sampling
          // before the click however long Playwright's actionability checks
          // take to fire it.
          const tail = samples.slice(-5)
          const settled =
            moved && tail.length === 5 && tail.every((h) => h === tail[0])
          if (!settled && performance.now() - started < cap) {
            requestAnimationFrame(tick)
          } else {
            resolve(samples)
          }
        }
        tick()
      }),
    [selector, maxMs] as const,
  )
}

/** Distinct heights a run passed through on its way between two sizes. */
function intermediateHeights(samples: number[], low: number, high: number) {
  return [...new Set(samples.filter((h) => h > low && h < high))]
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

    // Milestones 1-4 first: the 4th grants a +2 Milestone Bonus, so the row
    // below is measured WITH the inline bonus on one of its tokens rather than
    // on a fresh character that has none to show.
    await addMilestones(page, 'Vex', 4)
    await expect(characterPanelBadge(page)).toHaveText(/4/)

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

    // ---- Panel stat tokens: shorthand labels, one line, one height --------
    // Two things were wrong with the expanded panel's Combat Stats row. (1)
    // Token columns are ~7.5rem wide, so the full stat names ellipsised
    // ("MILEST…", "END RE…") — a GM mid-turn cannot read those. Panels print
    // shorthand now, and the full name rides in the `title`. (2) The Milestones
    // token's "+N bonus" line was a second in-flow line, so that token — and
    // therefore its whole grid row — stood taller than the row below it. The
    // bonus is now inline with the label ("Miles +2"), so a token is one line.
    const statTokens = await characterPanel.evaluate((panel) => {
      const sheet = panel.querySelector('.gm-panel__sheet')!
      return Array.from(sheet.querySelectorAll<HTMLElement>('.stat-token')).map(
        (el) => {
          const label = el.querySelector<HTMLElement>('.stat-token__label')!
          const box = el.getBoundingClientRect()
          const bonus = el.querySelector<HTMLElement>('.stat-token__bonus')
          const bonusBox = bonus?.getBoundingClientRect()
          const labelBox = label.getBoundingClientRect()
          return {
            label: label.textContent ?? '',
            title: el.getAttribute('title'),
            height: +box.height.toFixed(1),
            // Where the value's line and the label sit INSIDE the token, so the
            // row's shared reading line can be compared across tokens (absolute
            // page y would just compare row 1 against row 2).
            valueOffset: +(
              el.querySelector<HTMLElement>('.stat-token__value')!
                .getBoundingClientRect().top - box.top
            ).toFixed(2),
            labelOffset: +(labelBox.top - box.top).toFixed(2),
            // `overflow: hidden` makes the label's scrollWidth the text's real
            // width, so this is exactly "is any of this name cut off?".
            labelClipped: label.scrollWidth > label.clientWidth + 1,
            // The milestone bonus, inline with the label: same line (their
            // vertical centres agree) and to its right.
            bonus: bonus?.textContent ?? null,
            bonusOnLabelLine: bonusBox
              ? Math.abs(
                  bonusBox.top +
                    bonusBox.height / 2 -
                    (labelBox.top + labelBox.height / 2),
                ) < 3 && bonusBox.left > labelBox.left
              : null,
          }
        },
      )
    })

    expect(statTokens.map((t) => t.label)).toEqual([
      'Miles',
      'Eva',
      'Arm',
      'Move',
      'Save',
      'END Rec',
    ])
    // One height for the whole row — the milestone bonus included.
    expect(new Set(statTokens.map((t) => t.height)).size).toBe(1)
    // …and one line: the value and the label sit at the same offset inside every
    // token, so the bonus line cannot push its own token's value off the line
    // the rest of the row is read along.
    const spread = (values: number[]) =>
      Math.max(...values) - Math.min(...values)
    expect(spread(statTokens.map((t) => t.valueOffset))).toBeLessThan(1)
    expect(spread(statTokens.map((t) => t.labelOffset))).toBeLessThan(1)
    expect(statTokens.every((t) => !t.labelClipped)).toBe(true)
    // Short names are shorthand, never a loss: the full name stays reachable
    // and the milestone bonus stays printed.
    expect(statTokens.map((t) => t.title)).toEqual([
      'Milestones',
      'Evasion',
      'Armor',
      'Movement',
      'Save DC',
      'END Recovery',
    ])
    // The milestone bonus: bare ("+2", not "+2 bonus"), inline with the label,
    // and the ONLY token that carries one.
    const milestone = statTokens[0]
    expect(milestone.bonus).toBe('+2')
    expect(milestone.bonusOnLabelLine).toBe(true)
    expect(statTokens.slice(1).map((t) => t.bonus)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ])
    // One line, so the token is the height of a value line and its padding —
    // not the two-line block the reserved bonus line used to force.
    expect(statTokens[0].height).toBeLessThan(40)

    // The NPC panel's row is the same six-token grid and must read the same
    // way — its stats are the ones a GM cross-references against the player's.
    const npcBodyPanel = page.locator('.gm-panel--npc').first()
    await npcBodyPanel.getByRole('button', { name: /Expand/ }).click()
    await expect(npcBodyPanel.locator('.gm-panel__sheet')).toBeVisible()

    const npcStatTokens = await npcBodyPanel.evaluate((panel) => {
      const sheet = panel.querySelector('.gm-panel__sheet')!
      return Array.from(sheet.querySelectorAll<HTMLElement>('.stat-token')).map(
        (el) => {
          const box = el.getBoundingClientRect()
          return {
            label:
              el.querySelector<HTMLElement>('.stat-token__label')!.textContent ?? '',
            title: el.getAttribute('title'),
            height: +box.height.toFixed(1),
            valueOffset: +(
              el.querySelector<HTMLElement>('.stat-token__value')!
                .getBoundingClientRect().top - box.top
            ).toFixed(2),
          }
        },
      )
    })

    expect(npcStatTokens.map((t) => t.label)).toEqual([
      'Eva',
      'Arm',
      'Move',
      'Save',
      'HP',
      'Wounds',
    ])
    expect(new Set(npcStatTokens.map((t) => t.height)).size).toBe(1)
    // One size for both panel kinds: a token is one line of stat everywhere, so
    // a player panel and an NPC panel side by side are the same grid.
    expect(npcStatTokens[0].height).toBe(statTokens[0].height)
    // …and the value sits at the same offset inside it, so the two panel kinds
    // also read along one line.
    expect(
      new Set([
        ...statTokens.map((t) => t.valueOffset),
        ...npcStatTokens.map((t) => t.valueOffset),
      ]).size,
    ).toBe(1)
    expect(npcStatTokens.map((t) => t.title)).toEqual([
      'Evasion',
      'Armor',
      'Movement',
      'Save DC',
      null, // "HP" is already the shorthand — nothing to expand.
      'Mortal Wounds',
    ])

    // Both panels go back to collapsed, which is where the rest of the run
    // (and the expand-animation checks below) expect to find them — the latter
    // measures the panel bodies by frame, so it must start from no body at all.
    await characterPanel.getByRole('button', { name: /Collapse/ }).click()
    await npcBodyPanel.getByRole('button', { name: /Collapse/ }).click()
    await expect.poll(async () => page.locator('.gm-panel__expand').count()).toBe(0)

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
    // `grid-template-rows: 0fr -> 1fr`. Record every frame across the whole
    // animation and require the height to pass through real intermediate sizes
    // in BOTH directions — a snap has no frames in between.
    const npcPanel = page.locator('.gm-panel--npc').first()
    const expandSelector = '.gm-panel--npc .gm-panel__expand'
    const opening = recordHeights(page, expandSelector)
    await npcPanel.getByRole('button', { name: /Expand/ }).click()
    const openingHeights = await opening
    await expect
      .poll(async () => page.locator(expandSelector).count())
      .toBe(1)
    const settled = await npcPanel.evaluate((panel) => {
      const el = panel.querySelector('.gm-panel__expand') as HTMLElement
      return +el.getBoundingClientRect().height.toFixed(0)
    })
    expect(settled).toBeGreaterThan(100)
    // Opening climbs through at least a handful of distinct in-between heights.
    expect(intermediateHeights(openingHeights, 0, settled).length).toBeGreaterThan(2)

    // Closing animates too (this is the direction that regressed): the height
    // eases back down before the body is unmounted.
    const closing = recordHeights(page, expandSelector)
    await npcPanel.getByRole('button', { name: /Collapse/ }).click()
    const closingHeights = await closing
    expect(intermediateHeights(closingHeights, 0, settled).length).toBeGreaterThan(2)
    // …and the body really is gone once it has finished. (Scoped to the NPC
    // panel kind: a character panel body stays mounted too once its own
    // animation has run, so an unscoped count would see that one.)
    await expect
      .poll(async () => page.locator('.gm-panel--npc .gm-panel__expand').count())
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
      .locator('.gm-hp .gm-bar__value')
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

  test('an NPC instance rolls Mortal Wounds and goes down when they run out', async ({
    page,
  }) => {
    // A deterministic Mortal Wounds die: every D20 in this test rolls 19
    // ("Damaged Lung" on the table), so the panel's chips can be asserted by
    // name and number. Armor is switched off on every hit below, so this is the
    // only roll the pinned die feeds.
    await page.addInitScript(() => {
      Math.random = () => 0.9
    })

    await gotoHome(page)
    await createNpc(page, 'Revenant')

    // ---- The allowance is the base's own Mortal Wounds stat ----------------
    await page.locator('.card-main').filter({ hasText: 'Revenant' }).first().click()
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'Edit' })
      .click()
    const mortalStat = page
      .locator('.stat-token')
      .filter({ hasText: 'Mortal Wounds' })
    await mortalStat.locator('input').fill('2')
    await expect(mortalStat.locator('input')).toHaveValue('2')

    // ---- Spawn an instance of it on a fresh screen -------------------------
    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByLabel('Screen name').fill('Wounds')
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page
      .locator('.gm-picker__list .gm-picker__item')
      .filter({ hasText: 'Revenant' })
      .click()
    await page.getByRole('button', { name: 'Done' }).click()

    const panel = page.locator('.gm-panel--npc').first()
    // The track exists (the base allows two) and starts empty.
    await expect(panel.locator('.gm-mw')).toContainText('Wounds')
    await expect(panel.locator('.gm-mw')).toContainText('0/2')
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(0)

    // ---- 25 damage on 20 HP: one wound, HP refilled, 5 spilled over --------
    await damageFor(page, panel, 25)
    await expect(page.locator('.damage-result__alert')).toContainText(
      'Damaged Lung (d20 19)',
    )
    await page.getByRole('button', { name: '✕' }).click()

    await expect(panel.locator('.gm-mw__chip')).toHaveText(/19\s*Damaged Lung/)
    await expect(
      panel.getByRole('img', { name: '15 of 20 hit points' }),
    ).toBeVisible()
    await expect(panel.getByText('Active')).toBeVisible()
    await expect(panel.locator('.gm-mw__warn')).toHaveCount(0)

    // ---- The second wound fills the track, so the panel warns --------------
    await damageFor(page, panel, 25)
    await page.getByRole('button', { name: '✕' }).click()
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(2)
    await expect(panel.locator('.gm-mw__warn')).toContainText('Next 0 HP: Downed')
    await expect(
      panel.getByRole('img', { name: '10 of 20 hit points' }),
    ).toBeVisible()

    // ---- Phone width: the row is ONE line and never overflows --------------
    // This is the widest state the row can be in — two chips plus the warning
    // pill — so it is the one worth measuring at 360px. The row scrolls
    // sideways (like the status strip) instead of wrapping or widening the
    // panel, and every element in it shares one centre line.
    const desktopViewport = page.viewportSize()!
    await page.setViewportSize({ width: 360, height: 800 })
    const narrow = await panel.evaluate((el) => {
      const row = el.querySelector('.gm-mw') as HTMLElement
      const strip = el.querySelector('.gm-mw__strip') as HTMLElement
      const rowBox = row.getBoundingClientRect()
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        rowCentre: +(rowBox.top + rowBox.height / 2).toFixed(1),
        rowHeight: +rowBox.height.toFixed(1),
        centres: Array.from(el.querySelectorAll('.gm-mw__chip')).map((chip) => {
          const box = chip.getBoundingClientRect()
          return +(box.top + box.height / 2).toFixed(1)
        }),
        stripScrolls: strip.scrollWidth > strip.clientWidth,
      }
    })
    expect(narrow.overflow).toBeLessThanOrEqual(0)
    expect(narrow.rowHeight).toBeLessThan(30)
    expect(narrow.centres).toHaveLength(2)
    for (const centre of narrow.centres) {
      expect(Math.abs(centre - narrow.rowCentre)).toBeLessThanOrEqual(2)
    }
    expect(narrow.stripScrolls).toBe(true)
    await page.setViewportSize(desktopViewport)

    // ---- With no wound left to take, 0 HP downs the instance ---------------
    await damageFor(page, panel, 25)
    await page.getByRole('button', { name: '✕' }).click()
    // The condition badge specifically — the wound row's warning pill also
    // carries the word "Downed".
    await expect(panel.locator('.gm-panel__badge--downed')).toHaveText('Downed')
    await expect(panel.getByRole('img', { name: '0 of 20 hit points' })).toBeVisible()
    // No third wound: the track stays at two while it goes down.
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(2)

    // Clearing a wound is per chip, and it survives a reload (the track lives
    // on the panel record).
    await panel.getByRole('button', { name: /^Clear Damaged Lung/ }).first().click()
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(1)
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)
    const reloaded = page.locator('.gm-panel--npc').first()
    await expect(reloaded.locator('.gm-mw__chip')).toHaveCount(1)
    await expect(reloaded.locator('.gm-mw')).toContainText('1/2')
  })

  test('a player panel carries the same Mortal Wound track as an NPC panel', async ({
    page,
  }) => {
    // The same deterministic die the NPC test uses: every D20 rolls 19
    // ("Damaged Lung"), and armor is switched off on every hit below, so the
    // pinned die only ever feeds the Mortal Wound roll.
    await page.addInitScript(() => {
      Math.random = () => 0.9
    })

    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByLabel('Screen name').fill('Wounds')
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()

    // A character always allows two Mortal Wounds, so the track is there from
    // the start — the same row an NPC whose base allows wounds renders.
    const panel = page.locator('.gm-panel--character').first()
    await expect(panel.locator('.gm-mw')).toContainText('Wounds')
    await expect(panel.locator('.gm-mw')).toContainText('0/2')
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(0)

    // ---- 25 damage on 20 HP: the GM gets the roll, not a "Pending Roll" ----
    await damageFor(page, panel, 25)
    await expect(page.locator('.damage-result__alert')).toContainText(
      'Damaged Lung (d20 19)',
    )
    await page.getByRole('button', { name: '✕' }).click()

    await expect(panel.locator('.gm-mw__chip')).toHaveText(/19\s*Damaged Lung/)
    await expect(
      panel.getByRole('img', { name: '15 of 20 hit points' }),
    ).toBeVisible()
    await expect(panel.locator('.gm-mw__warn')).toHaveCount(0)

    // The wound is the character's own record, not a panel copy: their sheet
    // shows the very same wound, with no roll left to make.
    await panel.getByRole('button', { name: /Vex options/ }).click()
    await page.getByRole('menuitem', { name: 'Open sheet' }).click()
    await expect(page.locator('.mw-card__name')).toHaveText('Damaged Lung')
    await expect(
      page.getByRole('button', { name: 'Roll Mortal Wound (d20)' }),
    ).toHaveCount(0)

    // ---- A wound the SHEET deals stays pending: that roll is the player's ---
    // The sheet's own HP block opens the same Damage dialog without the panel's
    // auto-roll, so the slot lands on "Pending Roll" with the card's button.
    await page.locator('.resource-bar__head--clickable').click()
    await page.locator('.damage-dialog input[type=number]').fill('15')
    await page.getByLabel(/Apply Armor/).uncheck()
    await page.getByRole('button', { name: 'Apply Damage' }).click()
    await page.getByRole('button', { name: '✕' }).click()
    await expect(page.locator('.mw-card--pending')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Roll Mortal Wound (d20)' }),
    ).toBeVisible()
    await gotoGmScreen(page)

    // The panel shows that unresolved slot as pending — the ⋯ menu carries the
    // roll for it, so the row itself keeps the NPC row's shape — and the track
    // is now full, so it carries the character's own warning.
    await expect(panel.locator('.gm-mw__chip--pending')).toHaveCount(1)
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(2)
    await expect(panel.locator('.gm-mw__warn')).toContainText(
      'Next 0 HP: Knocked Out',
    )

    // ---- Phone width: the row is ONE line and never overflows --------------
    // Measured with a full track and a pending chip — the row's widest state on
    // a player panel — so the character's longer outcome word cannot quietly
    // push it past the panel's edge.
    const desktopViewport = page.viewportSize()!
    await page.setViewportSize({ width: 360, height: 800 })
    const narrow = await panel.evaluate((el) => {
      const row = el.querySelector('.gm-mw') as HTMLElement
      const strip = el.querySelector('.gm-mw__strip') as HTMLElement
      const rowBox = row.getBoundingClientRect()
      // The row's one-line rule, measured where it can actually break: every
      // chip and the ⚠ pill must share the row's centre line…
      const items = Array.from(el.querySelectorAll('.gm-mw__chip, .gm-mw__warn'))
      // …and the row's own box must hold its non-scrolling children (the chips
      // live in the strip, which is a scroll container by design).
      const fixed = Array.from(row.children).filter((child) => child !== strip)
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        rowCentre: +(rowBox.top + rowBox.height / 2).toFixed(1),
        rowHeight: +rowBox.height.toFixed(1),
        centres: items.map((item) => {
          const box = item.getBoundingClientRect()
          return +(box.top + box.height / 2).toFixed(1)
        }),
        spill: [...fixed, strip].filter(
          (item) => item.getBoundingClientRect().right > rowBox.right + 1,
        ).length,
        stripScrolls: strip.scrollWidth > strip.clientWidth,
      }
    })
    expect(narrow.overflow).toBeLessThanOrEqual(0)
    expect(narrow.rowHeight).toBeLessThan(30)
    expect(narrow.centres).toHaveLength(3)
    for (const centre of narrow.centres) {
      expect(Math.abs(centre - narrow.rowCentre)).toBeLessThanOrEqual(2)
    }
    expect(narrow.spill).toBe(0)
    expect(narrow.stripScrolls).toBe(true)
    await page.setViewportSize(desktopViewport)

    // ---- The GM resolves the pending wound from the panel ------------------
    await panel.getByRole('button', { name: /Vex options/ }).click()
    await page.getByRole('menuitem', { name: 'Roll Mortal Wound (d20)' }).click()
    await expect(panel.locator('.gm-mw__chip--pending')).toHaveCount(0)
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(2)
    // The roll is announced like any other wound (the earlier chip's toast may
    // still be on screen, so assert the newest one).
    await expect(
      page
        .locator('.notification--error')
        .filter({ hasText: 'Vex takes a Mortal Wound: Damaged Lung (d20 19).' })
        .last(),
    ).toBeVisible()

    // ---- With no wound left, 0 HP knocks the character out -----------------
    await damageFor(page, panel, 25)
    await page.getByRole('button', { name: '✕' }).click()
    await expect(panel.getByRole('img', { name: '0 of 20 hit points' })).toBeVisible()
    await expect(
      page.locator('.notification--error').filter({ hasText: 'KNOCKED OUT' }),
    ).toBeVisible()
    // No third wound: the track stays at two while the character goes down.
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(2)

    // Clearing a wound is per chip and lands on the character record, so it
    // outlives a reload (and the sheet) exactly as an instance's track does.
    await panel.getByRole('button', { name: /^Clear Damaged Lung/ }).first().click()
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(1)
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)
    const reloaded = page.locator('.gm-panel--character').first()
    await expect(reloaded.locator('.gm-mw__chip')).toHaveCount(1)
    await expect(reloaded.locator('.gm-mw')).toContainText('1/2')
  })

  test('a specific Mortal Wound can be recorded by hand, with no D20', async ({
    page,
  }) => {
    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')
    await createNpc(page, 'Revenant')

    // The NPC needs an allowance before a panel can carry a wound at all — the
    // base's own Mortal Wounds stat, exactly as the automatic roll reads it.
    await page.locator('.card-main').filter({ hasText: 'Revenant' }).first().click()
    await page.locator('.mode-toggle--floating').getByRole('tab', { name: 'Edit' }).click()
    const mortalStat = page.locator('.stat-token').filter({ hasText: 'Mortal Wounds' })
    await mortalStat.locator('input').fill('2')

    // ---- On the sheet: the track is there before the first wound -----------
    await gotoCharacters(page)
    await page.locator('.card-main').filter({ hasText: 'Vex' }).first().click()
    await expect(page.locator('.stat-mortals')).toBeVisible()
    // An untouched track reads as a counter beside the header — not as two
    // empty slot boxes.
    await expect(page.locator('.mw-head__count')).toHaveText('0 / 2')
    await expect(page.locator('.mortal-wound-slot')).toHaveCount(0)
    await page.getByRole('button', { name: /Add Mortal Wound/ }).click()

    const sheetPicker = page.getByRole('dialog', { name: 'Add Mortal Wound to Vex' })
    await expect(sheetPicker).toBeVisible()

    // ---- Phone width: the dialog fits the viewport -------------------------
    const desktopViewport = page.viewportSize()!
    await page.setViewportSize({ width: 360, height: 800 })
    const narrow = await page.evaluate(() => {
      const box = (document.querySelector('.mw-picker') as HTMLElement).getBoundingClientRect()
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        insideViewport: box.left >= 0 && box.right <= window.innerWidth + 1,
      }
    })
    expect(narrow.overflow).toBeLessThanOrEqual(0)
    expect(narrow.insideViewport).toBe(true)
    await page.setViewportSize(desktopViewport)

    // The list is the table: search narrows it, picking applies the entry.
    await sheetPicker
      .getByRole('searchbox', { name: 'Search Mortal Wounds' })
      .fill('throat')
    await sheetPicker.getByRole('button', { name: 'Add Damaged Throat' }).click()

    // A picked wound is an ordinary wound card: entry's D20, name, rules text.
    await expect(page.locator('.mw-card__name')).toHaveText('Damaged Throat')
    await expect(page.locator('.mw-card__roll')).toHaveText('8')
    await expect(page.locator('.mw-card__desc')).toContainText('Unable to regain END')
    await expect(page.locator('.mw-head__count')).toHaveText('1 / 2')
    await expect(
      page
        .locator('.notification--error')
        .filter({ hasText: 'Mortal Wound added: Damaged Throat (d20 8).' }),
    ).toBeVisible()

    // ---- Both manual actions sit on one row, sized like buttons ------------
    // They used to be `width: 100%` bars stacked down the Combat Stats block,
    // which read as form fields rather than actions.
    const woundActions = await page.evaluate(() => {
      const section = document.querySelector('.stat-block--flat') as HTMLElement
      const boxes = Array.from(
        document.querySelectorAll('.mw-actions .sheet-action-btn'),
      ).map((button) => {
        const rect = button.getBoundingClientRect()
        return {
          text: (button.textContent ?? '').trim(),
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          icons: button.querySelectorAll('svg').length,
        }
      })
      return { sectionWidth: section.getBoundingClientRect().width, boxes }
    })
    expect(woundActions.boxes.map((b) => b.text)).toEqual([
      'Add Mortal Wound…',
      'Rest (Full Restore)',
    ])
    // One row, one size, an icon each.
    expect(new Set(woundActions.boxes.map((b) => b.top)).size).toBe(1)
    expect(new Set(woundActions.boxes.map((b) => b.height)).size).toBe(1)
    expect(woundActions.boxes.map((b) => b.icons)).toEqual([1, 1])
    // …and neither one spans the section.
    for (const box of woundActions.boxes) {
      expect(box.width).toBeLessThan(woundActions.sectionWidth * 0.6)
    }

    // The picker stays open for a second wound; the rail is behind a modal, so
    // dismiss it before navigating away.
    await page.getByRole('button', { name: 'Done' }).click()

    // ---- A player panel writes the character's real slots ------------------
    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByLabel('Screen name').fill('Hand-picked')
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page
      .locator('.gm-picker__list .gm-picker__item')
      .filter({ hasText: 'Revenant' })
      .click()
    await page.getByRole('button', { name: 'Done' }).click()

    const pcPanel = page.locator('.gm-panel--character').first()
    await expect(pcPanel.locator('.gm-mw__chip')).toHaveText(/8\s*Damaged Throat/)

    // The second slot, filled from the panel's own menu — still no roll.
    await pcPanel.getByRole('button', { name: /Vex options/ }).click()
    await page.getByRole('menuitem', { name: 'Add mortal wound…' }).click()
    await page.getByRole('button', { name: 'Add Exhaustion' }).click()
    await expect(pcPanel.locator('.gm-mw__chip')).toHaveCount(2)
    await expect(pcPanel.locator('.gm-mw__warn')).toContainText(
      'Next 0 HP: Knocked Out',
    )
    await page.getByRole('button', { name: 'Done' }).click()

    // A full track has nothing left to add: the menu entry is gone, so there is
    // no click that could only fail.
    await pcPanel.getByRole('button', { name: /Vex options/ }).click()
    await expect(
      page.getByRole('menuitem', { name: 'Add mortal wound…' }),
    ).toHaveCount(0)
    await page.keyboard.press('Escape')

    // ---- An NPC instance keeps its own track, and its own allowance --------
    const npcPanel = page.locator('.gm-panel--npc').first()
    await npcPanel.getByRole('button', { name: /Revenant options/ }).click()
    await page.getByRole('menuitem', { name: 'Add mortal wound…' }).click()
    await page.getByRole('button', { name: 'Add Fracture' }).click()
    await expect(npcPanel.locator('.gm-mw__chip')).toHaveText(/14\s*Fracture/)
    await page.getByRole('button', { name: 'Done' }).click()

    // ---- Both tracks survive a reload --------------------------------------
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)
    await expect(
      page.locator('.gm-panel--character').first().locator('.gm-mw__chip'),
    ).toHaveCount(2)
    await expect(
      page.locator('.gm-panel--npc').first().locator('.gm-mw__chip'),
    ).toHaveText(/14\s*Fracture/)
  })

  test('the sheet announces a knock-out only when the character is knocked out', async ({
    page,
  }) => {
    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')
    // `createPlayerCharacter` returns to the list; this walk is on the sheet.
    await page.locator('.card-main').filter({ hasText: 'Vex' }).first().click()
    await expect(page.locator('.stat-block--flat')).toBeVisible()

    // The sheet's own damage dialog, applied and dismissed (VIT 0 → 20 max HP).
    const sheetDamage = async (amount: number) => {
      await page.locator('.resource-bar__head--clickable').first().click()
      await page.locator('.damage-dialog input[type=number]').fill(String(amount))
      await page.getByRole('button', { name: 'Apply Damage' }).click()
      await page.locator('.damage-dialog .modal-close').click()
    }
    // Toasts linger for seconds: a negative assertion has to name the sentence
    // it is looking for, not just the toast class ("Critical Condition!" also
    // mentions being Knocked Out, in other words).
    const knockOutToast = page
      .locator('.notification')
      .filter({ hasText: 'Character knocked out!' })

    // ---- 20 HP → 15: the first wound, no knock-out ------------------------
    await sheetDamage(25)
    await expect(page.locator('.mw-head__count')).toHaveText('1 / 2')
    await page.getByRole('button', { name: 'Roll Mortal Wound (d20)' }).click()
    await expect(page.locator('.mw-card__name')).toHaveCount(1)
    await expect(knockOutToast).toHaveCount(0)

    // ---- 15 HP → 10: the *second* wound. The track is full, the character
    // is standing: this is the Critical Condition, one 0 HP away from the
    // knock-out — and it used to announce the knock-out itself.
    await sheetDamage(25)
    await expect(page.locator('.mw-head__count')).toHaveText('2 / 2')
    await expect(page.locator('.mw-warn')).toBeVisible()
    await expect(knockOutToast).toHaveCount(0)

    await page.getByRole('button', { name: 'Roll Mortal Wound (d20)' }).click()
    await expect(page.locator('.mw-card__name')).toHaveCount(2)
    await expect(
      page
        .locator('.notification')
        .filter({ hasText: 'Critical Condition!' })
        .last(),
    ).toBeVisible()
    await expect(knockOutToast).toHaveCount(0)

    // ---- 10 HP → 1: a plain hit, no wound and no knock-out ----------------
    await sheetDamage(9)
    await expect(page.locator('.mw-head__count')).toHaveText('2 / 2')
    await expect(knockOutToast).toHaveCount(0)

    // ---- 1 HP → 0 with no wound left: *now* it is a knock-out -------------
    // The sheet's own `−` stepper runs the same damage pipeline. No third wound
    // exists to pay for the 0 HP, so the character is Knocked Out, Death Saves
    // begin, and the track is untouched by it (still the two cards it had).
    await page.locator('.notification').first().waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Spend HP' }).click()
    await expect(knockOutToast.last()).toBeVisible()
    // The Death Saves block is on screen (the toast says the same words, so
    // count the tracker itself, not the phrase).
    await expect(
      page.getByRole('button', { name: 'Roll Death Save (d20)' }),
    ).toBeVisible()
    await expect(page.locator('.mw-card__name')).toHaveCount(2)
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
    await expect(panel.locator('.gm-hp .gm-bar__value')).toContainText('/')

    // Damage 6 from the GM screen…
    await panel.getByRole('button', { name: 'Damage…' }).click()
    await page.locator('.damage-dialog input[type=number]').fill('6')
    await page.getByLabel(/Apply Armor/).uncheck()
    await page.getByRole('button', { name: 'Apply Damage' }).click()
    await page.getByRole('button', { name: '✕' }).click()

    const panelHP = await panel.locator('.gm-hp .gm-bar__value').innerText()

    // The panel carries the character's own AP directly under the HP bar, the
    // same meter an NPC instance panel shows…
    const panelAP = panel.locator('.gm-ap .gm-bar__value')
    const hpBlock = panel.locator('.gm-hp')
    await expect(panelAP).toContainText('3')
    for (let i = 0; i < 3; i += 1) {
      await panel.getByRole('button', { name: 'Spend Action Points' }).click()
    }
    await expect(panelAP).toContainText('0')

    // Out of AP the panel dims — but stays fully interactive, and its AP block
    // does not dim: that is where both ways back live.
    await expect(panel).toHaveClass(/gm-panel--no-ap/)
    await expect(hpBlock).toHaveCSS('opacity', '0.55')
    await expect(panel.locator('.gm-ap')).toHaveCSS('opacity', '1')
    await expect(panel.getByRole('button', { name: 'Start new turn' })).toBeEnabled()
    await expect(panel.getByRole('button', { name: /Deal 1 damage/ })).toBeEnabled()

    // Handing AP back by hand restores the panel…
    await panel.getByRole('button', { name: 'Restore Action Points' }).click()
    await expect(hpBlock).toHaveCSS('opacity', '1')
    await panel.getByRole('button', { name: 'Spend Action Points' }).click()
    await expect(hpBlock).toHaveCSS('opacity', '0.55')

    // A menu spawned from the dimmed panel is NOT dimmed: it portals to
    // `document.body`, so the panel's 0.55 cannot multiply into it.
    await panel.getByRole('button', { name: 'Vex options' }).click()
    const panelMenu = page.locator('.gm-panel__menu')
    await expect(panelMenu).toBeVisible()
    expect(await effectiveOpacity(page, '.gm-panel__menu')).toBe(1)
    await page.keyboard.press('Escape')
    await expect(panelMenu).toHaveCount(0)

    // …and so does the turn button, which is the sheet's End Turn: AP is
    // refilled on the same record the player owns.
    await panel.getByRole('button', { name: 'Start new turn' }).click()
    await expect(panelAP).toContainText('3')
    await expect(hpBlock).toHaveCSS('opacity', '1')

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
    // The AP the panel refilled is the AP the sheet shows.
    await expect(
      page
        .locator('.resource-bar')
        .filter({ hasText: 'Action Points' })
        .locator('.resource-bar__value'),
    ).toContainText('3')
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
      const value = el.querySelector('.gm-hp .gm-bar__value')!.getBoundingClientRect()
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

    // ---- The pill is the status's reference (sheet parity) ----------------
    // Hovering its name shows the same card a sheet's inline `[StatusName]`
    // reference shows. The card is portalled out of the pill — which clips its
    // own contents — and out of the sideways-scrolling strip, so the WHOLE card
    // is readable; a card rendered in place would be a clipped sliver.
    const rowBefore = (await stripMetrics(npcPanel)).rowHeight
    await poisonedPill.getByRole('button', { name: 'Poisoned', exact: true }).hover()
    const statusCard = page.getByRole('tooltip')
    await expect(statusCard).toBeVisible()
    await expect(statusCard).toContainText('Poisoned')
    const cardBox = (await statusCard.boundingBox())!
    expect(cardBox.x).toBeGreaterThanOrEqual(0)
    expect(cardBox.y).toBeGreaterThanOrEqual(0)
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(1280)
    expect(cardBox.width).toBeGreaterThan(200)
    // Opening the card changes nothing about the pill: still one line, and the
    // row is exactly as tall as it was.
    expect((await stripMetrics(npcPanel)).rowHeight).toBe(rowBefore)

    // Clicking the name opens the condition's description — the same global
    // modal a sheet's inline reference opens, showing the full Markdown text.
    await poisonedPill.getByRole('button', { name: 'Poisoned', exact: true }).click()
    const statusDialog = page.locator('.status-modal')
    await expect(statusDialog).toBeVisible()
    await expect(statusDialog).toContainText('Poisoned characters take 1d6+POW damage')
    await statusDialog.locator('.modal-close').click()
    await expect(statusDialog).toHaveCount(0)

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

  test('a mouse wheel scrolls a panel strip sideways, not just a trackpad swipe', async ({
    page,
  }) => {
    // Both strips hide their scrollbar and are ONE line that scrolls sideways,
    // so a trackpad's two-finger swipe (deltaX) used to be the only way to move
    // them: a mouse wheel reports deltaY, which an `overflow-x` container never
    // consumes, so the wheel chained straight past the strip to the page. This
    // drives a real wheel over both strips and measures them.
    //
    // A deterministic die, as in the Mortal Wound tests: every D20 rolls 19, so
    // the wound chips are identical and the strip's width is predictable.
    await page.addInitScript(() => {
      Math.random = () => 0.9
    })

    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')
    await createNpc(page, 'Bandit')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()

    const panel = page.locator('.gm-panel--character').first()

    // Five tracked statuses overflow the status strip…
    for (const [name, duration] of [
      ['Poisoned', 'Countdown'],
      ['Blinded', 'Quick'],
      ['Prone', 'Permanent'],
      ['Hidden', 'Persistent'],
      ['Dazed', 'Conditional'],
    ] as const) {
      await addStatus(page, panel, name, duration)
    }
    // …and a full wound track (two d20-and-name chips, plus the ⚠ pill that
    // takes the row's right edge) overflows the Mortal Wound strip.
    await damageFor(page, panel, 25)
    await page.getByRole('button', { name: '✕' }).click()
    await damageFor(page, panel, 25)
    await page.getByRole('button', { name: '✕' }).click()
    await expect(panel.locator('.gm-status-pill')).toHaveCount(5)
    await expect(panel.locator('.gm-mw__chip')).toHaveCount(2)
    await expect(panel.locator('.gm-mw__warn')).toContainText('Knocked Out')
    // Let the damage toasts clear: they stack up from the bottom-left (each
    // auto-dismisses after 3s) and this test is about what the pointer hits.
    await expect(page.locator('.notification')).toHaveCount(0, { timeout: 15_000 })

    // A phone-width viewport is where both strips genuinely overflow, and a few
    // more panels make the PAGE taller than the viewport — which is what lets
    // "the strip let go at its edge" be observed instead of being a no-op.
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    const npcRow = page.locator('.gm-picker__list .gm-picker__item').filter({
      hasText: 'Bandit',
    })
    for (let i = 0; i < 4; i += 1) await npcRow.click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.locator('.gm-panel--npc')).toHaveCount(4)
    await page.setViewportSize({ width: 360, height: 800 })
    // The page itself has to be taller than the viewport, or "the wheel goes on
    // to the page" cannot be told apart from "nothing happened".
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      ),
    ).toBeGreaterThan(0)

    for (const selector of ['.gm-statuses__strip', '.gm-mw__strip']) {
      const strip = panel.locator(selector)
      await strip.scrollIntoViewIfNeeded()

      // The premise: at this width the strip really does overflow, and it
      // starts at the left edge. (Set explicitly rather than assumed — the
      // status strip scrolls itself to the end when a pill is added, so the GM
      // sees what they just tracked.)
      await strip.evaluate((el) => {
        el.scrollLeft = 0
      })
      const max = await strip.evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(max).toBeGreaterThan(0)

      // Park the pointer on the strip. Positioned by coordinates and not with
      // `hover()`, which scrolls the strip back for its actionability check and
      // would undo the edge the test is about to measure.
      const point = await strip.evaluate((el) => {
        const box = el.getBoundingClientRect()
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      })
      await page.mouse.move(point.x, point.y)

      // A sideways gesture (a trackpad swipe) still scrolls the strip natively
      // — the hook deliberately leaves deltaX alone — and back to the start.
      await page.mouse.wheel(60, 0)
      await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
      await page.mouse.wheel(-600, 0)
      await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBe(0)

      // The actual regression: a mouse-wheel notch moves the strip sideways —
      // the gesture a trackpad's swipe is NOT, and the one that used to chain
      // straight past the strip and leave it stuck at 0.
      const pageY = await page.evaluate(() => window.scrollY)
      await page.mouse.wheel(0, 120)
      await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
      // …and it is CONSUMED: the page behind the strip must not scroll as well.
      expect(await page.evaluate(() => window.scrollY)).toBe(pageY)

      // At its end the strip lets go rather than trapping the wheel: the next
      // notch scrolls the page, exactly as it did before the strip existed.
      // (Asserted last for each strip: scrolling the page moves the strip out
      // from under the pointer, so nothing else may depend on the position.)
      await page.mouse.wheel(0, 4000)
      const atEnd = await strip.evaluate((el) => el.scrollLeft)
      expect(atEnd).toBe(max)
      await page.mouse.wheel(0, 120)
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(pageY)
      expect(await strip.evaluate((el) => el.scrollLeft)).toBe(atEnd)
    }
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

  test('an NPC panel runs its own turn: AP, Recharge cooldown, and the Recharge Die', async ({
    page,
  }) => {
    // A deterministic Recharge Die: ids come from crypto.randomUUID(), so
    // pinning Math.random fixes the d6 (always 6) without touching anything
    // else. A d6 of 6 recharges every ability in this test.
    await page.addInitScript(() => {
      Math.random = () => 0.9
    })

    await gotoHome(page)
    await createNpc(page, 'Bandit')

    // ---- Author a Recharge ability on the base through the real editor ----
    await page.locator('.card-main').filter({ hasText: 'Bandit' }).first().click()
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'Edit' })
      .click()
    await page.getByRole('button', { name: '+ Add Ability' }).click()
    const editor = page.getByRole('dialog', { name: 'New Ability' })
    await editor.getByLabel('Name').fill('Fire Breath')
    await editor
      .getByLabel('Traits (comma-separated)')
      .fill('Action, Recharge (5)')
    await editor.getByLabel('AP Cost').fill('2')
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Fire Breath')).toBeVisible()

    // ---- The standalone NPC sheet stays a static reference ---------------
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'View' })
      .click()
    await expect(page.getByRole('button', { name: 'Activate' })).toHaveCount(0)
    await expect(page.locator('.gm-recharge')).toHaveCount(0)
    await expect(page.locator('.gm-ap')).toHaveCount(0)
    // Let the sheet's debounced autosave land before leaving the page.
    await page.waitForTimeout(700)

    // ---- Spawn an instance of it on a screen ------------------------------
    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page
      .locator('.gm-picker__list .gm-picker__item')
      .filter({ hasText: 'Bandit' })
      .click()
    await page.getByRole('button', { name: 'Done' }).click()

    const panel = page.locator('.gm-panel--npc')
    // Spawned mid-turn-ready: a full 3 AP, on the same meter player sheets use.
    const apMeter = panel.locator('.gm-ap .gm-bar__value')
    await expect(apMeter).toContainText('3')
    await panel.getByRole('button', { name: /Expand/ }).click()

    // ---- Activating spends the instance's AP and starts the cooldown ------
    // The badge lives in the ability's own trait chip (it replaces the authored
    // "Recharge (5)" text), not in a separate block under the card.
    const badge = panel.locator('.ability-card__trait .gm-recharge')
    await expect(badge).toHaveText('Recharge 5')
    // The panel's own Basic Attack card is activatable too (every NPC carries
    // one), so the click is aimed at the authored ability's card.
    const fireBreath = panel
      .locator('.ability-activation')
      .filter({ hasText: 'Fire Breath' })
    await fireBreath.getByRole('button', { name: 'Activate' }).click()
    await expect(apMeter).toContainText('1')
    await expect(badge).toHaveText('On cooldown — Recharge 5')
    await expect(fireBreath.getByRole('button', { name: 'Activate' })).toBeDisabled()
    // The collapsed-panel count rides with the AP meter.
    await expect(panel.locator('.gm-ap__cooling')).toHaveText('1 on cooldown')

    // ---- At 0 AP the panel offers the turn button -------------------------
    await panel.getByRole('button', { name: 'Spend Action Points' }).click()
    await expect(apMeter).toContainText('0')
    // An NPC panel takes the same out-of-AP dim, AP block exempt.
    await expect(panel.locator('.gm-hp')).toHaveCSS('opacity', '0.55')
    await expect(panel.locator('.gm-ap')).toHaveCSS('opacity', '1')
    // Its ⋯ menu is exempt too — it portals to `document.body`, exactly like
    // the player panel's menu above.
    await panel.getByRole('button', { name: 'Bandit options' }).click()
    const panelMenu = page.locator('.gm-panel__menu')
    await expect(panelMenu).toBeVisible()
    expect(await effectiveOpacity(page, '.gm-panel__menu')).toBe(1)
    await page.keyboard.press('Escape')
    await expect(panelMenu).toHaveCount(0)
    const turn = panel.getByRole('button', { name: 'Start new turn' })
    await expect(turn).toBeVisible()
    await turn.click()
    await expect(panel.locator('.gm-hp')).toHaveCSS('opacity', '1')

    // AP is back, the die roll brought the ability off cooldown, and the roll
    // was announced.
    await expect(apMeter).toContainText('3')
    await expect(badge).toHaveText('Recharge 5')
    await expect(panel.locator('.gm-ap__cooling')).toHaveCount(0)
    await expect(
      page.getByText("Bandit's turn — Recharge Die: 6 · recharged: Fire Breath"),
    ).toBeVisible()

    // ---- The GM can also take one ability off cooldown by hand -------------
    // Same chip, same state: a cooling badge carries a ↻ that recharges that
    // ability immediately, without rolling the Recharge Die.
    await fireBreath.getByRole('button', { name: 'Activate' }).click()
    await expect(badge).toHaveText('On cooldown — Recharge 5')
    await fireBreath
      .getByRole('button', { name: 'Take Fire Breath off cooldown' })
      .click()
    await expect(badge).toHaveText('Recharge 5')
    await expect(panel.locator('.gm-ap__cooling')).toHaveCount(0)
    // The cooldown gate is gone — only the AP the second activation left behind
    // is missing, so one +1 makes the button live again.
    await panel.getByRole('button', { name: 'Restore Action Points' }).click()
    await expect(fireBreath.getByRole('button', { name: 'Activate' })).toBeEnabled()

    // ---- …and stored in the roll log --------------------------------------
    await page.locator('.roll-log-tab').click()
    const entry = page.locator('.roll-log-item').first()
    await expect(entry.locator('.roll-log-item__notation')).toHaveText('1d6')
    await expect(entry.locator('.roll-log-item__src')).toHaveText(
      'Recharge Die: Bandit',
    )
    await expect(entry.locator('.roll-log-item__character')).toHaveText('Bandit')
    await expect(entry.locator('.roll-log-item__total')).toHaveText('6')
  })

  test('the round tracker counts rounds and New Round turns every panel over', async ({
    page,
  }) => {
    // Deterministic Recharge Die: ids come from crypto.randomUUID(), so pinning
    // Math.random fixes the d6 (always 6) without touching anything else.
    await page.addInitScript(() => {
      Math.random = () => 0.9
    })

    await gotoHome(page)
    await createPlayerCharacter(page, 'Vex')
    await createNpc(page, 'Bandit')

    // ---- Author a Recharge ability on the base through the real editor ----
    await page.locator('.card-main').filter({ hasText: 'Bandit' }).first().click()
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'Edit' })
      .click()
    await page.getByRole('button', { name: '+ Add Ability' }).click()
    const editor = page.getByRole('dialog', { name: 'New Ability' })
    await editor.getByLabel('Name').fill('Fire Breath')
    await editor
      .getByLabel('Traits (comma-separated)')
      .fill('Action, Recharge (5)')
    await editor.getByLabel('AP Cost').fill('2')
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    // Let the sheet's debounced autosave land before leaving the page.
    await page.waitForTimeout(700)

    // ---- One player panel + one NPC instance on a fresh screen ------------
    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByRole('button', { name: /Vex/ }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page
      .locator('.gm-picker__list .gm-picker__item')
      .filter({ hasText: 'Bandit' })
      .click()
    await page.getByRole('button', { name: 'Done' }).click()

    // A fresh screen opens on Round 1.
    const round = page.getByLabel('Round', { exact: true })
    await expect(round).toHaveValue('1')

    // ---- Spend both panels' turns ----------------------------------------
    const player = page.locator('.gm-panel--character')
    const npc = page.locator('.gm-panel--npc')
    for (let i = 0; i < 3; i += 1) {
      await player.getByRole('button', { name: 'Spend Action Points' }).click()
    }
    await npc.getByRole('button', { name: /Expand/ }).click()
    const fireBreath = npc
      .locator('.ability-activation')
      .filter({ hasText: 'Fire Breath' })
    await fireBreath.getByRole('button', { name: 'Activate' }).click()
    await npc.getByRole('button', { name: 'Spend Action Points' }).click()
    await expect(npc.locator('.gm-ap .gm-bar__value')).toContainText('0')
    await expect(npc.locator('.gm-ap__cooling')).toHaveText('1 on cooldown')

    // ---- New Round: the counter advances and every panel turns over -------
    await page.getByRole('button', { name: 'New Round' }).click()

    await expect(round).toHaveValue('2')
    await expect(player.locator('.gm-ap .gm-bar__value')).toContainText('3')
    await expect(npc.locator('.gm-ap .gm-bar__value')).toContainText('3')
    // The Recharge Die (6) brought Fire Breath back off cooldown.
    await expect(npc.locator('.gm-ap__cooling')).toHaveCount(0)
    await expect(npc.locator('.ability-card__trait .gm-recharge')).toHaveText(
      'Recharge 5',
    )
    await expect(
      page.getByText('Round 2 — new turns for 2 panels · 1 recharged'),
    ).toBeVisible()

    // ---- The counter is a label the GM can type over ----------------------
    await round.fill('7')
    await round.press('Enter')
    await expect(round).toHaveValue('7')

    // ---- …and both the round and the turn's roll survive a reload ---------
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)
    await expect(page.getByLabel('Round', { exact: true })).toHaveValue('7')

    // The round's Recharge Die was written to the persistent roll log through
    // the same path the panel's own turn uses.
    await page.locator('.roll-log-tab').click()
    const entry = page.locator('.roll-log-item').first()
    await expect(entry.locator('.roll-log-item__notation')).toHaveText('1d6')
    await expect(entry.locator('.roll-log-item__src')).toHaveText(
      'Recharge Die: Bandit',
    )
    await expect(entry.locator('.roll-log-item__total')).toHaveText('6')
  })

  test('an NPC panel spends the instance’s own limited uses, not the base’s', async ({
    page,
  }) => {
    await gotoHome(page)
    await createNpc(page, 'Bandit')

    // ---- Author a limited ability on the base through the real editor -----
    await page.locator('.card-main').filter({ hasText: 'Bandit' }).first().click()
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'Edit' })
      .click()
    await page.getByRole('button', { name: '+ Add Ability' }).click()
    const editor = page.getByRole('dialog', { name: 'New Ability' })
    await editor.getByLabel('Name').fill('Cleave')
    await editor.getByLabel('AP Cost').fill('1')
    await editor.getByRole('checkbox', { name: 'Limited uses' }).check()
    await editor.getByLabel('Max uses').fill('3')
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Cleave')).toBeVisible()

    // ---- The base sheet reads the budget but offers no stepper ------------
    // A base NPC record is the static reference instances are spawned from:
    // its count is template data, so the meter renders and nothing moves it.
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'View' })
      .click()
    const baseCard = page
      .locator('.npc-abilities-section .ability-card')
      .filter({ hasText: 'Cleave' })
    await expect(
      baseCard.getByRole('img', { name: '3 of 3 uses remaining' }),
    ).toBeVisible()
    await expect(
      baseCard.getByRole('button', { name: /one use of/i }),
    ).toHaveCount(0)
    // Let the sheet's debounced autosave land before leaving the page.
    await page.waitForTimeout(700)

    // ---- Spawn an instance and expand it ----------------------------------
    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page
      .locator('.gm-picker__list .gm-picker__item')
      .filter({ hasText: 'Bandit' })
      .click()
    await page.getByRole('button', { name: 'Done' }).click()

    const first = page.locator('.gm-panel--npc').first()
    await first.getByRole('button', { name: /Expand/ }).click()
    const meter = first.getByRole('img', { name: /uses remaining/i })
    await expect(meter).toHaveAccessibleName('3 of 3 uses remaining')

    // ---- Activating spends one use of the instance's own budget ----------
    const apMeter = first.locator('.gm-ap .gm-bar__value')
    // Aimed at the authored ability: the panel's pinned Basic Attack activates
    // as well, so a bare "Activate" would match two buttons.
    const cleave = first.locator('.ability-activation').filter({ hasText: 'Cleave' })
    await cleave.getByRole('button', { name: 'Activate' }).click()
    await expect(meter).toHaveAccessibleName('2 of 3 uses remaining')
    await expect(apMeter).toContainText('2')
    await expect(page.getByText(/Activated Cleave \(1 use spent\)/)).toBeVisible()

    // ---- The ± steppers work here (and cost no AP) ------------------------
    await first.getByRole('button', { name: 'Spend one use of Cleave' }).click()
    await expect(meter).toHaveAccessibleName('1 of 3 uses remaining')
    await first.getByRole('button', { name: 'Restore one use of Cleave' }).click()
    await expect(meter).toHaveAccessibleName('2 of 3 uses remaining')
    await expect(apMeter).toContainText('2')

    // ---- A second instance of the same base starts full -------------------
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page
      .locator('.gm-picker__list .gm-picker__item')
      .filter({ hasText: 'Bandit' })
      .click()
    await page.getByRole('button', { name: 'Done' }).click()
    const second = page.locator('.gm-panel--npc').nth(1)
    await second.getByRole('button', { name: /Expand/ }).click()
    await expect(
      second.getByRole('img', { name: '3 of 3 uses remaining' }),
    ).toBeVisible()

    // ---- Reload: each instance kept its own count -------------------------
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)
    await expect(
      page
        .locator('.gm-panel--npc')
        .nth(0)
        .getByRole('img', { name: '2 of 3 uses remaining' }),
    ).toBeVisible()
    await expect(
      page
        .locator('.gm-panel--npc')
        .nth(1)
        .getByRole('img', { name: '3 of 3 uses remaining' }),
    ).toBeVisible()

    // ---- …and the base record never moved --------------------------------
    await page.getByRole('button', { name: 'NPCs' }).first().click()
    await page.locator('.card-main').filter({ hasText: 'Bandit' }).first().click()
    const baseCardAfter = page
      .locator('.npc-abilities-section .ability-card')
      .filter({ hasText: 'Cleave' })
    await expect(
      baseCardAfter.getByRole('img', { name: '3 of 3 uses remaining' }),
    ).toBeVisible()
    await expect(
      baseCardAfter.getByRole('button', { name: /one use of/i }),
    ).toHaveCount(0)
  })

  test('an NPC panel switches its own ability modifiers', async ({ page }) => {
    await gotoHome(page)
    await createNpc(page, 'Bandit')

    // ---- Author an "Evasion +2" ability on the base -----------------------
    await page.locator('.card-main').filter({ hasText: 'Bandit' }).first().click()
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'Edit' })
      .click()
    await page.getByRole('button', { name: '+ Add Ability' }).click()
    const editor = page.getByRole('dialog', { name: 'New Ability' })
    await editor.getByLabel('Name').fill('Rage')
    await editor
      .getByRole('checkbox', { name: 'Modifies combat stats / attributes' })
      .check()
    await editor.getByLabel('Evasion amount').fill('2')
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Rage')).toBeVisible()

    // ---- The base sheet reads it but cannot switch it on ------------------
    await page
      .locator('.mode-toggle--floating')
      .getByRole('tab', { name: 'View' })
      .click()
    // Scoped to the authored card: every NPC sheet also renders the pinned
    // Basic Attack, which declares no modifiers.
    const baseCard = page
      .locator('.npc-abilities-section .ability-card')
      .filter({ hasText: 'Rage' })
    await expect(baseCard.getByText('+2 Evasion')).toBeVisible()
    await expect(baseCard.getByRole('switch')).toBeDisabled()
    // Let the sheet's debounced autosave land before leaving the page.
    await page.waitForTimeout(700)

    // ---- Spawn two instances and expand the first -------------------------
    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    for (let i = 0; i < 2; i += 1) {
      await page.getByRole('button', { name: 'Add NPC' }).first().click()
      await page
        .locator('.gm-picker__list .gm-picker__item')
        .filter({ hasText: 'Bandit' })
        .click()
      await page.getByRole('button', { name: 'Done' }).click()
    }

    const first = page.locator('.gm-panel--npc').nth(0)
    const second = page.locator('.gm-panel--npc').nth(1)
    const evasion = (panel: Locator) =>
      panel.locator('.gm-token').filter({ hasText: 'Eva' }).locator('.gm-token__value')
    await first.getByRole('button', { name: /Expand/ }).click()
    await expect(evasion(first)).toHaveText('10')

    // ---- Switching it on moves THIS instance's stats ----------------------
    const toggle = first.getByRole('switch', { name: /Apply Rage modifiers/i })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(evasion(first)).toHaveText('12')
    // The expanded body's own Combat Stats row agrees with the chrome token.
    await expect(
      first.locator('.gm-panel__sheet .stat-token--modified .stat-token__delta'),
    ).toHaveText('+2')
    // …and the sibling instance is untouched.
    await expect(evasion(second)).toHaveText('10')
    await second.getByRole('button', { name: /Expand/ }).click()
    await expect(
      second.getByRole('switch', { name: /Apply Rage modifiers/i }),
    ).toHaveAttribute('aria-checked', 'false')

    // ---- Reload: each instance kept its own switches ----------------------
    await page.waitForTimeout(700)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'GRIMOIRE' })).toBeVisible()
    await gotoGmScreen(page)
    await expect(evasion(page.locator('.gm-panel--npc').nth(0))).toHaveText('12')
    await expect(evasion(page.locator('.gm-panel--npc').nth(1))).toHaveText('10')

    // ---- …and the base record never moved --------------------------------
    await page.getByRole('button', { name: 'NPCs' }).first().click()
    await page.locator('.card-main').filter({ hasText: 'Bandit' }).first().click()
    const baseCardAfter = page
      .locator('.npc-abilities-section .ability-card')
      .filter({ hasText: 'Rage' })
    const baseToggle = baseCardAfter.getByRole('switch')
    await expect(baseToggle).toBeDisabled()
    await expect(baseToggle).toHaveAttribute('aria-checked', 'false')
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

  test('a dead panel never dims the picker it opens', async ({ page }) => {
    await gotoHome(page)
    await createNpc(page, 'Bandit')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await page.locator('.gm-picker__list .gm-picker__item').filter({ hasText: 'Bandit' }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    // ---- Mark the instance dead ------------------------------------------
    // `.gm-panel--dead` carries the panel's dim, and `opacity` on an ancestor
    // both multiplies into every descendant and becomes the containing block
    // for `position: fixed` — the two halves of the bug.
    const panel = page.locator('.gm-panel--npc')
    await panel.getByRole('button', { name: 'Bandit options' }).click()
    await page.getByRole('menuitem', { name: 'Mark dead' }).click()
    await expect(panel).toHaveClass(/gm-panel--dead/)
    expect(
      await panel.evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
    ).toBeLessThan(1)

    // Its ⋯ menu is not part of that dim either: it portals to `document.body`.
    await panel.getByRole('button', { name: 'Bandit options' }).click()
    const panelMenu = page.locator('.gm-panel__menu')
    await expect(panelMenu).toBeVisible()
    expect(await effectiveOpacity(page, '.gm-panel__menu')).toBe(1)
    await page.keyboard.press('Escape')
    await expect(panelMenu).toHaveCount(0)

    // ---- Open the picker from that panel ---------------------------------
    await panel.getByRole('button', { name: 'Add status to Bandit' }).click()
    const overlay = page.locator('.modal-overlay')
    const dialog = overlay.locator('.modal-content.gm-status-picker')
    await expect(dialog).toBeVisible()
    // Both fade/pop in over 0.2s — read them settled.
    await expect(overlay).toHaveCSS('opacity', '1')
    await expect(dialog).toHaveCSS('opacity', '1')

    const placement = await page.evaluate(() => {
      const overlay = document.querySelector('.modal-overlay')!
      const rect = overlay.getBoundingClientRect()
      return {
        onBody: overlay.parentElement === document.body,
        insidePanel: overlay.closest('.gm-panel') !== null,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      }
    })

    // The dialog is a viewport overlay again, not a child of the panel…
    expect(placement.onBody).toBe(true)
    expect(placement.insidePanel).toBe(false)
    // …and no ancestor's dim reaches it: the panel's 0.75 used to make the
    // whole dialog 75% transparent even though its own opacity was 1.
    expect(await effectiveOpacity(page, '.modal-overlay .modal-content')).toBe(1)
    // …so its backdrop dims the whole viewport instead of the panel's box.
    const viewport = page.viewportSize()!
    expect(placement.rect).toEqual({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    })

    // ---- …and it still tracks statuses on the dead panel ------------------
    await page
      .getByRole('group', { name: 'Duration for Poisoned' })
      .getByRole('button', { name: 'Quick', exact: true })
      .click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(panel.locator('.gm-status-pill')).toHaveCount(1)
    await expect(panel.locator('.gm-status-pill__name')).toHaveText('Poisoned')
  })

  test('the title bar recedes behind a GM Screen status picker', async ({ page }) => {
    const header = page.locator('.app-header')
    const title = page.locator('.app-title')

    await gotoHome(page)
    await createNpc(page, 'Bandit')

    await gotoGmScreen(page)
    await page.getByRole('button', { name: 'New Screen' }).first().click()
    await page.getByRole('button', { name: 'Create' }).click()

    // Baseline: an idle bar is neither blurred nor click-through.
    await expect(title).not.toHaveCSS('filter', 'blur(4px)')
    await expect(header).toHaveCSS('pointer-events', 'auto')

    // A modal mounted inside the page (this picker lives in the screen's own
    // tree) recedes the bar as it always has…
    await page.getByRole('button', { name: 'Add NPC' }).first().click()
    await expect(title).toHaveCSS('filter', 'blur(4px)')
    await page.locator('.gm-picker__list .gm-picker__item').filter({ hasText: 'Bandit' }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(title).not.toHaveCSS('filter', 'blur(4px)')

    // ---- The status picker, which portals to `document.body` -------------
    // …and so must that one. Every modal recedes the app chrome behind it
    // (blurred content, a scrim over the bar, no nav clicks), but the portalled
    // picker sat OUTSIDE the `.app:has(...)` guard this state used to hang off
    // — the bar stayed sharp behind exactly this dialog. `body:has(...)` sees
    // an overlay wherever it is mounted.
    await page
      .locator('.gm-panel--npc')
      .getByRole('button', { name: 'Add status to Bandit' })
      .click()
    await expect(page.locator('.modal-content.gm-status-picker')).toBeVisible()

    await expect(title).toHaveCSS('filter', 'blur(4px)')
    await expect(page.locator('.app-header__nav')).toHaveCSS('filter', 'blur(4px)')
    // The rest of the chrome recedes with it (App.css owns the bar, dice.css
    // the floating roll-log tab), so nothing behind the dialog stays sharp.
    await expect(page.locator('.roll-log-tab')).toHaveCSS('filter', 'blur(4px)')
    // The bar is not interactable while a dialog is pending…
    await expect(header).toHaveCSS('pointer-events', 'none')
    // …and it is dimmed by its scrim, which the bar itself must not carry (it
    // stays opaque — see App.css) but which matches the modal backdrop's tint.
    const scrim = await header.evaluate((el) => {
      const style = getComputedStyle(el, '::after')
      return { content: style.content, background: style.backgroundColor }
    })
    expect(scrim.content).not.toBe('none')
    expect(scrim.background).toBe('rgba(10, 8, 16, 0.85)')

    // Closing the dialog hands the chrome straight back.
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.locator('.modal-overlay')).toHaveCount(0)
    await expect(title).not.toHaveCSS('filter', 'blur(4px)')
    await expect(header).toHaveCSS('pointer-events', 'auto')
  })
})
