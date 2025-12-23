import { Vec2 } from "./state";

export type Phase = "COMMAND" | "EXECUTE" | "RESOLUTION";

export type CommandType =
  | "MOVE"
  | "DASH"
  | "SHOOT"
  | "RELOAD"
  | "HACK"
  | "USE_ITEM"
  | "LOOT"
  | "SEAL"
  | "EXTRACT";

export type DroneCommand =
  | { droneId: string; type: "MOVE"; params: { path: Vec2[] } }
  | { droneId: string; type: "DASH"; params: { path: Vec2[] } }
  | { droneId: string; type: "SHOOT"; params: { targetId: string } }
  | { droneId: string; type: "RELOAD" }
  | { droneId: string; type: "HACK"; params: { objectId: string; force?: boolean } }
  | { droneId: string; type: "USE_ITEM"; params: { itemId: string; targetId?: string; targetPos?: Vec2 } }
  | { droneId: string; type: "LOOT"; params: { crateId: string } }
  | { droneId: string; type: "SEAL"; params: { itemId: string } }
  | { droneId: string; type: "EXTRACT" };

export type WegoCommands = DroneCommand[];

export type SimEvent =
  | {
      type: "MovementResolved";
      unitId: string;
      from: Vec2;
      to: Vec2;
      success: boolean;
    }
  | {
      type: "ShotFired";
      attackerId: string;
      targetId: string;
      damage: number;
    }
  | {
      type: "DamageApplied";
      targetId: string;
      amount: number;
      hpLeft: number;
    }
  | {
      type: "StatusApplied";
      targetId: string;
      statusId: string;
      turns: number;
    }
  | {
      type: "DoorOpened";
      doorId: string;
      method: "hack" | "force";
    }
  | {
      type: "HackSucceeded";
      objectId: string;
    }
  | {
      type: "HackFailed";
      objectId: string;
      reason: string;
    }
  | {
      type: "LootPicked";
      unitId: string;
      crateId: string;
      items: string[];
    }
  | {
      type: "SealSucceeded";
      unitId: string;
      itemId: string;
    }
  | {
      type: "SealFailed";
      unitId: string;
      reason: string;
    }
  | {
      type: "ExtractionSuccess";
      unitId: string;
    }
  | {
      type: "MissionFailed";
      reason: string;
    }
  | {
      type: "PowerConsumed";
      amount: number;
      reason: string;
    }
  | {
      type: "CommandFailed";
      unitId: string;
      reason: string;
    }
  | {
      type: "PowerLow";
      turns: number;
    };

export interface ObservationTile {
  x: number;
  y: number;
  terrain: "floor" | "wall";
  cover?: "half" | "full";
  smoke?: number;
  doorId?: string;
  consoleId?: string;
  crateId?: string;
  extraction?: boolean;
}

export interface ObservationUnit {
  id: string;
  typeId: string;
  faction: "drone" | "enemy";
  pos: Vec2;
  hp: number;
  armor: number;
  statuses: { id: string; turns: number }[];
}

export interface ObservationInventory {
  unitId: string;
  backpackUsed: number;
  backpackCapacity: number;
  sealedItem: string | null;
}

export interface ObservationObject {
  id: string;
  pos: Vec2;
  type: "door" | "console" | "crate";
  state: string;
}

export interface Observation {
  turn: number;
  phase: Phase;
  seed: number;
  power: number;
  lowPowerState: { active: boolean; turns: number };
  grid: { width: number; height: number; tiles: ObservationTile[] };
  units: ObservationUnit[];
  inventory: ObservationInventory[];
  visibleObjects: ObservationObject[];
}
