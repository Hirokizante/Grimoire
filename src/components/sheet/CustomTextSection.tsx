/**
 * CustomTextSection — a user-created free-text section within a custom tab.
 *
 * Holds a single Markdown body so players can describe unique character
 * mechanics or drop in flavor text / lore. Functions like an AbilityBlock
 * description field: a plain `<textarea>` in edit mode, rendered Markdown
 * (with the shared click-to-roll dice highlighting) in view mode.
 *
 * Mirrors the heading/rename/delete chrome of the other custom sections but
 * carries no ability list and no NPC reference.
 */

import { useState } from 'react'
import { Pencil, Check, Trash2 } from 'lucide-react'

import ConfirmModal from '@/components/sheet/ConfirmModal'
import MarkdownText from '@/components/ui/MarkdownText'
import { useCharacterStore } from '@/store/characterStore'
import type { CustomTextSection as CustomTextSectionType } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CustomTextSectionProps {
  tabId: string
  section: CustomTextSectionType
  mode?: SheetMode
}

export default function CustomTextSection({
  tabId,
  section,
  mode = 'view',
}: CustomTextSectionProps) {
  const isEdit = mode === 'edit'
  const renameCustomSection = useCharacterStore((s) => s.renameCustomSection)
  const removeCustomSection = useCharacterStore((s) => s.removeCustomSection)
  const updateCustomTextSectionContent = useCharacterStore(
    (s) => s.updateCustomTextSectionContent,
  )

  const [renaming, setRenaming] = useState(false)
  const [sectionNameDraft, setSectionNameDraft] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const startRenameSection = () => {
    setSectionNameDraft(section.name)
    setRenaming(true)
  }
  const commitRenameSection = () => {
    if (sectionNameDraft.trim()) {
      renameCustomSection(tabId, section.id, sectionNameDraft.trim())
    }
    setRenaming(false)
  }
  const cancelRenameSection = () => {
    setRenaming(false)
  }

  return (
    <section className="sheet-section sheet-section--custom sheet-section--custom-text">
      <div className="sheet-section__heading-row">
        {isEdit && renaming ? (
          <span className="section-rename">
            <input
              type="text"
              className="sheet-input section-rename__input"
              value={sectionNameDraft}
              autoFocus
              onChange={(e) => setSectionNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRenameSection()
                if (e.key === 'Escape') cancelRenameSection()
              }}
            />
            <button
              type="button"
              className="btn btn--ghost section-rename__btn"
              onClick={commitRenameSection}
              aria-label="Confirm rename"
            >
              <Check size={14} />
            </button>
          </span>
        ) : (
          <span className="section-heading-wrap">
            <h3 className="sheet-section__heading">{section.name}</h3>
            {isEdit && (
              <button
                type="button"
                className="btn btn--ghost section-rename__trigger"
                onClick={startRenameSection}
                aria-label="Rename section"
              >
                <Pencil size={12} />
              </button>
            )}
          </span>
        )}
        <div className="sheet-section__heading-row-right">
          {isEdit && (
            <button
              type="button"
              className="btn btn--ghost section-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label={`Delete ${section.name} section`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {isEdit ? (
        <textarea
          className="sheet-textarea custom-text-section__textarea"
          value={section.content}
          onChange={(e) =>
            updateCustomTextSectionContent(tabId, section.id, e.target.value)
          }
          placeholder={
            'Describe unique mechanics, add flavor text or lore… ' +
            '(Markdown and dice notation like 1d6+POW supported)'
          }
          rows={6}
        />
      ) : section.content ? (
        <MarkdownText
          className="custom-text-section__body"
          mode={mode}
        >
          {section.content}
        </MarkdownText>
      ) : (
        <p className="sheet-section__empty muted">No text in this section.</p>
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Section?"
          message={
            <>
              Are you sure you want to delete <strong>{section.name}</strong> and
              all its text? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => removeCustomSection(tabId, section.id)}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </section>
  )
}
