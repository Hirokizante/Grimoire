/**
 * SkillsSection — displays all fifteen Divergence Skills with their bonuses.
 *
 * A Skill value of 0 displays as "+0"; positive values are prefixed with "+"
 * (e.g. "+2"). Negative values — though not part of the standard ruleset — are
 * rendered with a leading "-" for completeness.
 *
 * In edit mode each skill value becomes a number input (min 0, max 6, step 2)
 * that persists immediately via `updateCurrentCharacter`.
 */

import { SKILL_LIST } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import type { SkillName, Skills } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface SkillsSectionProps {
  skills: Skills
  mode?: SheetMode
}

function formatSkill(value: number): string {
  if (value > 0) return `+${value}`
  return `${value}`
}

export default function SkillsSection({
  skills,
  mode = 'view',
}: SkillsSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const setSkill = (skill: SkillName, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    update((c) => ({
      ...c,
      skills: { ...c.skills, [skill]: n },
    }))
  }

  return (
    <section className="sheet-section sheet-section--skills">
      <h3 className="sheet-section__heading">Skills</h3>
      <ul className="skill-list" role="list">
        {SKILL_LIST.map((skill: SkillName) => (
          <li key={skill} className="skill-list__item">
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
