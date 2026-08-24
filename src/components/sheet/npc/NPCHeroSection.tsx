/**
 * NPCHeroSection — the top-of-sheet identity panel for NPCs.
 *
 * Similar to the CharacterSheet's HeroSection but simpler:
 *   - No Level Up button (NPCs have no milestones)
 *   - No Customize button (NPCs have no theme customization)
 *   - Export button is present
 *   - No player name field
 *   - Portrait + Name only
 *
 * Like the player HeroSection, combat stats and attributes are embedded
 * inside the hero section — stats as flat stat tokens, attributes as a
 * horizontal row of D&D 5e-style attribute boxes.
 */

import { useState } from 'react'
import { ArrowUpFromLine } from 'lucide-react'

import PortraitUploader from '@/components/sheet/PortraitUploader'
import SheetLabelPills from '@/components/sheet/SheetLabelPills'
import EditLabelsModal from '@/components/sheet/EditLabelsModal'
import NPCStatsSection from '@/components/sheet/npc/NPCStatsSection'
import AttributesSection from '@/components/sheet/AttributesSection'
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
  const setLabels = useCharacterStore((s) => s.setLabels)
  const isEdit = mode === 'edit'
  const [showLabelEditor, setShowLabelEditor] = useState(false)

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

      {/* Labels — under the Export button. The edit button is edit-mode only
          (matches the other dashed add buttons). */}
      {(npc.labels.length > 0 || isEdit) && (
        <div className="hero-section__labels-row">
          <SheetLabelPills labels={npc.labels} />
          {isEdit && (
            <button
              type="button"
              className="btn btn--ghost section-add-btn"
              onClick={() => setShowLabelEditor(true)}
              aria-label={
                npc.labels.length === 0 ? 'Add labels' : 'Edit labels'
              }
            >
              {npc.labels.length === 0 ? '+ Add Label' : 'Edit Labels'}
            </button>
          )}
        </div>
      )}

      {showLabelEditor && (
        <EditLabelsModal
          labels={npc.labels}
          onSave={setLabels}
          onClose={() => setShowLabelEditor(false)}
        />
      )}

      <div className="hero-section__stats-col">
        <NPCStatsSection npc={npc} mode={mode} variant="flat" />
        <AttributesSection
          character={npc}
          attributes={npc.attributes}
          mode={mode}
          variant="flat-row"
        />
      </div>
    </section>
  )
}
