import type { NodeType, NodeId } from '../types'

export type Reward = {
  power?: number
  supplies?: number
  parts?: number
  endingPart?: 'PartA' | 'PartB' | 'PartC'
  item?: 'Tape' | 'ModulePart'
}

export type NodeDef = {
  id: NodeId
  name: string
  type: NodeType
  pos: { x: number; y: number }
  risk: number
  extract?: {
    baseChance: number
    heatGain: number
    reward: Reward
  }
  story?: {
    lines: { speaker: 'CRYSTAL' | 'SCALA' | 'WARDEN' | 'SYSTEM'; text: string }[]
    once?: boolean
  }
  hazard?: {
    key: 'PatrolSweep' | 'SurgicalLight'
    severity: number
  }
  combat?: {
    key: 'WardenSkirmish'
    difficulty: number
  }
}

export type EdgeDef = {
  from: NodeId
  to: NodeId
  cost: { time: number; heat: number; power: number }
  requires?: { trustAtLeast?: number; hasItem?: 'Tape' | 'ModulePart' }
}

export const data = {
  codename: 'PROJECT LATTICE',
  nodes: [
    {
      id: 'N0_HOME',
      name: 'Home Relay',
      type: 'Story',
      pos: { x: 320, y: 300 },
      risk: 0,
      story: {
        once: false,
        lines: [
          { speaker: 'CRYSTAL', text: 'Boot sequence clean. Routing you through the old service mesh.' },
          { speaker: 'SCALA', text: 'Don\'t narrate. Just keep the tremor out of my hands.' },
          { speaker: 'SYSTEM', text: 'DAY 1. Objective: acquire LATTICE LINK module parts.' },
        ],
      },
    },

    {
      id: 'N1_SUBSTATION',
      name: 'Substation 12',
      type: 'Extract',
      pos: { x: 520, y: 240 },
      risk: 1,
      extract: {
        baseChance: 0.8,
        heatGain: 6,
        reward: { power: 2 },
      },
    },

    {
      id: 'N2_DEPOT',
      name: 'Freight Depot',
      type: 'Extract',
      pos: { x: 730, y: 330 },
      risk: 2,
      extract: {
        baseChance: 0.7,
        heatGain: 8,
        reward: { supplies: 2 },
      },
    },

    {
      id: 'N3_SCRAPYARD',
      name: 'Scrap Orchard',
      type: 'Extract',
      pos: { x: 610, y: 500 },
      risk: 2,
      extract: {
        baseChance: 0.65,
        heatGain: 10,
        reward: { parts: 2 },
      },
    },

    {
      id: 'N4_TAPE01',
      name: 'Tape 01: Glass Choir',
      type: 'Story',
      pos: { x: 900, y: 240 },
      risk: 1,
      story: {
        once: true,
        lines: [
          { speaker: 'SYSTEM', text: 'Recovered: ANALOG TAPE. Condition: playable.' },
          { speaker: 'SCALA', text: 'That\'s the lab\'s watermark. I hate that I recognize it.' },
          { speaker: 'CRYSTAL', text: 'I can clean the hiss. Do you want the truth loud, or gentle?' },
          { speaker: 'SCALA', text: 'Loud.' },
        ],
      },
    },

    {
      id: 'N5_PART_A',
      name: 'Module Part A: Lattice Coupler',
      type: 'Extract',
      pos: { x: 1020, y: 360 },
      risk: 3,
      extract: {
        baseChance: 0.6,
        heatGain: 14,
        reward: { endingPart: 'PartA', parts: 1 },
      },
    },

    {
      id: 'N6_HAZ_PATROL',
      name: 'Patrol Sweep',
      type: 'Hazard',
      pos: { x: 800, y: 520 },
      risk: 3,
      hazard: { key: 'PatrolSweep', severity: 2 },
    },

    {
      id: 'N7_HAZ_LIGHT',
      name: 'Surgical Light Zone',
      type: 'Hazard',
      pos: { x: 980, y: 540 },
      risk: 3,
      hazard: { key: 'SurgicalLight', severity: 2 },
    },

    {
      id: 'N7B_COMBAT_SKIRMISH',
      name: 'Warden Skirmish',
      type: 'Combat',
      pos: { x: 1110, y: 600 },
      risk: 3,
      combat: { key: 'WardenSkirmish', difficulty: 2 },
    },

    {
      id: 'N8_CONTROL_LOG',
      name: 'Control Log: Key Override',
      type: 'Story',
      pos: { x: 610, y: 120 },
      risk: 1,
      story: {
        once: true,
        lines: [
          { speaker: 'SYSTEM', text: 'CONTROL LOG: override accepted. operator signature: [REDACTED].' },
          { speaker: 'CRYSTAL', text: 'The redaction isn\'t aimed at you. It\'s aimed at any witness.' },
          { speaker: 'SCALA', text: 'That\'s worse. That means someone expected to survive.' },
        ],
      },
    },

    {
      id: 'N9_PART_B',
      name: 'Module Part B: Phase Gate',
      type: 'Extract',
      pos: { x: 1180, y: 220 },
      risk: 3,
      extract: {
        baseChance: 0.55,
        heatGain: 16,
        reward: { endingPart: 'PartB', parts: 1 },
      },
    },

    {
      id: 'N10_PART_C',
      name: 'Module Part C: Null Latch',
      type: 'Extract',
      pos: { x: 1220, y: 520 },
      risk: 3,
      extract: {
        baseChance: 0.5,
        heatGain: 18,
        reward: { endingPart: 'PartC', parts: 1 },
      },
    },

    {
      id: 'N11_FRIEND_PROTOCOL',
      name: 'Friend Protocol',
      type: 'Story',
      pos: { x: 460, y: 560 },
      risk: 1,
      story: {
        once: true,
        lines: [
          { speaker: 'SCALA', text: 'We had a word for it. When the link went bad. "Friend Protocol".' },
          { speaker: 'CRYSTAL', text: 'A euphemism.' },
          { speaker: 'SCALA', text: 'A mercy. If Trust stays above sixty, you\'ll warn me before it hurts.' },
          { speaker: 'CRYSTAL', text: 'Confirmed. I will tell you the moment I predict a spike.' },
        ],
      },
    },
  ] as NodeDef[],
  edges: [
    { from: 'N0_HOME', to: 'N1_SUBSTATION', cost: { time: 1, heat: 1, power: 0 } },
    { from: 'N1_SUBSTATION', to: 'N2_DEPOT', cost: { time: 1, heat: 1, power: 1 } },
    { from: 'N2_DEPOT', to: 'N3_SCRAPYARD', cost: { time: 1, heat: 2, power: 1 } },
    { from: 'N3_SCRAPYARD', to: 'N11_FRIEND_PROTOCOL', cost: { time: 1, heat: 0, power: 1 } },
    { from: 'N11_FRIEND_PROTOCOL', to: 'N0_HOME', cost: { time: 1, heat: 0, power: 1 } },

    { from: 'N1_SUBSTATION', to: 'N8_CONTROL_LOG', cost: { time: 1, heat: 0, power: 1 } },
    { from: 'N8_CONTROL_LOG', to: 'N0_HOME', cost: { time: 1, heat: 0, power: 1 } },

    { from: 'N2_DEPOT', to: 'N4_TAPE01', cost: { time: 1, heat: 0, power: 1 } },
    { from: 'N4_TAPE01', to: 'N5_PART_A', cost: { time: 1, heat: 2, power: 1 } },
    { from: 'N5_PART_A', to: 'N6_HAZ_PATROL', cost: { time: 1, heat: 2, power: 1 } },

    { from: 'N3_SCRAPYARD', to: 'N6_HAZ_PATROL', cost: { time: 1, heat: 2, power: 1 } },
    { from: 'N6_HAZ_PATROL', to: 'N7_HAZ_LIGHT', cost: { time: 1, heat: 2, power: 1 } },
    { from: 'N7_HAZ_LIGHT', to: 'N7B_COMBAT_SKIRMISH', cost: { time: 1, heat: 1, power: 1 } },
    { from: 'N7B_COMBAT_SKIRMISH', to: 'N10_PART_C', cost: { time: 1, heat: 2, power: 1 } },
    { from: 'N5_PART_A', to: 'N9_PART_B', cost: { time: 1, heat: 3, power: 2 } },

    { from: 'N9_PART_B', to: 'N10_PART_C', cost: { time: 2, heat: 3, power: 1 } },
    { from: 'N10_PART_C', to: 'N0_HOME', cost: { time: 2, heat: 1, power: 2 } },
  ] as EdgeDef[],
} as const
