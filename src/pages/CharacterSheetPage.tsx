/**
 * CharacterSheetPage — wraps the CharacterSheet component with a mode toggle
 * (Edit / View) and a back button. Edit mode makes all fields editable;
 * View mode locks editing but allows live-session interactivity.
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

  return (
    <div className="sheet-page">
      <div className="sheet-page__toolbar">
        <button
          className="btn btn--ghost"
          type="button"
          onClick={closeCharacter}
        >
          ← Back
        </button>

        <div className="mode-toggle" role="tablist" aria-label="Sheet mode">
          <button
            className={'mode-toggle__btn' + (mode === 'view' ? ' mode-toggle__btn--active' : '')}
            type="button"
            role="tab"
            aria-selected={mode === 'view'}
            onClick={() => setMode('view')}
          >
            View
          </button>
          <button
            className={'mode-toggle__btn' + (mode === 'edit' ? ' mode-toggle__btn--active' : '')}
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
        </div>
      </div>

      <CharacterSheet character={currentCharacter} mode={mode} />
    </div>
  )
}
