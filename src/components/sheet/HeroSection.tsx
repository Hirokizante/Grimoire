/**
 * HeroSection — the top-of-sheet identity panel.
 */

import { Star, Paintbrush, ArrowUpFromLine } from 'lucide-react'

import PortraitUploader from '@/components/sheet/PortraitUploader'
import AttributesSection from '@/components/sheet/AttributesSection'
import StatsSection from '@/components/sheet/StatsSection'
import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface HeroSectionProps {
  character: Character
  mode?: SheetMode
  onLevelUp?: () => void
  onCustomize?: () => void
  onExport?: () => void
}

export default function HeroSection({ character, mode = 'view', onLevelUp, onCustomize, onExport }: HeroSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const setName = (value: string) =>
    update((c) => ({ ...c, name: value }))

  const setPortrait = (value: string) =>
    update((c) => ({ ...c, portrait: value }))

  return (
    <section className="hero-section sheet-section">
      <div className="hero-section__identity">
        {/* Level-up + Customize buttons — top-right corner of hero section */}
        <div className="hero-section__actions">
          {onLevelUp && (
            <button
              type="button"
              className="btn btn--primary sheet-levelup-btn"
              onClick={onLevelUp}
              title="Increase Milestone and apply bonuses (guided level-up)"
            >
              <Star size={14} strokeWidth={2.5} />
              Level Up
            </button>
          )}
          {onCustomize && (
            <button
              type="button"
              className="btn btn--primary sheet-customize-btn"
              onClick={onCustomize}
              title="Customize sheet appearance (colors, fonts, layout)"
            >
              <Paintbrush size={14} />
              Customize
            </button>
          )}
          {onExport && (
            <button
              type="button"
              className="btn btn--primary sheet-export-btn"
              onClick={onExport}
              title="Export character sheet as JSON or view version history"
            >
              <ArrowUpFromLine size={14} />
              Export
            </button>
          )}
        </div>

        <div className="hero-section__portrait-wrap">
          {character.portrait ? (
            <img
              className="hero-section__portrait"
              src={character.portrait}
              alt={character.name}
            />
          ) : (
            <div
              className="hero-section__portrait hero-section__portrait--empty"
              aria-hidden
            />
          )}
          {isEdit && (
            <PortraitUploader onUpdate={setPortrait} />
          )}
        </div>

        <div className="hero-section__name-area">
          {isEdit ? (
            <input
              type="text"
              className="sheet-input hero-section__name-input"
              value={character.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
            />
          ) : (
            <h2 className="hero-section__name">{character.name}</h2>
          )}
          <div className="hero-section__meta">
            {isEdit ? (
              <input
                type="text"
                className="sheet-input hero-section__player-input"
                value={character.playerName}
                onChange={(e) =>
                  update((c) => ({ ...c, playerName: e.target.value }))
                }
                placeholder="Player name"
              />
            ) : (
              <span className="hero-section__player">
                {character.playerName || '—'}
              </span>
            )}
            <span className="hero-section__version">
              v{character.version}
            </span>
          </div>
        </div>
      </div>

      <div className="hero-section__stats-row">
        <StatsSection character={character} mode={mode} variant="flat" />
        <AttributesSection character={character} attributes={character.attributes} mode={mode} variant="flat" />
      </div>
    </section>
  )
}
