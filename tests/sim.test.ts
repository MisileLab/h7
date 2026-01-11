import { describe, expect, it } from 'vitest'
import { createRng } from '../src/core/rng'
import { createInitialState } from '../src/core/state'
import { applyCombatOutcome, applyExtractOutcome, computeExtractSuccessChance, isFail, isWin, simulateCombat, simulateExtract } from '../src/core/sim'

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

  it('simulateCombat success yields parts and damages drone', () => {
    const s = createInitialState()
    const rng = createRng(1)
    const out = simulateCombat(s, rng, { key: 'WardenSkirmish', difficulty: 0 })
    expect(out.key).toBe('WardenSkirmish')

    const next = applyCombatOutcome(s, out)
    expect(next.drone.integrity).toBeLessThanOrEqual(s.drone.integrity)
  })
})
