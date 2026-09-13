/**
 * Emoji catalog + search for the status icon picker.
 *
 * The full Unicode emoji set (1,900+ entries, names and groups from
 * `unicode-emoji-json`) is ~390 KB of JSON, so it is imported **lazily**: the
 * picker only pays for it once the user opens the Emoji tab. `loadEmojiCatalog`
 * memoises the import, so every later mount is instant.
 *
 * `searchEmojis` is the pure ranking half — it scores by where the query lands
 * in an emoji's name, and lets a small table of tabletop terms ("poison",
 * "blind", "grappled"…) reach emoji whose Unicode names never mention them.
 */

/** One selectable emoji. */
export interface EmojiEntry {
  /** The character(s) to store in `StatusCondition.icon`. */
  emoji: string
  /** Unicode/CLDR name, e.g. "crossed swords". */
  name: string
  /** Stable slug, e.g. "crossed_swords". */
  slug: string
  /** Group name, e.g. "Objects". */
  group: string
}

/** A named group of emoji, in Unicode's canonical order. */
export interface EmojiGroup {
  name: string
  emojis: EmojiEntry[]
}

/** Shape of `unicode-emoji-json/data-by-group.json`. */
interface RawEmojiGroup {
  name: string
  emojis: { emoji: string; name: string; slug: string }[]
}

let catalogPromise: Promise<EmojiGroup[]> | null = null

/** Load (once) and cache the full emoji catalog, grouped in display order. */
export function loadEmojiCatalog(): Promise<EmojiGroup[]> {
  catalogPromise ??= import('unicode-emoji-json/data-by-group.json').then(
    (mod) => {
      const raw = (mod.default ?? mod) as unknown as RawEmojiGroup[]
      return raw.map((group) => ({
        name: group.name,
        emojis: group.emojis.map((entry) => ({
          emoji: entry.emoji,
          name: entry.name,
          slug: entry.slug,
          group: group.name,
        })),
      }))
    },
  )
  return catalogPromise
}

/** Emoji offered up front, before the user searches (the old quick-pick row). */
export const EMOJI_QUICK_PICKS: readonly string[] = [
  '💀', '☠️', '🔥', '❄️', '⚡', '💧', '🌪️', '🌙', '☀️', '✨',
  '💫', '😵', '🧎', '🙈', '👻', '🌫️', '🔮', '♻️', '⛓️', '🩸',
  '💚', '🧠', '🗡️', '🛡️', '💥', '🐍', '🕸️', '🩹', '⏳', '🔒',
]

/**
 * Tabletop search terms the Unicode names don't cover.
 *
 * Condition names from the SRD ("Poisoned", "Blinded", "Immobilized"…) rarely
 * appear in CLDR's wording — an emoji is called "skull and crossbones", not
 * "poison" — so searching for the game term has to be taught here.
 */
export const EMOJI_ALIASES: Readonly<Record<string, readonly string[]>> = {
  acid: ['🧪', '🫧'],
  asleep: ['😴'],
  attack: ['⚔️'],
  bleed: ['🩸'],
  blind: ['🙈', '🕶️'],
  bless: ['✨'],
  burn: ['🔥'],
  charmed: ['💗'],
  confusion: ['😵‍💫'],
  cursed: ['🔮'],
  damage: ['💥'],
  dazed: ['😵'],
  deafened: ['🙉'],
  death: ['💀'],
  disease: ['🦠'],
  drowning: ['🌊'],
  energy: ['⚡'],
  entangled: ['🌿'],
  exhaustion: ['😩'],
  fear: ['😱'],
  fire: ['🔥'],
  freeze: ['❄️'],
  frozen: ['❄️'],
  grappled: ['⛓️'],
  haste: ['💨'],
  heal: ['❤️‍🩹', '♻️'],
  hidden: ['🌫️'],
  immobilized: ['⛓️'],
  invisible: ['👻'],
  lightning: ['⚡'],
  loot: ['💰'],
  mind: ['🧠'],
  paralyzed: ['🧊'],
  poison: ['☠️', '🧪'],
  potion: ['🧪'],
  prone: ['🧎'],
  protection: ['🛡️'],
  rage: ['😡'],
  regeneration: ['♻️'],
  restrained: ['⛓️'],
  shield: ['🛡️'],
  silenced: ['🤐'],
  sleep: ['😴', '💤', '🛏️'],
  slow: ['🐌'],
  speed: ['💨'],
  strength: ['💪'],
  stunned: ['💫'],
  sword: ['⚔️', '🗡️'],
  time: ['⏳'],
  trap: ['🪤'],
  treasure: ['💰'],
  weak: ['🦴'],
  weapon: ['🗡️'],
  wound: ['🩸'],
}

/** How many search hits the picker is willing to render at once. */
export const EMOJI_SEARCH_LIMIT = 240

/** Lower is better: exact name, word start, then "anywhere in the name". */
function scoreMatch(entry: EmojiEntry, tokens: string[]): number {
  const name = entry.name.toLowerCase()
  const slug = entry.slug.replace(/_/g, ' ')
  let score = 0

  for (const token of tokens) {
    const inName = name.indexOf(token)
    const inSlug = slug.indexOf(token)
    if (inName < 0 && inSlug < 0) return Number.POSITIVE_INFINITY
    if (inName === 0 || inSlug === 0) continue
    if (name.includes(` ${token}`) || slug.includes(` ${token}`)) score += 1
    else score += 2
  }

  return score
}

/** Every emoji whose name matches every word of `query`, best match first. */
export function searchEmojis(
  groups: EmojiGroup[],
  query: string,
  limit: number = EMOJI_SEARCH_LIMIT,
): EmojiEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const tokens = needle.split(/\s+/)
  const byEmoji = new Map<string, EmojiEntry>()
  const scored: { entry: EmojiEntry; score: number }[] = []

  for (const group of groups) {
    for (const entry of group.emojis) {
      byEmoji.set(entry.emoji, entry)
      const score = scoreMatch(entry, tokens)
      if (Number.isFinite(score)) scored.push({ entry, score })
    }
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.entry.name.length - b.entry.name.length ||
      a.entry.name.localeCompare(b.entry.name),
  )

  // Alias hits are what the user meant by a game term — put them in front.
  const results: EmojiEntry[] = []
  const seen = new Set<string>()
  for (const emoji of aliasMatches(needle)) {
    const entry = byEmoji.get(emoji)
    if (entry && !seen.has(emoji)) {
      seen.add(emoji)
      results.push(entry)
    }
  }
  for (const { entry } of scored) {
    if (seen.has(entry.emoji)) continue
    seen.add(entry.emoji)
    results.push(entry)
  }

  return results.slice(0, limit)
}

/** Emoji registered under `needle` (or a term it prefixes), in table order. */
function aliasMatches(needle: string): string[] {
  if (needle.includes(' ')) return []
  const hits: string[] = []
  for (const [term, emojis] of Object.entries(EMOJI_ALIASES)) {
    // "poison", "poisoned" and "poisonous" all reach the poison glyph.
    if (term.startsWith(needle) || needle.startsWith(term)) hits.push(...emojis)
  }
  return [...new Set(hits)]
}

/**
 * A query the user typed/pasted that is itself an emoji rather than a search
 * word — offered as-is so pasting still works without a free-text field.
 */
export function pastedEmojiCandidate(query: string): string | null {
  const value = query.trim()
  if (!value || /[a-z0-9]/i.test(value)) return null
  if ([...value].length > 8) return null
  return value
}
