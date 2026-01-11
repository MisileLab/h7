import { describe, expect, it } from 'vitest'
import { createRng } from '../src/core/rng'
import { createInitialState } from '../src/core/state'
import { applyExtractOutcome, applyHazardOutcome, applyRoleModifiers, checkAndTriggerWardenBroadcast, computeExtractSuccessChance, isFail, isWin, resetDaySummary, simulateExtract, simulateHazard, trackKeyEvent, trackResourceGain, trackResourceSpend } from '../src/core/sim'

describe('sim M0 sanity', () => {
  it('RNG is deterministic for same seed', () => {
    const a = createRng(123)
    const b = createRng(123)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('computeExtractSuccessChance clamps bounds', () => {
    const s = createInitialState()
    expect(computeExtractSuccessChance(s, 0)).toBeGreaterThanOrEqual(0.05)
    expect(computeExtractSuccessChance(s, 1)).toBeLessThanOrEqual(0.95)
  })

  it('applyExtractOutcome grants ending part', () => {
    const s = createInitialState()
    const next = applyExtractOutcome(s, {
      ok: true,
      deltaHeat: 0,
      deltaVitals: 0,
      deltaStress: 0,
      deltaTrust: 0,
      deltaPower: 0,
      deltaSupplies: 0,
      deltaParts: 0,
      obtainedEndingPart: 'PartA',
      droneIntegrityDelta: 0,
      droneDown: false,
    })
    expect(next.inventory.endingParts.PartA).toBe(true)
  })

  it('isWin returns true when all ending parts present', () => {
    const s = createInitialState()
    s.inventory.endingParts.PartA = true
    s.inventory.endingParts.PartB = true
    s.inventory.endingParts.PartC = true
    expect(isWin(s)).toBe(true)
  })

  it('isFail triggers for heat 100', () => {
    const s = createInitialState()
    s.heat = 100
    expect(isFail(s)).toBe('Heat100')
  })

  it('isFail triggers for vitals 0', () => {
    const s = createInitialState()
    s.scala.vitals = 0
    expect(isFail(s)).toBe('Vitals0')
  })

  it('simulateExtract success gives rewards', () => {
    const s = createInitialState()
    const rng = createRng(1)
    const outcome = simulateExtract(s, rng, {
      baseChance: 0.95,
      reward: { supplies: 2, parts: 1 },
      heatGain: 10,
      stressGainOnFail: 15,
      integrityLossOnFail: 25,
    })
    expect(outcome.ok).toBe(true)
    const next = applyExtractOutcome(s, outcome)
    expect(next.inventory.supplies).toBe(s.inventory.supplies + 2)
    expect(next.inventory.parts).toBe(s.inventory.parts + 1)
    expect(next.heat).toBe(10)
  })

  it('simulateExtract failure can down drone at 0 integrity', () => {
    const s = createInitialState()
    s.drone.integrity = 10
    const rng = { next: () => 0.999, int: () => 0 }
    const outcome = simulateExtract(s, rng, {
      baseChance: 0.0,
      reward: { parts: 1 },
      heatGain: 10,
      stressGainOnFail: 15,
      integrityLossOnFail: 25,
    })
    expect(outcome.ok).toBe(false)
    const next = applyExtractOutcome(s, outcome)
    expect(next.drone.integrity).toBe(0)
    expect(next.drone.status).toBe('Down')
  })

  it('simulateHazard WardenSweep applies heavy penalties', () => {
    const s = createInitialState()
    const rng = { next: () => 0.999, int: () => 0 }
    const out = simulateHazard(s, rng, { key: 'WardenSweep', severity: 3 })
    expect(out.key).toBe('WardenSweep')
    expect(out.ok).toBe(false)

    const next = applyHazardOutcome(s, out)
    expect(next.drone.integrity).toBeLessThan(s.drone.integrity)
    expect(next.heat).toBeGreaterThan(s.heat)
  })

  it('WARDEN broadcast triggers at Heat 40 threshold once', () => {
    const s = createInitialState()
    s.heat = 40
    const rng = createRng(42)
    
    const { state: next, broadcast } = checkAndTriggerWardenBroadcast(s, rng)
    expect(broadcast).toBeDefined()
    expect(next.wardenState.broadcastBucketsTriggered).toContain(40)

    // Second call should not trigger again
    const { broadcast: broadcast2 } = checkAndTriggerWardenBroadcast(next, rng)
    expect(broadcast2).toBeUndefined()
  })

  it('day summary tracks resource gains', () => {
    const s = createInitialState()
    let next = trackResourceGain(s, 'power', 3)
    next = trackResourceGain(next, 'supplies', 2)
    
    expect(next.daySummary.gained.power).toBe(3)
    expect(next.daySummary.gained.supplies).toBe(2)
  })

  it('day summary tracks resource spending', () => {
    const s = createInitialState()
    let next = trackResourceSpend(s, 'power', 1)
    next = trackResourceSpend(next, 'power', 2)
    
    expect(next.daySummary.spent.power).toBe(3)
  })

  it('day summary tracks key events without duplicates', () => {
    const s = createInitialState()
    let next = trackKeyEvent(s, 'LOCKDOWN')
    next = trackKeyEvent(next, 'LOCKDOWN')
    next = trackKeyEvent(next, 'WARDEN_BROADCAST')
    
    expect(next.daySummary.keyEvents).toEqual(['LOCKDOWN', 'WARDEN_BROADCAST'])
  })

  it('resetDaySummary clears all tracking', () => {
    const s = createInitialState()
    let next = trackResourceGain(s, 'power', 5)
    next = trackKeyEvent(next, 'TEST_EVENT')
    next = resetDaySummary(next)
    
    expect(next.daySummary.gained.power).toBe(0)
    expect(next.daySummary.keyEvents).toEqual([])
  })

  it('Mule role increases extract rewards', () => {
    const s = createInitialState()
    s.drone.role = 'Mule'
    const rng = createRng(1)
    
    const outcome = simulateExtract(s, rng, {
      baseChance: 0.95,
      reward: { supplies: 2 },
      heatGain: 10,
      stressGainOnFail: 15,
      integrityLossOnFail: 25,
    })
    
    expect(outcome.ok).toBe(true)
    expect(outcome.deltaSupplies).toBe(3) // 2 * 1.5 = 3
  })

  it('Scout role reduces hazard damage', () => {
    const s = createInitialState()
    s.drone.role = 'Scout'
    
    const modified = applyRoleModifiers(s, 'hazard', {
      baseChance: 0.7,
      integrityLoss: 20,
    })
    
    expect(modified.baseChance).toBeGreaterThan(0.7)
    expect(modified.integrityLoss).toBeLessThan(20)
  })

  it('Hack role reduces move power cost', () => {
    const s = createInitialState()
    s.drone.role = 'Hack'
    
    const modified = applyRoleModifiers(s, 'move', {
      powerCost: 2,
      heatGain: 10,
    })
    
    expect(modified.powerCost).toBeLessThan(2)
    expect(modified.heatGain).toBeLessThan(10)
  })
})
