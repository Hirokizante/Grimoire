/**
 * CharacterSheetPage — wraps the CharacterSheet component with a mode toggle
 * (Edit / View), a customize panel trigger, and a back button.
 *
 * If the character has a background image configured, it is rendered as a
 * fixed full-viewport layer behind the sheet, with optional darken and blur
 * overlays controlled from the CustomizationPanel.
 */

import { useState } from 'react'
import { useCharacterStore } from '@/store/characterStore'
import CharacterSheet from '@/components/sheet/CharacterSheet'

export type SheetMode = 'edit' | 'view'

export default function CharacterSheetPage() {
  const currentCharacter = useCharacterStore((s) => s.currentCharacter)
  const closeCharacter = useCharacterStore((s) => s.closeCharacter)
  const [mode, setMode] = useState<SheetMode>('view')

  if (!currentCharacter) return null

  const { config } = currentCharacter
  const hasBg = !!config.backgroundImage

  return (
    <div
      className={
        'sheet-page' + (hasBg ? ' sheet-page--has-bg' : '')
      }
    >
      {hasBg && (
        <>
          <div
            className="sheet-page__bg-image"
            style={{
              backgroundImage: `url(${config.backgroundImage})`,
              filter:
                config.backgroundImageBlur > 0
                  ? `blur(${config.backgroundImageBlur}px)`
                  : undefined,
            }}
          />
          <div
            className="sheet-page__bg-overlay"
            style={{
              opacity: config.backgroundImageDarken,
            }}
          />
        </>
      )}

      <div className="sheet-page__content">
        <div className="sheet-page__toolbar">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={closeCharacter}
          >
            ← Back
          </button>
        </div>

        <CharacterSheet
          character={currentCharacter}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
    </div>
  )
}
