/**
 * MilestoneDialog — multi-step guided level-up wizard.
 *
 * Per DESIGN.md "Milestones": upon reaching a Milestone, a player must:
 *  1. Increase one Attribute by 1 (max 8)
 *  2. Increase one Skill by 2 (max +6)
 *  3. Every 2 Milestones: choose +1 Ability Slot OR +1 Max FP
 *
 * The wizard can be skipped entirely via the "Skip" button — milestones still
 * increase but no bonuses are applied, letting the player defer decisions.
 */

import { useState } from 'react'
import { ATTRIBUTE_LIST, SKILL_LIST } from '@/constants/gameData'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import type { AttributeKey, SkillName } from '@/types'

export interface MilestoneDialogProps {
  onClose: () => void
}

/** The wizard steps in order. Choice is conditional. */
type Step = 'attribute' | 'skill' | 'choice' | 'confirm'

export default function MilestoneDialog({ onClose }: MilestoneDialogProps) {
  const character = useCharacterStore((s) => s.currentCharacter)
  const addMilestone = useCharacterStore((s) => s.addMilestone)
  const { notify } = useNotification()

  const [step, setStep] = useState<Step>('attribute')
  const [selectedAttr, setSelectedAttr] = useState<AttributeKey | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillName | null>(null)
  const [choice, setChoice] = useState<'slot' | 'fp' | null>(null)

  useEscapeKey(onClose)

  if (!character) return null

  const newMilestone = character.milestones + 1
  const showChoice = newMilestone % 2 === 0

  const formatAttr = (v: number) => (v >= 0 ? `+${v}` : `${v}`)

  const handleAttrSelect = (key: AttributeKey) => {
    if (character.attributes[key] >= 8) return
    setSelectedAttr(key)
    setStep('skill')
  }

  const handleSkillSelect = (skill: SkillName) => {
    if (character.skills[skill] >= 6) return
    setSelectedSkill(skill)
    setStep(showChoice ? 'choice' : 'confirm')
  }

  const handleChoiceSelect = (c: 'slot' | 'fp') => {
    setChoice(c)
    setStep('confirm')
  }

  const handleConfirm = () => {
    if (!selectedAttr || !selectedSkill) return
    addMilestone({
      attribute: selectedAttr,
      skill: selectedSkill,
      choice: showChoice ? choice ?? undefined : undefined,
    })
    notify(`Level Up! Milestone ${newMilestone} reached.`, 'success', 4000)
    onClose()
  }

  const handleSkip = () => {
    useCharacterStore.getState().skipMilestone()
    notify('Milestone skipped. Bonuses deferred.', 'warning')
    onClose()
  }

  const canConfirm = selectedAttr && selectedSkill && (!showChoice || choice)

  /** Compute steps array for progress dots. */
  const steps: Step[] = showChoice
    ? ['attribute', 'skill', 'choice', 'confirm']
    : ['attribute', 'skill', 'confirm']
  const stepIndex = steps.indexOf(step)

  const selectedAttrMeta = selectedAttr
    ? ATTRIBUTE_LIST.find((a) => a.key === selectedAttr)
    : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content milestone-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Level Up — Milestone {newMilestone}</h3>
        </div>

        {/* Progress dots */}
        <div className="milestone-progress">
          {steps.map((s, i) => (
            <div
              key={s}
              className={
                'milestone-progress__dot' +
                (i <= stepIndex ? ' milestone-progress__dot--active' : '') +
                (i === stepIndex ? ' milestone-progress__dot--current' : '')
              }
            />
          ))}
        </div>

        <div className="milestone-dialog__body">
          {step === 'attribute' && (
            <div className="milestone-step">
              <p className="milestone-step__prompt">
                Increase one Attribute by 1
              </p>
              <div className="milestone-attr-grid">
                {ATTRIBUTE_LIST.map((attr) => {
                  const val = character.attributes[attr.key]
                  const atMax = val >= 8
                  return (
                    <button
                      key={attr.key}
                      type="button"
                      className={
                        'milestone-attr-card' +
                        (atMax ? ' milestone-attr-card--disabled' : '')
                      }
                      onClick={() => handleAttrSelect(attr.key)}
                      disabled={atMax}
                      title={atMax ? 'Already at maximum (8)' : attr.description}
                    >
                      <span className="milestone-attr-card__abbr">
                        {attr.abbreviation}
                      </span>
                      <span className="milestone-attr-card__value">
                        {formatAttr(val)}
                      </span>
                      <span className="milestone-attr-card__name">
                        {attr.name}
                      </span>
                      {atMax && (
                        <span className="milestone-attr-card__max">
                          MAX
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'skill' && (
            <div className="milestone-step">
              <p className="milestone-step__prompt">
                Increase one Skill by 2
              </p>
              <div className="milestone-skill-grid">
                {SKILL_LIST.map((skill) => {
                  const val = character.skills[skill]
                  const atMax = val >= 6
                  return (
                    <button
                      key={skill}
                      type="button"
                      className={
                        'milestone-skill-card' +
                        (atMax ? ' milestone-skill-card--disabled' : '') +
                        (val > 0 ? ' milestone-skill-card--active' : '')
                      }
                      onClick={() => handleSkillSelect(skill)}
                      disabled={atMax}
                      title={atMax ? 'Already at maximum (+6)' : `+${val} → +${val + 2}`}
                    >
                      <span className="milestone-skill-card__name">
                        {skill}
                      </span>
                      <span className="milestone-skill-card__value">
                        +{val}
                      </span>
                      {atMax && (
                        <span className="milestone-skill-card__max">
                          MAX
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'choice' && (
            <div className="milestone-step">
              <p className="milestone-step__prompt">
                Choose a reward — every 2 milestones
              </p>
              <div className="milestone-choice-grid">
                <button
                  type="button"
                  className={
                    'milestone-choice-card' +
                    (choice === 'slot' ? ' milestone-choice-card--selected' : '')
                  }
                  onClick={() => handleChoiceSelect('slot')}
                >
                  <span className="milestone-choice-card__icon">✦</span>
                  <span className="milestone-choice-card__title">
                    +1 Ability Slot
                  </span>
                  <span className="milestone-choice-card__desc">
                    Current: {character.maxAbilitySlots} → {character.maxAbilitySlots + 1}
                  </span>
                </button>
                <button
                  type="button"
                  className={
                    'milestone-choice-card' +
                    (choice === 'fp' ? ' milestone-choice-card--selected' : '')
                  }
                  onClick={() => handleChoiceSelect('fp')}
                >
                  <span className="milestone-choice-card__icon">★</span>
                  <span className="milestone-choice-card__title">
                    +1 Max Fate Points
                  </span>
                  <span className="milestone-choice-card__desc">
                    Current: {character.maxFP} → {character.maxFP + 1}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="milestone-step">
              <p className="milestone-step__prompt">Confirm your level-up</p>
              <div className="milestone-summary">
                <div className="milestone-summary__row">
                  <span className="milestone-summary__label">Milestone</span>
                  <span className="milestone-summary__value">
                    {character.milestones} → {newMilestone}
                  </span>
                </div>
                {selectedAttrMeta && (
                  <div className="milestone-summary__row">
                    <span className="milestone-summary__label">
                      {selectedAttrMeta.name}
                    </span>
                    <span className="milestone-summary__value">
                      {formatAttr(character.attributes[selectedAttr!])} → {formatAttr(character.attributes[selectedAttr!] + 1)}
                    </span>
                  </div>
                )}
                {selectedSkill && (
                  <div className="milestone-summary__row">
                    <span className="milestone-summary__label">
                      {selectedSkill}
                    </span>
                    <span className="milestone-summary__value">
                      +{character.skills[selectedSkill]} → +{character.skills[selectedSkill] + 2}
                    </span>
                  </div>
                )}
                {showChoice && choice && (
                  <div className="milestone-summary__row">
                    <span className="milestone-summary__label">Reward</span>
                    <span className="milestone-summary__value">
                      {choice === 'slot' ? '+1 Ability Slot' : '+1 Max FP'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="milestone-dialog__footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleSkip}
          >
            Skip
          </button>
          <div className="milestone-dialog__nav">
            {step !== 'attribute' && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  if (step === 'skill') setStep('attribute')
                  else if (step === 'choice') setStep('skill')
                  else if (step === 'confirm') setStep(showChoice ? 'choice' : 'skill')
                }}
              >
                Back
              </button>
            )}
            {step !== 'confirm' ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClose}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary milestone-dialog__confirm"
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                Confirm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
