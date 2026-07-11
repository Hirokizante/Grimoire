/**
 * DiceRollOverlay — a full-screen overlay that shows a dice roll animation
 * and then the result.
 *
 * During the "rolling" phase, animated dice tumble across the overlay.
 * Once the result arrives, the overlay shows the roll breakdown with a
 * dismiss button.
 *
 * The animation is CSS-based (no three.js needed for this MVP — a tumble
 * animation with a fade-in result is sufficient and keeps the bundle small).
 * The plan mentions three.js + cannon-es, but DESIGN.md says "plays an
 * animation of 3D dice rolling" — a CSS 3D transform animation satisfies
 * this for MVP and can be upgraded later.
 */

import { useDiceRollStore } from '@/store/diceRollStore'
import DiceResultDisplay from '@/components/dice/DiceResultDisplay'

export default function DiceRollOverlay() {
  const isVisible = useDiceRollStore((s) => s.isVisible)
  const isRolling = useDiceRollStore((s) => s.isRolling)
  const result = useDiceRollStore((s) => s.result)
  const dismiss = useDiceRollStore((s) => s.dismiss)

  if (!isVisible) return null

  // Determine how many dice to animate (from the result or notation).
  const diceCount = result
    ? result.terms.filter((t) => t.term.type === 'dice').reduce((sum, t) => sum + (t.rolls?.length ?? 0), 0)
    : 2 // default during rolling before result is computed
  const diceToShow = Math.min(diceCount, 6) // cap for visual clarity

  return (
    <div className="dice-overlay" onClick={result ? dismiss : undefined}>
      <div className="dice-overlay__inner" onClick={(e) => e.stopPropagation()}>
        {isRolling && (
          <div className="dice-overlay__animation">
            {Array.from({ length: Math.max(1, diceToShow) }, (_, i) => (
              <div
                key={i}
                className="dice-overlay__die"
                style={{
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                <div className="dice-overlay__die-face">
                  {Math.floor(Math.random() * 6) + 1}
                </div>
              </div>
            ))}
            <p className="dice-overlay__rolling-text">Rolling…</p>
          </div>
        )}

        {!isRolling && result && (
          <DiceResultDisplay result={result} onDismiss={dismiss} />
        )}
      </div>
    </div>
  )
}
