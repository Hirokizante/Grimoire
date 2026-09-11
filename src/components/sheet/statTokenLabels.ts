/**
 * Combat Stats token labels — the full stat name, and the shorthand a narrow
 * surface prints instead.
 *
 * Both stat-token sections (the player sheet's `StatsSection` and an NPC's
 * `NPCStatsSection`) render through this one vocabulary, so a panel's row and
 * the sheet page's row can never disagree about what a stat is called.
 *
 * It exists as its own module rather than living beside `StatsSection` because
 * a component file should export components only (React Fast Refresh), and
 * because this is shared vocabulary: the GM panel chrome — `CharacterPanel` and
 * `NpcInstancePanel`, which label the same stats Eva/Arm/Move/DC — is the other
 * surface it has to agree with.
 */

/**
 * Stat-name shorthand for narrow surfaces.
 *
 * A GM Screen panel's token column is ~7.5rem wide. The full names ellipsised
 * there — "MILEST…", "SAVE …", "END RE…" — and an ellipsis is not a stat name: a
 * GM reading six panels mid-turn cannot be left guessing. Every entry here is
 * short enough to print whole in that column at every width the app supports
 * (measured, from 420px up).
 *
 * Kept deliberately in step with the panel chrome's "Eva / Arm / Move / DC"
 * (CharacterPanel, NpcInstancePanel): a stat must read the same on the panel as
 * in the row of cards below it. Every row the app renders is here, NPC-only
 * stats included — "Mortal Wounds" is the longest stat name in the app and the
 * one that truncates hardest. Entries missing from this map (HP) already fit and
 * print unchanged.
 */
export const SHORT_STAT_LABELS: Record<string, string> = {
  Milestones: 'Miles',
  Evasion: 'Eva',
  Armor: 'Arm',
  Movement: 'Move',
  'Save DC': 'Save',
  'END Recovery': 'END Rec',
  'Mortal Wounds': 'Wounds',
}

/** Full stat names or their {@link SHORT_STAT_LABELS} shorthand. */
export type StatTokenLabelMode = 'full' | 'short'

/**
 * What one stat token prints, and what it says on hover.
 *
 * `text` is the shorthand in short mode and the full name otherwise. `title` is
 * the full name whenever the printed text is a shorthand — so an abbreviated
 * token is one hover from its real name (and, via `title`, that is also what a
 * screen reader announces) — joined with the ability-modifier note when the
 * value carries one. It is undefined when the full name is printed and no
 * modifier note applies.
 */
export function statTokenLabel(
  fullName: string,
  mode: StatTokenLabelMode,
  modified = false,
): { text: string; title?: string } {
  const text = mode === 'short' ? SHORT_STAT_LABELS[fullName] ?? fullName : fullName
  const title = [
    text === fullName ? null : fullName,
    modified ? 'Includes active ability modifiers' : null,
  ]
    .filter(Boolean)
    .join(' — ')
  return { text, title: title || undefined }
}
