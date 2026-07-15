/**
 * CustomTabContent — renders the content of a user-created tab.
 *
 * Shows all custom ability sections within the tab, wrapped in a DnD context for
 * cross-section drag-and-drop. Includes a tab-level grid/list view toggle and
 * an "Add Section" button (edit mode only).
 */

import CustomAbilitySection from '@/components/sheet/CustomAbilitySection'
import CustomTabDndContext from '@/components/sheet/CustomTabDndContext'
import { useCharacterStore } from '@/store/characterStore'
import type { CustomTab } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CustomTabContentProps {
  tab: CustomTab
  mode?: SheetMode
}

export default function CustomTabContent({
  tab,
  mode = 'view',
}: CustomTabContentProps) {
  const isEdit = mode === 'edit'
  const addCustomSection = useCharacterStore((s) => s.addCustomSection)
  const updateCustomSectionViewMode = useCharacterStore((s) => s.updateCustomSectionViewMode)
  const tabViewModes = useCharacterStore(
    (s) => s.currentCharacter?.viewModes.customTabs[tab.id] ?? {},
  )

  const handleViewModeChange = (sectionId: string, mode: 'grid' | 'list') => {
    updateCustomSectionViewMode(tab.id, sectionId, mode)
  }

  return (
    <CustomTabDndContext tabId={tab.id}>
      <div className="custom-tab-content">
        {tab.sections.length === 0 ? (
          <div className="custom-tab-content__empty">
            <p className="sheet-section__empty muted">
              {isEdit
                ? 'This tab is empty. Add a section to start creating abilities.'
                : 'This tab has no sections.'}
            </p>
          </div>
        ) : (
          tab.sections.map((section) => (
              <CustomAbilitySection
                key={section.id}
                tabId={tab.id}
                section={section}
                mode={mode}
                viewMode={tabViewModes[section.id] ?? 'grid'}
                onViewModeChange={(m) => handleViewModeChange(section.id, m)}
              />
            ))
        )}

        {isEdit && (
          <button
            type="button"
            className="btn btn--ghost custom-tab-content__add-section"
            onClick={() => addCustomSection(tab.id)}
          >
            + Add Section
          </button>
        )}
      </div>
    </CustomTabDndContext>
  )
}
