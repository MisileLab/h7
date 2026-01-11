import type { EndingPartKey, NodeId, RunMode, Milestone } from '../types'

export type DroneStatus = 'OK' | 'Down'

export interface DroneState {
  role: 'Scout' | 'Mule' | 'Hack'
  integrity: number
  status: DroneStatus
}

export interface ScalaState {
  vitals: number
  stress: number
  trust: number
}

export interface InventoryState {
  power: number
  supplies: number
  parts: number
  endingParts: Record<EndingPartKey, boolean>
}

export interface RunState {
  mode: RunMode
  droneNodeId: NodeId
  selectedNodeId?: NodeId
}

export interface RunProgress {
  extractedFrom: Partial<Record<NodeId, boolean>>
  storyRead: Partial<Record<NodeId, boolean>>
  hazardResolved: Partial<Record<NodeId, boolean>>
}

export interface DaySummary {
  gained: { power: number; supplies: number; parts: number }
  spent: { power: number; supplies: number; parts: number }
  heatDelta: number
  scalaDelta: { vitals: number; stress: number; trust: number }
  droneDelta: { integrityDelta: number; wentDown: boolean; salvageMarked: boolean }
  keyEvents: string[]
}

export interface WardenState {
  lastBroadcastBucket: number
  broadcastBucketsTriggered: number[]
}

export interface LogLine {
  day: number
  speaker: 'CRYSTAL' | 'SCALA' | 'WARDEN' | 'SYSTEM'
  text: string
}

export interface GameState {
  day: number
  heat: number
  milestone: Milestone
  scala: ScalaState
  inventory: InventoryState
  drone: DroneState
  run: RunState
  progress: RunProgress
  log: LogLine[]
  daySummary: DaySummary
  wardenState: WardenState
}

export function createInitialState(opts?: { milestone?: Milestone }): GameState {
  return {
    day: 1,
    heat: 0,
    milestone: opts?.milestone ?? 'M2',
    scala: { vitals: 100, stress: 10, trust: 0 },
    inventory: {
      power: 3,
      supplies: 3,
      parts: 0,
      endingParts: { PartA: false, PartB: false, PartC: false },
    },
    drone: { role: 'Scout', integrity: 100, status: 'OK' },
    run: { mode: 'Planning', droneNodeId: 'N0_HOME' },
    progress: { extractedFrom: {}, storyRead: {}, hazardResolved: {} },
    log: [],
    daySummary: {
      gained: { power: 0, supplies: 0, parts: 0 },
      spent: { power: 0, supplies: 0, parts: 0 },
      heatDelta: 0,
      scalaDelta: { vitals: 0, stress: 0, trust: 0 },
      droneDelta: { integrityDelta: 0, wentDown: false, salvageMarked: false },
      keyEvents: [],
    },
    wardenState: {
      lastBroadcastBucket: -1,
      broadcastBucketsTriggered: [],
    },
  }
}
