/**
 * NPCDescriptionSection — the long-form description field for an NPC.
 *
 * Similar to the CharacterSheet's ProfileSection but with a single
 * "Description" field instead of Physical Description + Backstory.
 *
 * In edit mode the description becomes a textarea.
 * In view mode the description is rendered as Markdown.
 */

import { useCharacterStore } from '@/store/characterStore'
import MarkdownText from '@/components/ui/MarkdownText'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface NPCDescriptionSectionProps {
  npc: Character
  mode?: SheetMode
}

export default function NPCDescriptionSection({
  npc,
  mode = 'view',
}: NPCDescriptionSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'
  const description = npc.description ?? ''

  const setDescription = (value: string) =>
    update((c) => ({ ...c, description: value }))

  return (
    <section className="sheet-section sheet-section--bio">
      <h3 className="sheet-section__heading">Description</h3>

      {(isEdit || description) && (
        <div className="profile__block">
          {isEdit ? (
            <textarea
              className="sheet-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the NPC — appearance, personality, behavior, lore…"
              rows={5}
            />
          ) : (
            <MarkdownText className="profile__text">
              {description}
            </MarkdownText>
          )}
        </div>
      )}
    </section>
  )
}
