import { describe, expect, it } from 'vitest'

import {
  canAffordCustomCosts,
  insufficientCustomCostParts,
  resolveCustomAbilityCosts,
} from '@/lib/abilityCosts'
import type { CustomResourceBar } from '@/types'

const bars: CustomResourceBar[] = [
  { id: 'mana', name: 'Mana', max: 10, current: 3, color: '#88f', refillsOnRecover: false },
  { id: 'stamina', name: 'Stamina', max: 5, current: 5, color: '#fa0', refillsOnRecover: true },
]

describe('resolveCustomAbilityCosts', () => {
  it('returns [] for undefined/empty cost maps', () => {
    expect(resolveCustomAbilityCosts(undefined, bars)).toEqual([])
    expect(resolveCustomAbilityCosts({}, bars)).toEqual([])
  })

  it('resolves ids to bar name + color, following bar order', () => {
    expect(resolveCustomAbilityCosts({ stamina: 1, mana: 2 }, bars)).toEqual([
      { barId: 'mana', name: 'Mana', color: '#88f', amount: 2 },
      { barId: 'stamina', name: 'Stamina', color: '#fa0', amount: 1 },
    ])
  })

  it('drops entries whose bar no longer exists or amount is not positive', () => {
    expect(resolveCustomAbilityCosts({ gone: 2, mana: 0, stamina: -1 }, bars)).toEqual([])
  })
})

describe('canAffordCustomCosts', () => {
  it('true when every bar has enough current', () => {
    expect(canAffordCustomCosts(resolveCustomAbilityCosts({ mana: 3 }, bars), bars)).toBe(true)
  })

  it('false when a bar falls short', () => {
    expect(canAffordCustomCosts(resolveCustomAbilityCosts({ mana: 4 }, bars), bars)).toBe(false)
    expect(
      canAffordCustomCosts(resolveCustomAbilityCosts({ mana: 1 }, [{ ...bars[0], current: 0 }]), [
        { ...bars[0], current: 0 },
      ]),
    ).toBe(false)
    // Entries whose bar no longer exists resolve to nothing → trivially affordable.
    expect(canAffordCustomCosts(resolveCustomAbilityCosts({ mana: 1 }, []), [])).toBe(true)
  })
})

describe('insufficientCustomCostParts', () => {
  it('lists only the shortfalls with amounts and bar names', () => {
    const resolved = resolveCustomAbilityCosts({ mana: 5, stamina: 1 }, bars)
    expect(insufficientCustomCostParts(resolved, bars)).toEqual(['2 Mana'])
  })

  it('drops entries whose bar is absent (nothing to report)', () => {
    const resolved = resolveCustomAbilityCosts({ stamina: 1 }, [])
    expect(resolved).toEqual([])
    expect(insufficientCustomCostParts(resolved, [])).toEqual([])
  })

  it('returns [] when everything is affordable', () => {
    expect(insufficientCustomCostParts(resolveCustomAbilityCosts({ mana: 3 }, bars), bars)).toEqual([])
  })
})
