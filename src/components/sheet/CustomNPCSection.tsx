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
 * shared `characters` IndexedDB store. The plain fields (stats, attributes,
 * skills, description, portrait) patch that record through
 * {@link updateAttachedNPC}; the abilities block is the shared
 * {@link NPCAbilitiesSection} in its `embedded` variant, which writes through
 * the store's id-targeted `updateCharacter` — the same path the NPC's own
 * sheet page uses, so the two surfaces can never behave differently.
 */

import { useState } from 'react'
import { Trash2, Wind, Shield, Footprints, Target, Heart, Skull } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import { putCharacter } from '@/lib/db'
import PortraitUploader from '@/components/sheet/PortraitUploader'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import MarkdownText from '@/components/ui/MarkdownText'
import { ATTRIBUTE_LIST, SKILL_LIST } from '@/constants/gameData'
import {
  DEFAULT_NPC_STATS,
  effectiveAttributes,
  effectiveNPCStats,
  formatModifierValue,
} from '@/lib/abilityModifiers'
import type {
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
  /**
   * Grid/list choice for the NPC's ability list. The parent tab owns it (like
   * every other custom section's view mode), so the embedded list offers the
   * very same toggle the NPC's own sheet page does. Omitted only by callers
   * that want the section locked to a single mode — no toggle is rendered.
   */
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
}

const STAT_COLORS = {
  evasion: '#e85a8a',
  armor: '#7bc4d6',
  movement: '#e8b04a',
  saveDC: '#9b7ed6',
  hp: '#e85252',
  mortalWounds: '#e57373',
} as const

interface StatCardMeta {
  label: string
  key: keyof NPCStats
  color: string
  icon: LucideIcon
}

const STATS: StatCardMeta[] = [
  { label: 'Evasion', key: 'evasion', icon: Wind, color: STAT_COLORS.evasion },
  { label: 'Armor', key: 'armor', icon: Shield, color: STAT_COLORS.armor },
  { label: 'Movement', key: 'movement', icon: Footprints, color: STAT_COLORS.movement },
  { label: 'Save DC', key: 'saveDC', icon: Target, color: STAT_COLORS.saveDC },
  { label: 'HP', key: 'hp', icon: Heart, color: STAT_COLORS.hp },
  { label: 'Mortal Wounds', key: 'mortalWounds', icon: Skull, color: STAT_COLORS.mortalWounds },
]

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
  viewMode = 'grid',
  onViewModeChange,
}: CustomNPCSectionProps) {
  const isEdit = mode === 'edit'
  const characters = useCharacterStore((s) => s.characters)
  const removeCustomSection = useCharacterStore((s) => s.removeCustomSection)
  const roll = useDiceRollStore((s) => s.roll)

  const npc = characters.find((c) => c.id === section.npcId) ?? null

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

  const onClickAttr = (key: AttributeKey, name: string) => {
    if (isEdit) return
    const value = effectiveAttributes(npc)[key]
    roll({
      notation: `d20${value >= 0 ? '+' : ''}${value}`,
      character: npc,
      source: { type: 'attribute-check', attributeKey: key, attributeName: name },
    })
  }

  const onClickSkill = (skill: SkillName) => {
    if (isEdit) return
    const value = npc.skills[skill]
    roll({
      notation: `d20${value >= 0 ? '+' : ''}${value}`,
      character: npc,
      source: { type: 'skill-check', skillName: skill },
    })
  }

  const description = npc.description ?? ''

  // Combat stats / attributes with any switched-on ability modifiers applied.
  const baseStats: NPCStats = { ...DEFAULT_NPC_STATS, ...(npc.npcStats ?? {}) }
  const stats = effectiveNPCStats(npc)
  const effectiveAttrs = effectiveAttributes(npc)

  return (
    <section className="sheet-section sheet-section--custom sheet-section--custom-npc">
      <div className="sheet-section__heading-row">
        <span className="section-heading-wrap">
          <h3 className="sheet-section__heading">{npc.name}</h3>
        </span>
        <div className="sheet-section__heading-row-right">
          {isEdit && (
            <button
              type="button"
              className="btn btn--icon section-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label={`Delete ${npc.name} section`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="custom-npc-section">
        {/* Top row: portrait inline with combat stats + attributes */}
        <div className="custom-npc-section__top">
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

          <div className="custom-npc-section__top-body">
            {/* Combat stats — token row matching the main sheet */}
            <div className="custom-npc-section__stats">
              {STATS.map((token) => {
                const Icon = token.icon
                const baseValue = baseStats[token.key]
                const value = isEdit ? baseValue : stats[token.key]
                const delta = stats[token.key] - baseValue
                const modified = !isEdit && delta !== 0
                return (
                  <div
                    key={token.label}
                    className={
                      'custom-npc-stat' + (modified ? ' custom-npc-stat--modified' : '')
                    }
                    style={
                      { '--npc-stat-color': token.color } as React.CSSProperties
                    }
                    title={modified ? 'Includes active ability modifiers' : undefined}
                  >
                    <span className="custom-npc-stat__stripe" />
                    <div className="custom-npc-stat__left">
                      <Icon className="custom-npc-stat__icon" size={16} strokeWidth={2.2} />
                      {isEdit ? (
                        <input
                          type="number"
                          className="sheet-input custom-npc-stat__input"
                          value={value}
                          onChange={(e) => setNpcStat(token.key, e.target.value)}
                          min={0}
                        />
                      ) : (
                        <>
                          <span className="custom-npc-stat__value">{value}</span>
                          {modified && (
                            <span className="custom-npc-stat__delta">
                              {formatModifierValue(delta)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <span className="custom-npc-stat__label">{token.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Attributes — compact inline list */}
            <div className="custom-npc-section__block">
              <h5 className="custom-npc-section__block-heading">Attributes</h5>
              <ul className="custom-npc-section__attr-list" role="list">
                {ATTRIBUTE_LIST.map((attr) => {
                  const baseValue = npc.attributes[attr.key]
                  const value = isEdit ? baseValue : effectiveAttrs[attr.key]
                  const delta = value - baseValue
                  const modified = !isEdit && delta !== 0
                  return (
                    <li
                      key={attr.key}
                      className={
                        'custom-npc-section__attr-item' +
                        (isEdit ? '' : ' custom-npc-section__attr-item--clickable')
                      }
                      title={attr.description}
                      onClick={isEdit ? undefined : () => onClickAttr(attr.key, attr.name)}
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
                          className={
                            'custom-npc-section__attr-value' +
                            (modified ? ' attribute-value--modified' : '')
                          }
                          title={
                            modified
                              ? `${attr.description} — ${baseValue >= 0 ? `+${baseValue}` : baseValue} base, ${delta > 0 ? '+' : '−'}${Math.abs(delta)} from active ability modifiers`
                              : attr.description
                          }
                        >
                          {value >= 0 ? `+${value}` : value}
                          {modified && (
                            <span className="attribute-value__delta">
                              {formatModifierValue(delta)}
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Abilities — the very same section the standalone NPC sheet renders
            (NPCAbilitiesSection, embedded variant): heading row with the
            grid/list toggle, "+ Add Ability" below it, the same card grid, and
            the same drag-to-reorder handles in edit mode. An attached NPC is a
            static reference like the standalone sheet, so "nothing activates"
            (the section's own default resolver) travels with every card — and
            no state writer is threaded down either (no use stepper, no modifier
            switch), so a limited ability's meter stays read-only and its
            modifier switch stays visible-but-inert. Uses and modifier switches
            are live play, and live play belongs to a GM Screen instance, which
            tracks its own. */}
        <NPCAbilitiesSection
          variant="embedded"
          abilities={npc.slottedAbilities}
          ownerId={npc.id}
          owner={npc}
          mode={mode}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />

        {/* Skills — compact horizontal list */}
        <div className="custom-npc-section__block">
          <h5 className="custom-npc-section__block-heading">Skills</h5>
          <ul className="custom-npc-section__skill-list" role="list">
            {SKILL_LIST.map((skill) => {
              const value = npc.skills[skill]
              return (
                <li
                  key={skill}
                  className={
                    'custom-npc-section__skill-item' +
                    (isEdit ? '' : ' custom-npc-section__skill-item--clickable')
                  }
                  onClick={isEdit ? undefined : () => onClickSkill(skill)}
                >
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
            <MarkdownText className="custom-npc-section__description" mode={mode} character={npc}>
              {description}
            </MarkdownText>
          ) : (
            <p className="sheet-section__empty muted">No description.</p>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Remove NPC Section?"
          message={
            <>
              Remove <strong>{npc.name}</strong> from this tab? This only
              removes the section from the sheet — the NPC record itself will
              be kept and can still be found on the NPC list.
            </>
          }
          confirmLabel="Remove"
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
