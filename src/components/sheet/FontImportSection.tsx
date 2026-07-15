/**
 * FontImportSection — type a Google Fonts family name to import it.
 *
 * Renders inside the "Fonts" section of the CustomizationPanel. The user types
 * any Google Fonts family name and clicks Import (or presses Enter). The font
 * is added to `config.importedFonts` and becomes available in every FontPicker
 * dropdown and quick-pick grid.
 */

import { useState } from 'react'
import { useCharacterStore } from '@/store/characterStore'
import { generateId } from '@/constants/gameData'
import type { ImportedFont } from '@/types'

/** Google Fonts weights we request for every import. */
const DEFAULT_WEIGHTS = 'wght@400;600;700'

const EMPTY_FONT_ARRAY: never[] = []

/** Build a Google Fonts CSS2 API "family" param from a raw font name. */
function buildApiParams(family: string): string {
  const cleaned = family.trim().replace(/\s+/g, '+')
  return `family=${cleaned}:${DEFAULT_WEIGHTS}&display=swap&fallback=sans-serif`
}

export function FontImportSection() {
  const importedFonts = useCharacterStore(
    (s) => s.currentCharacter?.config.importedFonts ?? EMPTY_FONT_ARRAY,
  )
  const updateConfig = useCharacterStore((s) => s.updateConfig)

  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const isImported = (label: string) =>
    importedFonts.some((f) => f.family.toLowerCase() === label.toLowerCase())

  const handleImport = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a font name.')
      return
    }
    if (isImported(trimmed)) {
      setError(`"${trimmed}" is already imported.`)
      return
    }
    if (/[^a-zA-Z0-9_+,\- ]/.test(trimmed)) {
      setError('Only letters, numbers, spaces, and +,-_ allowed.')
      return
    }
    const newFont: ImportedFont = {
      id: generateId(),
      family: trimmed,
      apiParams: buildApiParams(trimmed),
      category: 'sans',
    }
    updateConfig((c) => ({
      ...c,
      importedFonts: [...c.importedFonts, newFont],
    }))
    setName('')
    setError('')
  }

  const handleRemove = (id: string) => {
    updateConfig((c) => ({
      ...c,
      importedFonts: c.importedFonts.filter((f) => f.id !== id),
    }))
  }

  return (
    <div className="customize__field customize__font-import">
      <span className="customize__label-text">Custom Font</span>
      <div className="customize__font-import-row">
        <input
          type="text"
          className="sheet-input customize__font-import-input"
          placeholder="e.g. Cinzel, Roboto Mono"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleImport()
          }}
        />
        <button
          type="button"
          className="btn btn--primary customize__font-import-add"
          onClick={handleImport}
        >
          Import
        </button>
      </div>

      {error && <p className="customize__font-import-error">{error}</p>}

      {importedFonts.length > 0 && (
        <div className="customize__font-imported">
          <span className="customize__label-text">Imported fonts</span>
          <div className="customize__font-imported-list">
            {importedFonts.map((f) => (
              <span key={f.id} className="customize__font-imported-chip">
                {f.family}
                <button
                  type="button"
                  className="customize__font-imported-remove"
                  onClick={() => handleRemove(f.id)}
                  aria-label={`Remove ${f.family}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
