/**
 * CustomTabContent — renders the content of a user-created tab.
 *
 * Shows all custom sections within the tab, wrapped in a DnD context for
 * cross-section drag-and-drop (ability sections only). Includes an
 * "Add Section" button in edit mode that opens a chooser modal so the user
 * can pick between an Ability Block section and an NPC Sheet section.
 */

import { useState } from 'react'

import CustomAbilitySection from '@/components/sheet/CustomAbilitySection'
import CustomNPCSection from '@/components/sheet/CustomNPCSection'
import CustomTabDndContext from '@/components/sheet/CustomTabDndContext'
import AddSectionChoiceModal, {
  type AddSectionChoice,
} from '@/components/sheet/AddSectionChoiceModal'
import { useCharacterStore } from '@/store/characterStore'
import type { CustomTab } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CustomTabContentProps {
  tab: CustomTab
  mode?: SheetMode
}

/** Stable empty object so the selector below returns a consistent reference. */
const EMPTY_TAB_VIEW_MODES: Record<string, 'grid' | 'list'> = {}

export default function CustomTabContent({
  tab,
  mode = 'view',
}: CustomTabContentProps) {
  const isEdit = mode === 'edit'
  const addCustomSection = useCharacterStore((s) => s.addCustomSection)
  const addCustomNPCSection = useCharacterStore((s) => s.addCustomNPCSection)
  const updateCustomSectionViewMode = useCharacterStore(
    (s) => s.updateCustomSectionViewMode,
  )
  const tabViewModes = useCharacterStore(
    (s) => s.currentCharacter?.viewModes.customTabs[tab.id] ?? EMPTY_TAB_VIEW_MODES,
  )

  const [showAddSection, setShowAddSection] = useState(false)

  const handleViewModeChange = (sectionId: string, mode: 'grid' | 'list') => {
    updateCustomSectionViewMode(tab.id, sectionId, mode)
  }

  const handleSectionChoice = (choice: AddSectionChoice) => {
    setShowAddSection(false)
    if (choice === 'ability') {
      addCustomSection(tab.id)
    } else {
      addCustomNPCSection(tab.id)
    }
  }

  return (
    <CustomTabDndContext tabId={tab.id}>
      <div className="custom-tab-content">
        {tab.sections.length === 0 ? (
          <div className="custom-tab-content__empty">
            <p className="sheet-section__empty muted">
              {isEdit
                ? 'This tab is empty. Add a section to start creating abilities or attach an NPC.'
                : 'This tab has no sections.'}
            </p>
          </div>
        ) : (
          tab.sections.map((section) => {
            if (section.kind === 'npc') {
              return (
                <CustomNPCSection
                  key={section.id}
                  tabId={tab.id}
                  section={section}
                  mode={mode}
                />
              )
            }
            return (
              <CustomAbilitySection
                key={section.id}
                tabId={tab.id}
                section={section}
                mode={mode}
                viewMode={tabViewModes[section.id] ?? 'grid'}
                onViewModeChange={(m) => handleViewModeChange(section.id, m)}
              />
            )
          })
        )}

        {isEdit && (
          <button
            type="button"
            className="btn btn--ghost custom-tab-content__add-section"
            onClick={() => setShowAddSection(true)}
          >
            + Add Section
          </button>
        )}
      </div>

      <AddSectionChoiceModal
        open={showAddSection}
        onChoose={handleSectionChoice}
        onClose={() => setShowAddSection(false)}
      />
    </CustomTabDndContext>
  )
}
