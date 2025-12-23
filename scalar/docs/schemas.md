# Scalar Schema Reference

## DroneCommand

Commands issued by the player for their drones.

```typescript
type DroneCommand =
  | { droneId: string; type: "MOVE"; params: { path: Vec2[] } }
  | { droneId: string; type: "DASH"; params: { path: Vec2[] } }
  | { droneId: string; type: "SHOOT"; params: { targetId: string } }
  | { droneId: string; type: "RELOAD" }
  | { droneId: string; type: "HACK"; params: { objectId: string; force?: boolean } }
  | { droneId: string; type: "USE_ITEM"; params: { itemId: string; targetId?: string; targetPos?: Vec2 } }
  | { droneId: string; type: "LOOT"; params: { crateId: string } }
  | { droneId: string; type: "SEAL"; params: { itemId: string } }
  | { droneId: string; type: "EXTRACT" };
```

### Examples

**Move**:
```json
{ "droneId": "drone-1", "type": "MOVE", "params": { "path": [{ "x": 1, "y": 1 }, { "x": 1, "y": 2 }] } }
```

**Shoot**:
```json
{ "droneId": "drone-2", "type": "SHOOT", "params": { "targetId": "enemy-1" } }
```

---

## Observation

The partial state of the simulation visible to a player or agent.

```typescript
interface Observation {
  turn: number;
  phase: "COMMAND" | "EXECUTE" | "RESOLUTION";
  seed: number;
  power: number;
  lowPowerState: { active: boolean; turns: number };
  grid: {
    width: number;
    height: number;
    tiles: ObservationTile[];
  };
  units: ObservationUnit[];
  inventory: ObservationInventory[];
  visibleObjects: ObservationObject[];
}

interface ObservationUnit {
  id: string;
  typeId: string;
  faction: "drone" | "enemy";
  pos: { x: number; y: number };
  hp: number;
  armor: number;
  statuses: { id: string; turns: number }[];
}

interface ObservationTile {
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
```

---

## SimEvent

Events generated during a simulation step for UI logging and animation.

```typescript
type SimEvent =
  | { type: "MovementResolved"; unitId: string; from: Vec2; to: Vec2; success: boolean }
  | { type: "ShotFired"; attackerId: string; targetId: string; damage: number }
  | { type: "DamageApplied"; targetId: string; amount: number; hpLeft: number }
  | { type: "StatusApplied"; targetId: string; statusId: string; turns: number }
  | { type: "DoorOpened"; doorId: string; method: "hack" | "force" }
  | { type: "HackSucceeded"; objectId: string }
  | { type: "HackFailed"; objectId: string; reason: string }
  | { type: "LootPicked"; unitId: string; crateId: string; items: string[] }
  | { type: "SealSucceeded"; unitId: string; itemId: string }
  | { type: "SealFailed"; unitId: string; reason: string }
  | { type: "ExtractionSuccess"; unitId: string }
  | { type: "MissionFailed"; reason: string }
  | { type: "PowerConsumed"; amount: number; reason: string }
  | { type: "CommandFailed"; unitId: string; reason: string }
  | { type: "PowerLow"; turns: number };
```
