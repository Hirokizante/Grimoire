/**
 * TerminalBootAnimation — home page background that emulates Grimoire being
 * launched from a terminal. A scripted boot sequence "types" itself out line
 * by line — environment lines, self-checks, block-art glyph, progress bars,
 * vault scan — holds briefly once complete, then fades to a dim, static log
 * behind all other home page content. It does NOT scroll indefinitely: the
 * animation is a one-shot startup, replaying only on home page remount.
 *
 * Everything renders in a single bottom-left log. The script is deliberately
 * setting-agnostic — Divergence is not strictly a fantasy system, so the
 * boot text sticks to sheets, dice, and data.
 */

import { useEffect, useRef, useState } from 'react'

/** One scripted step: the full line text, how long to "type" it, and how
 *  long to pause after it lands before starting the next line. */
interface BootLine {
  text: string
  typeMs: number
  pauseAfterMs: number
}

const APP_VERSION = '0.3.0'

/* The app's glyph rendered as terminal art (Braille-pattern blocks).
 * Lines use ⠀ (U+2800 Braille blank) for padding — keep them intact. */
const GLYPH_ART: string[] = [
  '⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⢳⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⢷⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣾⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣦⡀⠀⠀⠀⠀⠀⠀⣠⣾⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣷⣿⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀⣀⣀⡠⠄',
  '⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⠿⣿⣿⣿⣿⣟⠘⠛⠻⠿⣿⣿⣿⣿⣤⣤⣿⠿⠟⠃⠀⠀',
  '⠤⢤⣀⣀⣀⣀⣀⣤⣾⡿⠻⣿⣶⣿⣿⣿⣿⣿⠀⠀⠀⠀⠘⠿⣿⣿⡟⠉⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠉⠉⠛⠻⣿⣿⣤⡀⠛⣿⣿⣿⠿⠟⠃⠀⠀⠀⠀⣀⣴⣾⡿⠂⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⣿⣿⣿⣦⣤⣤⣀⣤⣤⣶⣶⣿⣿⡿⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⠟⠉⠉⠛⠟⠛⠛⠛⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡼⠃⠀⠀⠀⢀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣤⠶⠒⠁⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠋⠀⠀⢀⣴⣿⣿⣿⣿⣿⣷⣶⣤⣤⣶⣾⠟⠛⠉⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣨⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⡿⠛⢻⣿⣿⡿⠿⣿⣿⡏⠉⠻⢿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⢰⣿⡛⠁⠀⠀⠻⣿⣿⣶⣿⣿⠁⠀⢀⣴⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠈⢿⣿⣦⣤⣀⣀⣀⡉⠉⠉⣀⣠⣴⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⠀⢀⣤⠞⠁⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⢀⣴⡿⠛⠉⠉⠙⠿⣿⣿⣿⣿⡿⠟⠋⠀⠀⠀⣠⣾⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⣠⡾⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣾⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠜⠁⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⣦⣶⣶⣶⣾⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣟⣿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⡿⠟⠉⠉⠠⣿⣍⣽⣿⣿⣿⣿⣦⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠒⠒⠿⢿⣿⡟⠁⠀⠀⠀⠀⠀⠻⣿⣿⣿⣿⡿⠋⣻⣿⣿⣿⣷⣶⣤⣤⣠⡀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠙⣿⣶⣤⣀⠀⡀⠀⠀⠈⣛⣉⣩⣶⣾⠟⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢈⣿⡿⠿⠿⣿⡿⠿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⡏⠀⠀⠀⠀⠀⠀⠀⢻⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⢠⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
]

const BOOT_LINES: BootLine[] = [
  /* Launch + environment. */
  { text: '$ grimoire launch --offline', typeMs: 680, pauseAfterMs: 360 },
  { text: `grimoire v${APP_VERSION} — character sheet companion`, typeMs: 520, pauseAfterMs: 180 },
  { text: 'build: stable · runtime: browser · mode: offline-first', typeMs: 490, pauseAfterMs: 160 },
  { text: 'platform: indexeddb persistent storage, zero network deps', typeMs: 500, pauseAfterMs: 160 },
  { text: 'node: ok · storage: ok · fonts: local · network: not required', typeMs: 520, pauseAfterMs: 300 },

  /* Self-check. */
  { text: 'initializing core systems', typeMs: 380, pauseAfterMs: 240 },
  { text: '[ ok ] storage driver mounted ............ 3ms', typeMs: 420, pauseAfterMs: 110 },
  { text: '[ ok ] schema version negotiated ......... 1ms', typeMs: 420, pauseAfterMs: 110 },
  { text: '[ ok ] character vault indexed ........... 8ms', typeMs: 430, pauseAfterMs: 110 },
  { text: '[ ok ] npc registry linked ............... 2ms', typeMs: 410, pauseAfterMs: 110 },
  { text: '[ ok ] status compendium resolved ........ 4ms', typeMs: 430, pauseAfterMs: 110 },
  { text: '[ ok ] dice notation parser loaded ....... 2ms', typeMs: 430, pauseAfterMs: 110 },
  { text: '[ ok ] roll log replay verified .......... 5ms', typeMs: 420, pauseAfterMs: 110 },
  { text: '[ ok ] theme palette applied ............. 1ms', typeMs: 420, pauseAfterMs: 110 },
  { text: '[ ok ] render pipeline warmed ............ 6ms', typeMs: 430, pauseAfterMs: 280 },
  { text: 'self-check complete: 9/9 passed', typeMs: 400, pauseAfterMs: 300 },

  /* Glyph. */
  ...GLYPH_ART.map((text) => ({ text, typeMs: 80, pauseAfterMs: 55 })),
  { text: '', typeMs: 0, pauseAfterMs: 200 },

  /* Module load with progress bars. */
  { text: 'loading modules', typeMs: 320, pauseAfterMs: 200 },
  { text: 'sheets      ██████████████████████████████ 100%', typeMs: 620, pauseAfterMs: 100 },
  { text: 'dice        ██████████████████████████████ 100%', typeMs: 540, pauseAfterMs: 100 },
  { text: 'statuses    ██████████████████████████████ 100%', typeMs: 580, pauseAfterMs: 100 },
  { text: 'npcs        ██████████████████████████████ 100%', typeMs: 520, pauseAfterMs: 100 },
  { text: 'themes      ██████████████████████████████ 100%', typeMs: 540, pauseAfterMs: 100 },
  { text: 'markdown    ██████████████████████████████ 100%', typeMs: 560, pauseAfterMs: 100 },
  { text: 'export      ██████████████████████████████ 100%', typeMs: 540, pauseAfterMs: 260 },

  /* Vault scan. */
  { text: 'scanning vault', typeMs: 320, pauseAfterMs: 220 },
  { text: 'sheets: indexed · npcs: linked · statuses: bundled', typeMs: 500, pauseAfterMs: 170 },
  { text: 'integrity: 0 corruption · 0 conflicts · 0 pending syncs', typeMs: 510, pauseAfterMs: 170 },
  { text: 'backup reminder: last export unknown — export regularly', typeMs: 500, pauseAfterMs: 300 },

  /* Handoff. */
  { text: 'all modules loaded in 0.42s', typeMs: 380, pauseAfterMs: 300 },
  { text: 'ready.', typeMs: 220, pauseAfterMs: 200 },
  { text: '$ render --home', typeMs: 480, pauseAfterMs: 0 },
]

/** How long the completed log stays at full brightness before settling dim. */
const SETTLE_DELAY_MS = 3400

/**
 * Build the typing schedule: for each line, the delay (from mount) at which
 * it starts appearing, its typing duration, and its character count. Used to
 * drive the animation with plain timeouts — no per-frame work.
 */
function buildSchedule(): { start: number; typeMs: number; chars: number }[] {
  let cursor = 0
  return BOOT_LINES.map((line) => {
    const entry = { start: cursor, typeMs: line.typeMs, chars: line.text.length }
    cursor += line.typeMs + line.pauseAfterMs
    return entry
  })
}

const SCHEDULE = buildSchedule()

export default function TerminalBootAnimation() {
  /** Number of whole lines fully revealed so far. */
  const [linesShown, setLinesShown] = useState(0)
  /** Characters revealed of the line currently typing (0 when between lines). */
  const [partialChars, setPartialChars] = useState(0)
  /** True once the whole script has finished and the log has settled dim. */
  const [settled, setSettled] = useState(false)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const timers = timersRef.current

    SCHEDULE.forEach(({ start, typeMs, chars }, lineIndex) => {
      // Begin typing this line: it becomes the (linesShown + 1)-th row.
      timers.push(
        window.setTimeout(() => {
          setLinesShown(lineIndex)
          setPartialChars(0)
          // Reveal characters one tick at a time across typeMs.
          const tickMs =
            chars > 0 ? Math.max(10, Math.floor(typeMs / chars)) : 0
          for (let c = 1; c <= chars; c += 1) {
            timers.push(
              window.setTimeout(() => setPartialChars(c), c * tickMs),
            )
          }
        }, start),
      )
      // Line complete: commit it as a full row.
      timers.push(
        window.setTimeout(() => {
          setLinesShown(lineIndex + 1)
          setPartialChars(0)
        }, start + typeMs),
      )
    })

    const totalMs =
      SCHEDULE.length > 0
        ? SCHEDULE[SCHEDULE.length - 1].start +
          SCHEDULE[SCHEDULE.length - 1].typeMs
        : 0
    timers.push(
      window.setTimeout(() => setSettled(true), totalMs + SETTLE_DELAY_MS),
    )

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers.length = 0
    }
  }, [])

  const visibleLines = BOOT_LINES.slice(0, linesShown)
  const typingLine =
    partialChars > 0 && linesShown < BOOT_LINES.length
      ? BOOT_LINES[linesShown].text.slice(0, partialChars)
      : null
  const done = linesShown >= BOOT_LINES.length

  return (
    <div
      className={
        'home-page__terminal' + (settled ? ' home-page__terminal--settled' : '')
      }
      aria-hidden="true"
    >
      <div className="home-page__terminal-log">
        {visibleLines.map((line, i) => (
          <div key={i} className="home-page__terminal-line">
            {line.text}
          </div>
        ))}
        {!done && (
          <div className="home-page__terminal-line home-page__terminal-line--active">
            {typingLine}
            <span className="home-page__terminal-cursor" />
          </div>
        )}
      </div>
    </div>
  )
}
