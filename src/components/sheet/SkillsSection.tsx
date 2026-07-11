/**
 * SkillsSection — displays all fifteen Divergence Skills with their bonuses.
 *
 * A Skill value of 0 displays as "+0"; positive values are prefixed with "+"
 * (e.g. "+2"). Negative values — though not part of the standard ruleset — are
 * rendered with a leading "-" for completeness.
 */

import { SKILL_LIST } from '@/constants/gameData'
import type { SkillName, Skills } from '@/types'

export interface SkillsSectionProps {
  skills: Skills
}

function formatSkill(value: number): string {
  if (value > 0) return `+${value}`
  return `${value}`
}

export default function SkillsSection({ skills }: SkillsSectionProps) {
  return (
    <section className="sheet-section sheet-section--skills">
      <h3 className="sheet-section__heading">Skills</h3>
      <ul className="skill-list" role="list">
        {SKILL_LIST.map((skill: SkillName) => (
          <li key={skill} className="skill-list__item">
            <span className="skill-list__name">{skill}</span>
            <span
              className={
                'skill-list__value' +
                (skills[skill] > 0 ? ' skill-list__value--active' : '')
              }
            >
              {formatSkill(skills[skill])}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}