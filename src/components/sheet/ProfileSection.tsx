/**
 * ProfileSection — the bottom "Bio" section of the sheet.
 *
 * Contains Physical Description and Backstory — the least frequently
 * referenced parts of the sheet, placed at the very bottom per the layout
 * hierarchy.
 *
 * The character portrait and name are rendered in the HeroSection at the
 * top of the sheet; this component no longer handles them.
 *
 * In edit mode the description and backstory become textareas.
 * All edits are persisted immediately via `updateCurrentCharacter`.
 */

import { useCharacterStore } from '@/store/characterStore'
import MarkdownText from '@/components/ui/MarkdownText'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface ProfileSectionProps {
  physicalDescription: string
  backstory: string
  mode?: SheetMode
}

export default function ProfileSection({
  physicalDescription,
  backstory,
  mode = 'view',
}: ProfileSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const setPhysicalDescription = (value: string) =>
    update((c) => ({ ...c, physicalDescription: value }))

  const setBackstory = (value: string) =>
    update((c) => ({ ...c, backstory: value }))

  return (
    <section className="sheet-section sheet-section--bio">
      <h3 className="sheet-section__heading">Character Background</h3>

      {(isEdit || physicalDescription) && (
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
            <MarkdownText className="profile__text">
              {physicalDescription}
            </MarkdownText>
          )}
        </div>
      )}

      {(isEdit || backstory) && (
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
            <MarkdownText className="profile__text">{backstory}</MarkdownText>
          )}
        </div>
      )}
    </section>
  )
}
