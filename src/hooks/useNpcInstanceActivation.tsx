/**
 * useNpcInstanceActivation — live-play wiring for ONE GM Screen NPC instance.
 *
 * The GM Screen's whole reason for existing is running the encounter, so an NPC
 * panel is a live surface even though the base NPC record is not: abilities
 * activate, Action Points are spent, and Recharge abilities cool down. None of
 * that may touch the base record — three spawned Bandits each own their turn,
 * and the standalone NPC sheet stays a static reference — so this hook points
 * the shared activation path (`useAbilityActivation`) at the **panel's** state:
 *
 *   - `resources`  → the instance's `currentAP` (NPC panels track no END/FP)
 *     and its own remaining ability uses,
 *   - `blockedReason` → "On cooldown — Recharge N" while cooling,
 *   - `onActivated` → marks the ability's Recharge cooldown,
 *   - `status`     → the {@link RechargeBadge} under the card.
 *
 * It also owns the instance's turn: "Start new turn" refills AP and rolls the
 * Recharge Die, which the GM is told about through a toast and which lands in
 * the persistent roll log.
 *
 * **Which abilities activate?** Any ability with a cost (`hasAbilityCost`) and
 * any ability carrying a Recharge value — the GM panel does not consult the
 * ability's `showActivate` flag, which the NPC editor never even offers. An
 * ability with neither stays a plain reference card.
 *
 * **Limited uses and modifier switches belong to the instance.** Activating a
 * limited ability spends one of *this panel's* uses
 * (`spendInstanceAbilityUse`), the panel's ± steppers persist through
 * {@link NpcInstanceActivation.setAbilityUses}, and an ability's stat/attribute
 * switch persists through
 * {@link NpcInstanceActivation.setAbilityModifiersActive}; all three write
 * `panel.state`, never the shared base record. The counts and switches a card
 * renders — and the effective stats the panel shows — come from that same
 * state: `lib/abilityUses.ts`'s `withInstanceAbilityUses` and
 * `lib/abilityModifiers.ts`'s `withInstanceAbilityModifiers`, composed by the
 * panel through `lib/gmScreenUtils.ts`'s `withInstanceState`.
 */

import { useCallback, useMemo } from 'react'

import RechargeBadge from '@/components/gmscreen/RechargeBadge'
import { useNotification } from '@/context/NotificationContext'
import { ABILITY_TRAITS, hasAbilityTrait } from '@/lib/abilityTraits'
import { hasAbilityCost } from '@/lib/abilityCosts'
import {
  RECHARGE_ROLL_NOTATION,
  abilityRechargeValue,
  rechargeRollResult,
} from '@/lib/abilityRecharge'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useRollLogStore } from '@/store/rollLogStore'
import type {
  AbilityActivationOverride,
  AbilityActivationOverrideResolver,
  AbilityActivationResources,
} from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character, CustomResourceBar, ScreenPanel } from '@/types'

/** An NPC-instance panel of a GM Screen. */
export type NpcInstancePanel = Extract<ScreenPanel, { kind: 'npc-instance' }>

/** NPC panels track no custom resource bars; stable so memos can hold. */
const NO_BARS: CustomResourceBar[] = []

export interface NpcInstanceActivation {
  /**
   * Resolver handed to the NPC ability section: null for abilities that should
   * stay reference cards, an override for everything that can be activated.
   */
  activation: AbilityActivationOverrideResolver
  /** Start this instance's next turn (refill AP + one Recharge Die roll). */
  startTurn: () => void
  /** True while nothing is cooling down — used to explain an idle turn. */
  hasCooldowns: boolean
  /**
   * Persist a manual adjustment (± stepper) of one of the instance's ability
   * budgets. Same writer contract as a sheet's `onSetUses`: it *requests* a
   * count and the store clamps it against the base ability's maximum.
   */
  setAbilityUses: (abilityId: string, remaining: number) => void
  /**
   * Flip one of the instance's ability modifier switches. Same writer contract
   * as a sheet's `onToggleModifiers`: the switch is per instance, so three
   * spawned Bandits can rage independently.
   */
  setAbilityModifiersActive: (abilityId: string, active: boolean) => void
}

export function useNpcInstanceActivation(
  screenId: string,
  panel: NpcInstancePanel,
  base: Character,
): NpcInstanceActivation {
  const spendInstanceAP = useGMScreenStore((s) => s.spendInstanceAP)
  const markAbilityCooldown = useGMScreenStore((s) => s.markAbilityCooldown)
  const setInstanceAbilityUses = useGMScreenStore((s) => s.setInstanceAbilityUses)
  const spendInstanceAbilityUse = useGMScreenStore((s) => s.spendInstanceAbilityUse)
  const setInstanceAbilityModifiersActive = useGMScreenStore(
    (s) => s.setInstanceAbilityModifiersActive,
  )
  const startInstanceTurn = useGMScreenStore((s) => s.startInstanceTurn)
  const logRoll = useRollLogStore((s) => s.logRoll)
  const { notify } = useNotification()

  const panelId = panel.id
  const label = panel.label || base.name
  const ap = panel.state.currentAP
  const cooldowns = panel.state.cooldowns
  const cooldownIds = useMemo(() => new Set(cooldowns), [cooldowns])

  /**
   * The instance's resource adapter. END and FP are `null` — an NPC panel does
   * not track them, so those costs are neither deducted nor allowed to block an
   * activation (the ability cards still show the authored cost badges).
   */
  const resources = useMemo<AbilityActivationResources>(
    () => ({
      ap,
      end: null,
      fp: null,
      customBars: NO_BARS,
      spendAP: (amount) => spendInstanceAP(screenId, panelId, amount),
      spendEND: () => false,
      spendFP: () => false,
      spendCustom: () => false,
      // Limited uses are the instance's own (panel.state.abilityUses).
      spendUse: (abilityId) =>
        spendInstanceAbilityUse(screenId, panelId, abilityId),
    }),
    [ap, screenId, panelId, spendInstanceAP, spendInstanceAbilityUse],
  )

  /**
   * The ± stepper writer for this instance's ability budgets. Threaded to the
   * cards so a limited ability on the panel shows working steppers — exactly
   * the control a player's own sheet has, pointed at the panel instead of a
   * sheet record.
   */
  const setAbilityUses = useCallback(
    (abilityId: string, remaining: number) =>
      setInstanceAbilityUses(screenId, panelId, abilityId, remaining),
    [screenId, panelId, setInstanceAbilityUses],
  )

  /**
   * The modifier-switch writer for this instance. Threaded to the cards so an
   * ability's switch flips *this panel's* state — its effective Evasion, Armor,
   * Movement, Save DC, Max HP and Attributes (and the dice resolved against
   * them) follow, and the base record is never written to.
   */
  const setAbilityModifiersActive = useCallback(
    (abilityId: string, active: boolean) =>
      setInstanceAbilityModifiersActive(screenId, panelId, abilityId, active),
    [screenId, panelId, setInstanceAbilityModifiersActive],
  )

  const activation = useCallback<AbilityActivationOverrideResolver>(
    (ability: AbilityBlock) => {
      const recharge = abilityRechargeValue(ability)
      if (recharge == null && !hasAbilityCost(ability.cost)) return null

      const onCooldown = cooldownIds.has(ability.id)
      return {
        options: {
          resources,
          blockedReason:
            recharge != null && onCooldown
              ? `On cooldown — Recharge ${recharge}. Roll ${recharge}+ on the Recharge Die at the start of ${label}'s next turn.`
              : null,
          onActivated: () => {
            if (recharge == null) return
            markAbilityCooldown(screenId, panelId, ability.id)
            return `on cooldown — recharges on ${recharge}+`
          },
        },
        // The Recharge trait IS the cooldown, so its chip becomes the live
        // badge (idle value → on cooldown) instead of a second copy of the same
        // information below the card. Every other trait renders as authored.
        renderTrait:
          recharge == null
            ? undefined
            : (trait: string) =>
                hasAbilityTrait([trait], ABILITY_TRAITS.recharge.key) ? (
                  <RechargeBadge value={recharge} onCooldown={onCooldown} />
                ) : null,
      } satisfies AbilityActivationOverride
    },
    [cooldownIds, resources, label, screenId, panelId, markAbilityCooldown],
  )

  const startTurn = useCallback(() => {
    const outcome = startInstanceTurn(screenId, panelId)
    if (!outcome) return
    const names = outcome.recharged.map((entry) => entry.name)
    notify(
      names.length
        ? `${label}'s turn — Recharge Die: ${outcome.roll} · recharged: ${names.join(', ')}`
        : `${label}'s turn — Recharge Die: ${outcome.roll} · nothing recharged`,
      names.length ? 'success' : 'info',
      5000,
    )
    // The roll log keeps the turn's context, not just the number: instance
    // label, the die, and what it brought back.
    logRoll({
      notation: RECHARGE_ROLL_NOTATION,
      characterId: base.id,
      characterName: label,
      source: { type: 'recharge', npcName: label, recharged: names },
      result: rechargeRollResult(outcome.roll),
    })
  }, [base.id, label, logRoll, notify, panelId, screenId, startInstanceTurn])

  return {
    activation,
    startTurn,
    hasCooldowns: cooldowns.length > 0,
    setAbilityUses,
    setAbilityModifiersActive,
  }
}
