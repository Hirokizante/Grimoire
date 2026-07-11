/**
 * ProfileSection — the character's identity panel: portrait, name, physical
 * description, and backstory (DESIGN.md "Character Portrait", "Physical
 * Description", "Backstory").
 *
 * Portraits are stored as base64 data URLs (offline-first, see DESIGN.md). If
 * no portrait is set, a placeholder block is shown so the layout stays stable.
 *
 * In edit mode the name becomes a text input, the description and backstory
 * become textareas, and a {@link PortraitUploader} is shown for the portrait.
 * All edits are persisted immediately via `updateCurrentCharacter`.
 */

import PortraitUploader from '@/components/sheet/PortraitUploader'
import { useCharacterStore } from '@/store/characterStore'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface ProfileSectionProps {
  name: string
  portrait: string | null
  physicalDescription: string
  backstory: string
  mode?: SheetMode
}

export default function ProfileSection({
  name,
  portrait,
  physicalDescription,
  backstory,
  mode = 'view',
}: ProfileSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const setName = (value: string) =>
    update((c) => ({ ...c, name: value }))

  const setPhysicalDescription = (value: string) =>
    update((c) => ({ ...c, physicalDescription: value }))

  const setBackstory = (value: string) =>
    update((c) => ({ ...c, backstory: value }))

  const setPortrait = (value: string) =>
    update((c) => ({ ...c, portrait: value }))

  return (
    <section className="sheet-section sheet-section--profile">
      <div className="profile">
        <div className="profile__portrait-wrap">
          {portrait ? (
            <img
              className="profile__portrait"
              src={portrait}
              alt={name}
            />
          ) : (
            <div
              className="profile__portrait profile__portrait--empty"
              aria-hidden
            />
          )}
          {isEdit && (
            <PortraitUploader onUpdate={setPortrait} />
          )}
        </div>

        <div className="profile__body">
          {isEdit ? (
            <input
              type="text"
              className="sheet-input profile__name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
            />
          ) : (
            <h2 className="profile__name">{name}</h2>
          )}

          {isEdit || physicalDescription ? (
            <div className="profile__block">
              <span className="profile__block-label">
                Physical Description
              </span>
              {isEdit ? (
                <textarea
                  className="sheet-textarea"
                  value={physicalDescription}
                  onChange={(e) => setPhysicalDescription(e.target.value)}
                  placeholder="Describe the character's appearance…"
                  rows={3}
                />
              ) : (
                <p className="profile__text">{physicalDescription}</p>
              )}
            </div>
          ) : null}

          {isEdit || backstory ? (
            <div className="profile__block">
              <span className="profile__block-label">Backstory</span>
              {isEdit ? (
                <textarea
                  className="sheet-textarea"
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  placeholder="Origins, history, motivations…"
                  rows={5}
                />
              ) : (
                <p className="profile__text">{backstory}</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
