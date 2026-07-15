/**
 * TabBar — folder-tab navigation rendered above the HeroSection inside the
 * CharacterSheet.
 *
 * The first tab ("Main") is implicit and always present — it shows the default
 * sheet layout (Hero, Core Ability, Slotted Abilities, etc.). Additional tabs
 * are user-created via the "+" button and fully editable (rename, delete).
 *
 * In edit mode, each custom tab shows inline rename and delete controls. The
 * tab bar is hidden entirely in view mode when there are no custom tabs.
 */

import { useState } from 'react'
import { Plus, X, Check, Pencil } from 'lucide-react'
import { useCharacterStore } from '@/store/characterStore'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface TabBarProps {
  /** Currently active tab id ('main' for the built-in tab). */
  activeTab: string
  /** Switch to a different tab. */
  onTabChange: (tabId: string) => void
  mode?: SheetMode
}

export default function TabBar({
  activeTab,
  onTabChange,
  mode = 'view',
}: TabBarProps) {
  const isEdit = mode === 'edit'
  const customTabs = useCharacterStore((s) => s.currentCharacter?.customTabs ?? [])
  const addCustomTab = useCharacterStore((s) => s.addCustomTab)
  const renameCustomTab = useCharacterStore((s) => s.renameCustomTab)
  const removeCustomTab = useCharacterStore((s) => s.removeCustomTab)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  // Hide tab bar entirely when there are no custom tabs and not in edit mode.
  if (customTabs.length === 0 && !isEdit) return null

  const startRename = (id: string, currentName: string) => {
    setEditingId(id)
    setDraftName(currentName)
  }

  const commitRename = () => {
    if (editingId && draftName.trim()) {
      renameCustomTab(editingId, draftName.trim())
    }
    setEditingId(null)
    setDraftName('')
  }

  const cancelRename = () => {
    setEditingId(null)
    setDraftName('')
  }

  const handleAddTab = () => {
    const newId = addCustomTab()
    if (!newId) return // at MAX_CUSTOM_TABS limit
    onTabChange(newId)
    // Auto-enter rename mode for the new tab.
    setEditingId(newId)
    setDraftName('New Tab')
  }

  const handleRemoveTab = (tabId: string) => {
    removeCustomTab(tabId)
    if (activeTab === tabId) {
      onTabChange('main')
    }
  }

  return (
    <div className="tab-bar" role="tablist" aria-label="Character sheet tabs">
      {/* Main tab — always present */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'main'}
        className={
          'tab-bar__tab' + (activeTab === 'main' ? ' tab-bar__tab--active' : '')
        }
        onClick={() => onTabChange('main')}
      >
        Main
      </button>

      {/* Custom tabs */}
      {customTabs.map((tab) => (
        <div
          key={tab.id}
          className={
            'tab-bar__tab' +
            (activeTab === tab.id ? ' tab-bar__tab--active' : '')
          }
        >
          {isEdit && editingId === tab.id ? (
            <span className="tab-bar__rename">
              <input
                type="text"
                className="sheet-input tab-bar__rename-input"
                value={draftName}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') cancelRename()
                }}
              />
              <button
                type="button"
                className="btn btn--ghost tab-bar__rename-btn"
                onClick={commitRename}
                aria-label="Confirm rename"
              >
                <Check size={14} />
              </button>
            </span>
          ) : (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className="tab-bar__tab-label"
                onClick={() => onTabChange(tab.id)}
              >
                {tab.name}
              </button>
              {isEdit && (
                <span className="tab-bar__tab-actions">
                  <button
                    type="button"
                    className="btn btn--ghost tab-bar__tab-action-btn"
                    onClick={() => startRename(tab.id, tab.name)}
                    aria-label="Rename tab"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost tab-bar__tab-action-btn tab-bar__tab-action-btn--danger"
                    onClick={() => handleRemoveTab(tab.id)}
                    aria-label="Delete tab"
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
            </>
          )}
        </div>
      ))}

      {/* Add tab button — edit mode only */}
      {isEdit && (
        <button
          type="button"
          className="tab-bar__add-btn"
          onClick={handleAddTab}
          disabled={customTabs.length >= 6}
          aria-label="Add new tab"
          title={customTabs.length >= 6 ? 'Maximum of 6 custom tabs' : 'Add new tab'}
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  )
}
