export type DroneRole = 'Scout' | 'Mule' | 'Hack'

export type NodeType = 'Extract' | 'Story' | 'Hazard' | 'Combat'

export type ResourceKey = 'power' | 'supplies' | 'parts'

export type EndingPartKey = 'PartA' | 'PartB' | 'PartC'

export type NodeId = string

export type EdgeId = string

export type StoryKey = string

export type HazardKey = string

export type ExtractKey = string

export type RunMode = 'Planning' | 'Execution'

export type Milestone = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6'

export function milestoneToNumber(milestone: Milestone): number {
  return Number(milestone.slice(1))
}

export function milestoneAtLeast(milestone: Milestone, target: Milestone): boolean {
  return milestoneToNumber(milestone) >= milestoneToNumber(target)
}
