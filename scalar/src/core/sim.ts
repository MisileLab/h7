import type { EndingPartKey } from '../types'
import type { LogLine } from './state'
import type { GameState } from './state'
import type { Rng } from './rng'

export type SimFailReason = 'Heat100' | 'Vitals0'

export interface ExtractOutcome {
  ok: boolean
  deltaHeat: number
  deltaVitals: number
  deltaStress: number
  deltaTrust: number
  deltaPower: number
  deltaSupplies: number
  deltaParts: number
  obtainedEndingPart?: EndingPartKey
  droneIntegrityDelta: number
  droneDown: boolean
}

export interface HazardOutcome {
  key: 'PatrolSweep' | 'SurgicalLight' | 'WardenSweep'
  ok: boolean
  deltaHeat: number
  deltaVitals: number
  deltaStress: number
  deltaTrust: number
  droneIntegrityDelta: number
  droneDown: boolean
}

export interface MoveOutcome {
  deltaHeat: number
  deltaPower: number
  time: number
  blockedByLockdown: boolean
}

export interface SimStepResult {
  state: GameState
  ended: boolean
  win: boolean
  failReason?: SimFailReason
}

export type DayFlags = {
  lockdown: boolean
  traceArmed: boolean
}

export function initDayFlags(state: GameState): DayFlags {
  return {
    lockdown: state.heat >= 40,
    traceArmed: false,
  }
}

export function appendLog(state: GameState, line: Omit<LogLine, 'day'>): GameState {
  const next: GameState = { ...state, log: [...state.log, { day: state.day, ...line }] }
  if (next.log.length > 200) {
    next.log = next.log.slice(next.log.length - 200)
  }
  return next
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function isWin(state: GameState): boolean {
  const p = state.inventory.endingParts
  return Boolean(p.PartA && p.PartB && p.PartC)
}

export function isFail(state: GameState): SimFailReason | undefined {
  if (state.heat >= 100) return 'Heat100'
  if (state.scala.vitals <= 0) return 'Vitals0'
  return undefined
}

export function applyExtractOutcome(state: GameState, outcome: ExtractOutcome): GameState {
  const next: GameState = {
    ...state,
    heat: clamp(state.heat + outcome.deltaHeat, 0, 100),
    scala: {
      vitals: clamp(state.scala.vitals + outcome.deltaVitals, 0, 100),
      stress: clamp(state.scala.stress + outcome.deltaStress, 0, 100),
      trust: clamp(state.scala.trust + outcome.deltaTrust, 0, 100),
    },
    inventory: {
      ...state.inventory,
      power: Math.max(0, state.inventory.power + outcome.deltaPower),
      supplies: Math.max(0, state.inventory.supplies + outcome.deltaSupplies),
      parts: Math.max(0, state.inventory.parts + outcome.deltaParts),
      endingParts: { ...state.inventory.endingParts },
    },
    drone: {
      ...state.drone,
      integrity: clamp(state.drone.integrity + outcome.droneIntegrityDelta, 0, 100),
      status: outcome.droneDown ? 'Down' : state.drone.status,
    },
  }

  if (outcome.obtainedEndingPart) {
    next.inventory.endingParts[outcome.obtainedEndingPart] = true
  }

  return next
}

export function computeExtractSuccessChance(state: GameState, baseChance: number): number {
  const heatPenalty = state.heat >= 70 ? 0.2 : state.heat >= 40 ? 0.1 : 0
  const stressPenalty = state.scala.stress >= 70 ? 0.2 : state.scala.stress >= 40 ? 0.1 : 0
  const trustBonus = state.scala.trust >= 60 ? 0.1 : 0
  return clamp(baseChance - heatPenalty - stressPenalty + trustBonus, 0.05, 0.95)
}

export function roll(probability: number, rng: Rng): boolean {
  return rng.next() < probability
}

export function simulateExtract(
  state: GameState,
  rng: Rng,
  params: {
    baseChance: number
    reward: { power?: number; supplies?: number; parts?: number; endingPart?: EndingPartKey }
    heatGain: number
    stressGainOnFail: number
    integrityLossOnFail: number
  },
): ExtractOutcome {
  const successChance = computeExtractSuccessChance(state, params.baseChance)
  const ok = roll(successChance, rng)

  if (ok) {
    return {
      ok: true,
      deltaHeat: params.heatGain,
      deltaVitals: 0,
      deltaStress: 0,
      deltaTrust: state.scala.trust >= 60 ? 1 : 0,
      deltaPower: params.reward.power ?? 0,
      deltaSupplies: params.reward.supplies ?? 0,
      deltaParts: params.reward.parts ?? 0,
      obtainedEndingPart: params.reward.endingPart,
      droneIntegrityDelta: 0,
      droneDown: false,
    }
  }

  const integrityLoss = -Math.abs(params.integrityLossOnFail)
  const projectedIntegrity = clamp(state.drone.integrity + integrityLoss, 0, 100)

  return {
    ok: false,
    deltaHeat: Math.max(0, Math.ceil(params.heatGain * 0.5)),
    deltaVitals: 0,
    deltaStress: params.stressGainOnFail,
    deltaTrust: 0,
    deltaPower: 0,
    deltaSupplies: 0,
    deltaParts: 0,
    droneIntegrityDelta: integrityLoss,
    droneDown: projectedIntegrity <= 0,
  }
}

export function applyMoveCost(state: GameState, cost: { heat: number; power: number }): GameState {
  return {
    ...state,
    heat: clamp(state.heat + cost.heat, 0, 100),
    inventory: {
      ...state.inventory,
      power: Math.max(0, state.inventory.power - Math.max(0, cost.power)),
    },
  }
}

export function simulateMove(
  state: GameState,
  rng: Rng,
  cost: { time: number; heat: number; power: number },
  flags: DayFlags,
): { outcome: MoveOutcome; flags: DayFlags } {
  let blockedByLockdown = false
  let heat = cost.heat
  let power = cost.power

  if (state.heat >= 40) {
    const lockdownChance = state.heat >= 70 ? 0.35 : 0.15
    if (roll(lockdownChance, rng)) {
      blockedByLockdown = true
      heat += 2
      power += 1
      flags = { ...flags, lockdown: true }
    }
  }

  return {
    outcome: { deltaHeat: heat, deltaPower: -Math.max(0, power), time: cost.time, blockedByLockdown },
    flags,
  }
}

export function simulateHazard(state: GameState, rng: Rng, params: { key: HazardOutcome['key']; severity: number }): HazardOutcome {
  const baseOk = 0.85 - clamp(params.severity, 0, 3) * 0.15
  const okChance = computeExtractSuccessChance(state, baseOk)
  const ok = roll(okChance, rng)

  if (params.key === 'SurgicalLight') {
    if (ok) {
      return { key: params.key, ok: true, deltaHeat: 0, deltaVitals: 0, deltaStress: 8, deltaTrust: 0, droneIntegrityDelta: 0, droneDown: false }
    }
    const loss = -Math.round(12 + params.severity * 6)
    const projected = clamp(state.drone.integrity + loss, 0, 100)
    return {
      key: params.key,
      ok: false,
      deltaHeat: 1,
      deltaVitals: -2,
      deltaStress: 18 + params.severity * 6,
      deltaTrust: 0,
      droneIntegrityDelta: loss,
      droneDown: projected <= 0,
    }
  }

  if (params.key === 'WardenSweep') {
    if (ok) {
      return { key: params.key, ok: true, deltaHeat: 4, deltaVitals: 0, deltaStress: 12, deltaTrust: 0, droneIntegrityDelta: -Math.round(8 + params.severity * 3), droneDown: false }
    }
    const loss = -Math.round(20 + params.severity * 10)
    const projected = clamp(state.drone.integrity + loss, 0, 100)
    return {
      key: params.key,
      ok: false,
      deltaHeat: 8 + params.severity * 4,
      deltaVitals: -3 - params.severity,
      deltaStress: 20 + params.severity * 8,
      deltaTrust: 0,
      droneIntegrityDelta: loss,
      droneDown: projected <= 0,
    }
  }

  if (ok) {
    return { key: params.key, ok: true, deltaHeat: 2, deltaVitals: 0, deltaStress: 4, deltaTrust: 0, droneIntegrityDelta: 0, droneDown: false }
  }

  const loss = -Math.round(18 + params.severity * 8)
  const projected = clamp(state.drone.integrity + loss, 0, 100)
  return {
    key: params.key,
    ok: false,
    deltaHeat: 6 + params.severity * 3,
    deltaVitals: 0,
    deltaStress: 12 + params.severity * 5,
    deltaTrust: 0,
    droneIntegrityDelta: loss,
    droneDown: projected <= 0,
  }
}

export function applyHazardOutcome(state: GameState, outcome: HazardOutcome): GameState {
  return {
    ...state,
    heat: clamp(state.heat + outcome.deltaHeat, 0, 100),
    scala: {
      vitals: clamp(state.scala.vitals + outcome.deltaVitals, 0, 100),
      stress: clamp(state.scala.stress + outcome.deltaStress, 0, 100),
      trust: clamp(state.scala.trust + outcome.deltaTrust, 0, 100),
    },
    drone: {
      ...state.drone,
      integrity: clamp(state.drone.integrity + outcome.droneIntegrityDelta, 0, 100),
      status: outcome.droneDown ? 'Down' : state.drone.status,
    },
  }
}

export function stepAndCheckEnd(state: GameState): SimStepResult {
  const fail = isFail(state)
  if (fail) {
    return { state, ended: true, win: false, failReason: fail }
  }
  const win = isWin(state)
  if (win) {
    return { state, ended: true, win: true }
  }
  return { state, ended: false, win: false }
}

export function resetDaySummary(state: GameState): GameState {
  return {
    ...state,
    daySummary: {
      gained: { power: 0, supplies: 0, parts: 0 },
      spent: { power: 0, supplies: 0, parts: 0 },
      heatDelta: 0,
      scalaDelta: { vitals: 0, stress: 0, trust: 0 },
      droneDelta: { integrityDelta: 0, wentDown: false, salvageMarked: false },
      keyEvents: [],
    },
  }
}

export function trackResourceGain(state: GameState, resource: 'power' | 'supplies' | 'parts', amount: number): GameState {
  if (amount <= 0) return state
  return {
    ...state,
    daySummary: {
      ...state.daySummary,
      gained: {
        ...state.daySummary.gained,
        [resource]: state.daySummary.gained[resource] + amount,
      },
    },
  }
}

export function trackResourceSpend(state: GameState, resource: 'power' | 'supplies' | 'parts', amount: number): GameState {
  if (amount <= 0) return state
  return {
    ...state,
    daySummary: {
      ...state.daySummary,
      spent: {
        ...state.daySummary.spent,
        [resource]: state.daySummary.spent[resource] + amount,
      },
    },
  }
}

export function trackHeatChange(state: GameState, oldHeat: number, newHeat: number): GameState {
  return {
    ...state,
    daySummary: {
      ...state.daySummary,
      heatDelta: state.daySummary.heatDelta + (newHeat - oldHeat),
    },
  }
}

export function trackScalaChange(state: GameState, oldScala: { vitals: number; stress: number; trust: number }): GameState {
  return {
    ...state,
    daySummary: {
      ...state.daySummary,
      scalaDelta: {
        vitals: state.daySummary.scalaDelta.vitals + (state.scala.vitals - oldScala.vitals),
        stress: state.daySummary.scalaDelta.stress + (state.scala.stress - oldScala.stress),
        trust: state.daySummary.scalaDelta.trust + (state.scala.trust - oldScala.trust),
      },
    },
  }
}

export function trackDroneChange(state: GameState, oldIntegrity: number, wentDown: boolean): GameState {
  return {
    ...state,
    daySummary: {
      ...state.daySummary,
      droneDelta: {
        integrityDelta: state.daySummary.droneDelta.integrityDelta + (state.drone.integrity - oldIntegrity),
        wentDown: state.daySummary.droneDelta.wentDown || wentDown,
        salvageMarked: state.daySummary.droneDelta.salvageMarked,
      },
    },
  }
}

export function trackKeyEvent(state: GameState, event: string): GameState {
  if (state.daySummary.keyEvents.includes(event)) return state
  return {
    ...state,
    daySummary: {
      ...state.daySummary,
      keyEvents: [...state.daySummary.keyEvents, event],
    },
  }
}

export function getWardenBroadcast(heat: number, rng: Rng): string | undefined {
  const { wardenBroadcasts } = require('./data').data
  
  let bucket: string[] = []
  if (heat >= 100) bucket = wardenBroadcasts.bucket100
  else if (heat >= 80) bucket = wardenBroadcasts.bucket80
  else if (heat >= 60) bucket = wardenBroadcasts.bucket60
  else if (heat >= 40) bucket = wardenBroadcasts.bucket40
  else return undefined

  if (bucket.length === 0) return undefined
  const idx = rng.int(0, bucket.length - 1)
  return bucket[idx]
}

export function checkAndTriggerWardenBroadcast(state: GameState, rng: Rng): { state: GameState; broadcast?: string } {
  const heat = state.heat
  let bucket = -1
  if (heat >= 100) bucket = 100
  else if (heat >= 80) bucket = 80
  else if (heat >= 60) bucket = 60
  else if (heat >= 40) bucket = 40

  if (bucket === -1 || state.wardenState.broadcastBucketsTriggered.includes(bucket)) {
    return { state }
  }

  const broadcast = getWardenBroadcast(heat, rng)
  if (!broadcast) return { state }

  const nextState = {
    ...state,
    wardenState: {
      lastBroadcastBucket: bucket,
      broadcastBucketsTriggered: [...state.wardenState.broadcastBucketsTriggered, bucket],
    },
  }

  return { state: nextState, broadcast }
}
