/**
 * SkillsSection — displays all fifteen Divergence Skills with their bonuses.
 *
 * Each skill is **clickable** in view mode to roll a d20 + modifier check,
 * logged to the RollLogDrawer as a `skill-check` source.
 */

import { SKILL_LIST } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import type { Character, SkillName, Skills } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface SkillsSectionProps {
  character: Character
  skills: Skills
  mode?: SheetMode
}

function formatSkill(value: number): string {
  if (value > 0) return `+${value}`
  return `${value}`
}

export default function SkillsSection({
  character,
  skills,
  mode = 'view',
}: SkillsSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const roll = useDiceRollStore((s) => s.roll)
  const isEdit = mode === 'edit'

  const setSkill = (skill: SkillName, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    update((c) => ({
      ...c,
      skills: { ...c.skills, [skill]: n },
    }))
  }

  const onClickSkill = (skill: SkillName) => {
    if (isEdit) return
    const value = skills[skill]
    roll({
      notation: `d20${value >= 0 ? '+' : ''}${value}`,
      character,
      source: { type: 'skill-check', skillName: skill },
    })
  }

  return (
    <section className="sheet-section sheet-section--skills">
      <h3 className="sheet-section__heading">Skills</h3>
      <ul className="skill-list" role="list">
        {SKILL_LIST.map((skill: SkillName) => (
          <li
            key={skill}
            className={
              'skill-list__item' + (isEdit ? '' : ' skill-list__item--clickable')
            }
            onClick={isEdit ? undefined : () => onClickSkill(skill)}
          >
            <span className="skill-list__name">{skill}</span>
            {isEdit ? (
              <input
                type="number"
                className="sheet-input sheet-input--num skill-list__value-input"
                min={0}
                max={6}
                step={2}
                value={skills[skill]}
                onChange={(e) => setSkill(skill, e.target.value)}
              />
            ) : (
              <span
                className={
                  'skill-list__value' +
                  (skills[skill] > 0 ? ' skill-list__value--active' : '')
                }
              >
                {formatSkill(skills[skill])}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
