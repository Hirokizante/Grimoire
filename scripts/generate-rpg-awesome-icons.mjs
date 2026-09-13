#!/usr/bin/env node
/**
 * Regenerates `src/constants/rpgAwesomeIcons.ts` from the installed
 * `rpg-awesome` package.
 *
 * RPG-Awesome ships its 496 icon classes as SCSS rules in `scss/_icons.scss`
 * (one `.ra-<name>:before { content: $ra-var-icon-<name> }` block each, plus a
 * single alias: `.ra-sword` shares `.ra-broadsword`'s glyph). The picker needs
 * that list as data — both to draw the grid and to search it — so we read the
 * class names straight out of the package instead of hand-copying them.
 *
 * Run with `npm run icons:rpg-awesome` after bumping `rpg-awesome`.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const ICONS_SCSS = join(root, 'node_modules/rpg-awesome/scss/_icons.scss')
const OUT_FILE = join(root, 'src/constants/rpgAwesomeIcons.ts')
const PREFIX = 'ra-'

const scss = readFileSync(ICONS_SCSS, 'utf8')

const names = new Set()
const selector = /\.#\{\$ra-css-prefix\}-([a-z0-9-]+):before/g
for (const match of scss.matchAll(selector)) {
  names.add(match[1])
}

if (names.size < 400) {
  throw new Error(
    `Only found ${names.size} icon classes in ${ICONS_SCSS} — did the package layout change?`,
  )
}

const keys = [...names].sort().map((name) => `${PREFIX}${name}`)

const file = `/**
 * RPG-Awesome icon keys — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Every icon class the bundled \`rpg-awesome\` font defines, as the exact
 * class name to store in \`StatusCondition.icon\` when \`iconType === 'pack'\`
 * (render with \`<i className={\`ra \${key}\`} />\`).
 *
 * Generated from rpg-awesome@0.2.0 \`scss/_icons.scss\` (${keys.length} icons) by
 * \`scripts/generate-rpg-awesome-icons.mjs\`; run \`npm run icons:rpg-awesome\`
 * after bumping the package.
 */

/** Stable class-name keys for every RPG-Awesome icon, alphabetically sorted. */
export const RPG_AWESOME_ICON_KEYS: readonly string[] = [
${keys.map((key) => `  '${key}',`).join('\n')}
]
`

writeFileSync(OUT_FILE, file)
console.log(`Wrote ${keys.length} icon keys to ${OUT_FILE}`)
