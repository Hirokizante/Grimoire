import { test, expect } from 'vitest'
import {
  calcHP,
  calcEvasion,
  calcArmor,
  calcMovement,
  calcMilestoneBonus,
  calcSaveDC,
  calcENDRecovery,
  calcEndTurnENDGain,
} from '@/lib/calculations'

test('calcHP: 20 + VIT * 5', () => {
  expect(calcHP(0)).toBe(20)
  expect(calcHP(1)).toBe(25)
  expect(calcHP(2)).toBe(30)
})

test('calcEvasion: 10 + AGI', () => {
  expect(calcEvasion(0)).toBe(10)
  expect(calcEvasion(1)).toBe(11)
  expect(calcEvasion(4)).toBe(14)
})

test('calcArmor: floor(VIT / 2)', () => {
  expect(calcArmor(0)).toBe(0)
  expect(calcArmor(1)).toBe(0)
  expect(calcArmor(2)).toBe(1)
  expect(calcArmor(3)).toBe(1)
  expect(calcArmor(4)).toBe(2)
})

test('calcMovement: 5 + floor(AGI / 2)', () => {
  expect(calcMovement(0)).toBe(5)
  expect(calcMovement(1)).toBe(5)
  expect(calcMovement(2)).toBe(6)
  expect(calcMovement(3)).toBe(6)
})

test('calcMilestoneBonus: floor(milestones / 2)', () => {
  expect(calcMilestoneBonus(0)).toBe(0)
  expect(calcMilestoneBonus(1)).toBe(0)
  expect(calcMilestoneBonus(2)).toBe(1)
  expect(calcMilestoneBonus(4)).toBe(2)
})

test('calcSaveDC: 10 + milestoneBonus', () => {
  expect(calcSaveDC(0)).toBe(10)
  expect(calcSaveDC(4)).toBe(12)
})

test('calcENDRecovery: max(1, 1 + floor(GRT / 2))', () => {
  expect(calcENDRecovery(0)).toBe(1)
  expect(calcENDRecovery(1)).toBe(1)
  expect(calcENDRecovery(2)).toBe(2)
  expect(calcENDRecovery(5)).toBe(3)
})

test('calcEndTurnENDGain: AP→END + END Recovery (capped at max)', () => {
  // 2 AP leftover, 5 END, GRT 0 → recovery 1, AP converts to 2, total = 3
  expect(calcEndTurnENDGain(2, 5, 0)).toBe(3)
  // 0 AP, 7 END, GRT 4 → recovery 3, total = 3
  expect(calcEndTurnENDGain(0, 7, 4)).toBe(3)
  // 1 AP, 9 END, GRT 0 → recovery 1 but only 1 END fits, total = 1
  expect(calcEndTurnENDGain(1, 9, 0)).toBe(1)
  // At max END → 0 gain
  expect(calcEndTurnENDGain(3, 10, 4)).toBe(0)
  // 3 AP, 8 END, GRT 0 → recovery 1, AP converts to 2, total = 3
  expect(calcEndTurnENDGain(3, 8, 0)).toBe(2)
  // Custom maxEND
  expect(calcEndTurnENDGain(2, 5, 0, 12)).toBe(3)
})
