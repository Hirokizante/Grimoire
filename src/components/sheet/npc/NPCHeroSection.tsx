/**
 * NPCHeroSection — the top-of-sheet identity panel for NPCs.
 *
 * Similar to the CharacterSheet's HeroSection but simpler:
 *   - No Level Up button (NPCs have no milestones)
 *   - No Customize button (NPCs have no theme customization)
 *   - Export button is present
 *   - No player name field
 *   - Portrait + Name only
 */

import { ArrowUpFromLine } from 'lucide-react'

import PortraitUploader from '@/components/sheet/PortraitUploader'
import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface NPCHeroSectionProps {
  npc: Character
  mode?: SheetMode
  onExport?: () => void
}

export default function NPCHeroSection({
  npc,
  mode = 'view',
  onExport,
}: NPCHeroSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const setName = (value: string) =>
    update((c) => ({ ...c, name: value }))

  const setPortrait = (value: string) =>
    update((c) => ({ ...c, portrait: value }))

  return (
    <section className="hero-section sheet-section">
      <div className="hero-section__identity">
        {/* Export button — top-right corner of hero section */}
        <div className="hero-section__actions">
          {onExport && (
            <button
              type="button"
              className="btn btn--primary sheet-export-btn"
              onClick={onExport}
              title="Export NPC sheet as JSON"
            >
              <ArrowUpFromLine size={14} />
              Export
            </button>
          )}
        </div>

        <div className="hero-section__portrait-wrap">
          {npc.portrait ? (
            <img
              className="hero-section__portrait"
              src={npc.portrait}
              alt={npc.name}
            />
          ) : (
            <div
              className="hero-section__portrait hero-section__portrait--empty"
              aria-hidden
            />
          )}
          {isEdit && <PortraitUploader onUpdate={setPortrait} />}
        </div>

        <div className="hero-section__name-area">
          {isEdit ? (
            <input
              type="text"
              className="sheet-input hero-section__name-input"
              value={npc.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NPC name"
            />
          ) : (
            <h2 className="hero-section__name">{npc.name}</h2>
          )}
          <div className="hero-section__meta">
            <span className="hero-section__version">
              v{npc.version}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
