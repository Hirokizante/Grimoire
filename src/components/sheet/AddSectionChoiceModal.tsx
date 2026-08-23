/**
 * AddSectionChoiceModal — prompt users to choose between an Ability Block
 * section and an NPC Sheet section when they're adding a new section to a
 * custom tab.
 *
 * Follows the project's modal convention: overlay click or ✕ closes, Esc
 * closes via useEscapeKey, footer has Cancel + the two action buttons.
 */

import { ScrollText, User, FileText } from 'lucide-react'

import { useModalDialog } from '@/hooks/useModalDialog'
import type { LucideIcon } from 'lucide-react'

export type AddSectionChoice = 'ability' | 'npc' | 'text'

export interface AddSectionChoiceModalProps {
  open: boolean
  onChoose: (choice: AddSectionChoice) => void
  onClose: () => void
}

interface ChoiceOption {
  value: AddSectionChoice
  title: string
  description: string
  icon: LucideIcon
}

const OPTIONS: ChoiceOption[] = [
  {
    value: 'ability',
    title: 'Ability Block',
    description:
      'A free-form group of ability blocks. Use this for moves, equipment, or any custom list of abilities.',
    icon: ScrollText,
  },
  {
    value: 'npc',
    title: 'NPC Sheet',
    description:
      'A bundled NPC record with portrait, stats, attributes, skills, abilities, and description. Use this to attach an NPC directly to this character.',
    icon: User,
  },
  {
    value: 'text',
    title: 'Text',
    description:
      'A free-form Markdown body. Use this to describe unique character mechanics, or add flavor text and lore to your sheet.',
    icon: FileText,
  },
]

export default function AddSectionChoiceModal({
  open,
  onChoose,
  onClose,
}: AddSectionChoiceModalProps) {
  const dialogRef = useModalDialog(onClose, open)

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content add-section-choice-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Add a section"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Add a Section</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="add-section-choice-modal__body">
          <p className="add-section-choice-modal__hint">
            What kind of section do you want to add?
          </p>
          <div className="add-section-choice-modal__options">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  type="button"
                  className="add-section-choice-modal__option"
                  onClick={() => onChoose(opt.value)}
                >
                  <Icon
                    className="add-section-choice-modal__option-icon"
                    size={22}
                    strokeWidth={2}
                  />
                  <span className="add-section-choice-modal__option-title">
                    {opt.title}
                  </span>
                  <span className="add-section-choice-modal__option-description">
                    {opt.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
