/**
 * CustomNPCSection — renders a user-attached NPC sheet inside a custom tab
 * of a character sheet.
 *
 * Mirrors the per-section experience of the full NPC sheet (portrait, stats,
 * attributes, abilities, skills, description) but in a compact inline layout
 * that fits inside a tab section. The user can edit the NPC in place when the
 * sheet is in edit mode.
 *
 * The NPC is stored as a standalone Character record (kind='npc') in the
 * shared `characters` IndexedDB store. Edits target that NPC record directly
 * via the store's NPC patching helper, then persist via the shared db layer.
 */

import { useState } from 'react'
import { Pencil, Check, Trash2 } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import { putCharacter } from '@/lib/db'
import PortraitUploader from '@/components/sheet/PortraitUploader'
import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import MarkdownText from '@/components/ui/MarkdownText'
import { ATTRIBUTE_LIST, SKILL_LIST } from '@/constants/gameData'
import type {
  AbilityBlock,
  AttributeKey,
  Character,
  CustomNPCSection as CustomNPCSectionType,
  NPCStats,
  SkillName,
} from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CustomNPCSectionProps {
  tabId: string
  section: CustomNPCSectionType
  mode?: SheetMode
}

const STAT_COLORS = {
  evasion: '#e85a8a',
  armor: '#7bc4d6',
  movement: '#e8b04a',
  saveDC: '#9b7ed6',
  hp: '#e85252',
} as const

interface StatCardMeta {
  label: string
  key: keyof NPCStats
  color: string
}

const STATS: StatCardMeta[] = [
  { label: 'Evasion', key: 'evasion', color: STAT_COLORS.evasion },
  { label: 'Armor', key: 'armor', color: STAT_COLORS.armor },
  { label: 'Movement', key: 'movement', color: STAT_COLORS.movement },
  { label: 'Save DC', key: 'saveDC', color: STAT_COLORS.saveDC },
  { label: 'HP', key: 'hp', color: STAT_COLORS.hp },
]

const DEFAULT_NPC_STATS: NPCStats = {
  evasion: 10,
  armor: 0,
  movement: 5,
  saveDC: 10,
  hp: 20,
}

/**
 * Patch the attached NPC record (Character with kind='npc') in the store's
 * characters list and persist it to IndexedDB. The parent character's
 * `currentCharacter` slot is left untouched — this is the only sensible
 * behavior since the section is owned by the parent.
 */
function updateAttachedNPC(
  npcId: string,
  updater: (npc: Character) => Character,
): void {
  const store = useCharacterStore.getState()
  const target = store.characters.find((c) => c.id === npcId)
  if (!target) return
  const updated = updater(target)
  useCharacterStore.setState((state) => ({
    characters: state.characters.map((c) =>
      c.id === npcId ? updated : c,
    ),
  }))
  // Persist asynchronously; failures are surfaced via the store's isSaving.
  void putCharacter(updated).catch(() => {
    // Best-effort persistence; the in-memory update is already applied.
  })
}

export default function CustomNPCSection({
  tabId,
  section,
  mode = 'view',
}: CustomNPCSectionProps) {
  const isEdit = mode === 'edit'
  const characters = useCharacterStore((s) => s.characters)
  const removeCustomSection = useCharacterStore((s) => s.removeCustomSection)
  const renameCustomSection = useCharacterStore((s) => s.renameCustomSection)

  const npc = characters.find((c) => c.id === section.npcId) ?? null

  const [renaming, setRenaming] = useState(false)
  const [sectionNameDraft, setSectionNameDraft] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAbilityEditor, setShowAbilityEditor] = useState(false)
  const [editingAbility, setEditingAbility] = useState<AbilityBlock | null>(null)
  const [abilityToRemove, setAbilityToRemove] = useState<
    { id: string; name: string } | null
  >(null)

  if (!npc) {
    return (
      <section className="sheet-section sheet-section--custom sheet-section--npc-missing">
        <div className="sheet-section__heading-row">
          <h3 className="sheet-section__heading">{section.name}</h3>
        </div>
        <p className="sheet-section__empty muted">
          The attached NPC record could not be found. It may have been deleted.
        </p>
      </section>
    )
  }

  const startRename = () => {
    setSectionNameDraft(section.name)
    setRenaming(true)
  }
  const commitRename = () => {
    if (sectionNameDraft.trim()) {
      renameCustomSection(tabId, section.id, sectionNameDraft.trim())
    }
    setRenaming(false)
  }

  const setNpcField = <K extends keyof Character>(
    key: K,
    value: Character[K],
  ) => {
    updateAttachedNPC(npc.id, (cur) => ({ ...cur, [key]: value }))
  }

  const setNpcStat = (key: keyof NPCStats, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    updateAttachedNPC(npc.id, (cur) => ({
      ...cur,
      npcStats: {
        ...DEFAULT_NPC_STATS,
        ...(cur.npcStats ?? {}),
        [key]: n,
      },
    }))
  }

  const setAttr = (key: AttributeKey, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    updateAttachedNPC(npc.id, (cur) => ({
      ...cur,
      attributes: { ...cur.attributes, [key]: n },
    }))
  }

  const setSkill = (skill: SkillName, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    updateAttachedNPC(npc.id, (cur) => ({
      ...cur,
      skills: { ...cur.skills, [skill]: n },
    }))
  }

  const openNewAbility = () => {
    setEditingAbility(null)
    setShowAbilityEditor(true)
  }
  const openEditAbility = (ability: AbilityBlock) => {
    setEditingAbility(ability)
    setShowAbilityEditor(true)
  }
  const handleSaveAbility = (ability: AbilityBlock) => {
    updateAttachedNPC(npc.id, (cur) => {
      const existing = cur.slottedAbilities
      if (
        editingAbility &&
        existing.some((a) => a.id === editingAbility.id)
      ) {
        return {
          ...cur,
          slottedAbilities: existing.map((a) =>
            a.id === editingAbility.id ? ability : a,
          ),
        }
      }
      return {
        ...cur,
        slottedAbilities: [...existing, ability],
      }
    })
    setShowAbilityEditor(false)
    setEditingAbility(null)
  }
  const handleRemoveAbility = (abilityId: string) => {
    const ability = npc.slottedAbilities.find((a) => a.id === abilityId)
    if (!ability) return
    setAbilityToRemove({ id: abilityId, name: ability.name })
  }
  const handleConfirmRemoveAbility = () => {
    if (!abilityToRemove) return
    updateAttachedNPC(npc.id, (cur) => ({
      ...cur,
      slottedAbilities: cur.slottedAbilities.filter(
        (a) => a.id !== abilityToRemove.id,
      ),
    }))
    setAbilityToRemove(null)
  }

  const description = npc.description ?? ''

  return (
    <section className="sheet-section sheet-section--custom sheet-section--custom-npc">
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
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenaming(false)
              }}
            />
            <button
              type="button"
              className="btn btn--ghost section-rename__btn"
              onClick={commitRename}
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
                onClick={startRename}
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

      <div className="custom-npc-section">
        {/* Identity row: portrait + name + version */}
        <div className="custom-npc-section__identity">
          <div className="custom-npc-section__portrait-wrap">
            {npc.portrait ? (
              <img
                className="custom-npc-section__portrait"
                src={npc.portrait}
                alt={npc.name}
              />
            ) : (
              <div
                className="custom-npc-section__portrait custom-npc-section__portrait--empty"
                aria-hidden
              />
            )}
            {isEdit && (
              <PortraitUploader
                onUpdate={(dataUrl) => setNpcField('portrait', dataUrl)}
                label="Portrait"
              />
            )}
          </div>
          <div className="custom-npc-section__name-area">
            {isEdit ? (
              <input
                type="text"
                className="sheet-input custom-npc-section__name-input"
                value={npc.name}
                onChange={(e) => setNpcField('name', e.target.value)}
                placeholder="NPC name"
              />
            ) : (
              <h4 className="custom-npc-section__name">{npc.name}</h4>
            )}
            <span className="custom-npc-section__version">v{npc.version}</span>
          </div>
        </div>

        {/* Combat stats — compact token row */}
        <div className="custom-npc-section__stats">
          {STATS.map((token) => {
            const value = npc.npcStats?.[token.key] ?? 0
            return (
              <div
                key={token.label}
                className="custom-npc-stat"
                style={
                  { '--npc-stat-color': token.color } as React.CSSProperties
                }
              >
                <span className="custom-npc-stat__stripe" />
                <span className="custom-npc-stat__label">{token.label}</span>
                {isEdit ? (
                  <input
                    type="number"
                    className="sheet-input custom-npc-stat__input"
                    value={value}
                    onChange={(e) => setNpcStat(token.key, e.target.value)}
                    min={0}
                  />
                ) : (
                  <span className="custom-npc-stat__value">{value}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Attributes — compact inline list */}
        <div className="custom-npc-section__block">
          <h5 className="custom-npc-section__block-heading">Attributes</h5>
          <ul className="custom-npc-section__attr-list" role="list">
            {ATTRIBUTE_LIST.map((attr) => {
              const value = npc.attributes[attr.key]
              return (
                <li
                  key={attr.key}
                  className="custom-npc-section__attr-item"
                >
                  <span className="custom-npc-section__attr-abbr">
                    {attr.abbreviation}
                  </span>
                  {isEdit ? (
                    <input
                      type="number"
                      className="sheet-input custom-npc-section__attr-input"
                      min={-1}
                      max={8}
                      value={value}
                      onChange={(e) => setAttr(attr.key, e.target.value)}
                    />
                  ) : (
                    <span
                      className="custom-npc-section__attr-value"
                      title={attr.description}
                    >
                      {value >= 0 ? `+${value}` : value}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {/* Skills — compact horizontal list */}
        <div className="custom-npc-section__block">
          <h5 className="custom-npc-section__block-heading">Skills</h5>
          <ul className="custom-npc-section__skill-list" role="list">
            {SKILL_LIST.map((skill) => {
              const value = npc.skills[skill]
              return (
                <li key={skill} className="custom-npc-section__skill-item">
                  <span className="custom-npc-section__skill-name">{skill}</span>
                  {isEdit ? (
                    <input
                      type="number"
                      className="sheet-input custom-npc-section__skill-input"
                      min={0}
                      max={6}
                      step={2}
                      value={value}
                      onChange={(e) => setSkill(skill, e.target.value)}
                    />
                  ) : (
                    <span
                      className={
                        'custom-npc-section__skill-value' +
                        (value > 0
                          ? ' custom-npc-section__skill-value--active'
                          : '')
                      }
                    >
                      {value > 0 ? `+${value}` : value}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {/* Abilities — compact cards, no Activate button, edit-mode Edit/Remove */}
        <div className="custom-npc-section__block">
          <div className="custom-npc-section__block-heading custom-npc-section__block-heading--row">
            <h5 className="custom-npc-section__block-heading">Abilities</h5>
            {isEdit && (
              <button
                type="button"
                className="btn btn--ghost section-add-btn"
                onClick={openNewAbility}
              >
                + Add Ability
              </button>
            )}
          </div>
          {npc.slottedAbilities.length === 0 ? (
            <p className="sheet-section__empty muted">
              {isEdit
                ? 'No abilities yet — click "Add Ability" to create one.'
                : 'No abilities defined for this NPC.'}
            </p>
          ) : (
            <div className="custom-npc-section__abilities">
              {npc.slottedAbilities.map((ability) => (
                <AbilityBlockCard
                  key={ability.id}
                  ability={ability}
                  mode={mode}
                  actions={
                    isEdit ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost ability-card__action-btn"
                          onClick={() => openEditAbility(ability)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                          onClick={() => handleRemoveAbility(ability.id)}
                        >
                          Remove
                        </button>
                      </>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="custom-npc-section__block">
          <h5 className="custom-npc-section__block-heading">Description</h5>
          {isEdit ? (
            <textarea
              className="sheet-textarea"
              value={description}
              onChange={(e) => setNpcField('description', e.target.value)}
              placeholder="Describe the NPC — appearance, personality, behavior, lore…"
              rows={4}
            />
          ) : description ? (
            <MarkdownText className="custom-npc-section__description">
              {description}
            </MarkdownText>
          ) : (
            <p className="sheet-section__empty muted">No description.</p>
          )}
        </div>
      </div>

      <AbilityEditorModal
        ability={editingAbility}
        open={showAbilityEditor}
        onSave={handleSaveAbility}
        onClose={() => {
          setShowAbilityEditor(false)
          setEditingAbility(null)
        }}
      />

      {abilityToRemove && (
        <ConfirmModal
          title="Remove Ability?"
          message={
            <>
              Are you sure you want to remove{' '}
              <strong>{abilityToRemove.name || 'Untitled Ability'}</strong> from
              this NPC? This cannot be undone.
            </>
          }
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmRemoveAbility}
          onClose={() => setAbilityToRemove(null)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete NPC Section?"
          message={
            <>
              Are you sure you want to delete <strong>{section.name}</strong>?
              The attached NPC record will also be removed. This cannot be
              undone.
            </>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => {
            setShowDeleteConfirm(false)
            void removeCustomSection(tabId, section.id)
          }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </section>
  )
}
