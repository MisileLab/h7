import { ACTION_LIMITS, GRID, POWER } from "../shared/config";
import itemsData from "../shared/data/items.json";
import unitsData from "../shared/data/units.json";
import roomsData from "../shared/data/rooms.json";
import { createRng, pickOne, RngState } from "./rng";
import { buildRaidGrid } from "./rules/grid";

export type Faction = "drone" | "enemy";
export type StatusId = "EMP" | "JAMMED" | "SHRED" | "MARKED";

export interface Vec2 {
  x: number;
  y: number;
}

export interface StatusState {
  id: StatusId;
  turns: number;
}

export interface ItemEffect {
  type: "heal" | "status" | "smoke";
  amount?: number;
  status?: StatusId;
  duration?: number;
  radius?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: "weapon" | "module" | "consumable" | "loot";
  slot?: "primary" | "secondary";
  size: number;
  damage?: number;
  range?: number;
  maxAmmo?: number;
  charges?: number;
  effect?: ItemEffect;
  statusOnHit?: { status: StatusId; turns: number };
}

export interface DroneTemplate {
  id: string;
  name: string;
  hp: number;
  armor: number;
  traits: {
    hackCostMod?: number;
    repairBonus?: number;
    lootCostMod?: number;
    dashCostMod?: number;
    startOfFightMark?: boolean;
  };
}

export interface EnemyTemplate {
  id: string;
  name: string;
  hp: number;
  armor: number;
  role: string;
  weapon: {
    damage: number;
    range: number;
  };
  statusOnHit?: { status: StatusId; turns: number };
  knockback?: number;
}

export interface WeaponState {
  itemId: string;
  ammo: number;
  maxAmmo: number;
}

export interface ConsumableState {
  itemId: string;
  charges: number;
}

export interface InventoryState {
  backpack: ItemStack[];
  capacity: number;
  sealedItem: ItemStack | null;
}

export interface ItemStack {
  itemId: string;
  size: number;
}

export interface LoadoutState {
  primary: WeaponState;
  secondary: WeaponState;
  modules: string[];
  consumables: ConsumableState[];
}

export interface UnitState {
  id: string;
  typeId: string;
  faction: Faction;
  pos: Vec2;
  hp: number;
  maxHp: number;
  armor: number;
  statuses: StatusState[];
  loadout?: LoadoutState;
  inventory?: InventoryState;
  aiRole?: string;
}

export interface DoorState {
  id: string;
  pos: Vec2;
  locked: boolean;
  open: boolean;
}

export interface ConsoleState {
  id: string;
  pos: Vec2;
  used: boolean;
}

export interface CrateState {
  id: string;
  pos: Vec2;
  items: ItemStack[];
  opened: boolean;
}

export interface TileState {
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

export interface GridState {
  width: number;
  height: number;
  tiles: TileState[];
}

export interface LowPowerState {
  active: boolean;
  turns: number;
}

export interface MissionState {
  status: "IN_PROGRESS" | "EXTRACTED" | "FAILED";
  failureReason?: string;
}

export interface GameState {
  seed: number;
  rng: RngState;
  turn: number;
  power: number;
  lowPower: LowPowerState;
  grid: GridState;
  doors: Record<string, DoorState>;
  consoles: Record<string, ConsoleState>;
  crates: Record<string, CrateState>;
  units: Record<string, UnitState>;
  extractionPos: Vec2;
  mission: MissionState;
}

export const ITEMS: ItemDef[] = itemsData.items as ItemDef[];
export const DRONES: DroneTemplate[] = unitsData.drones as DroneTemplate[];
export const ENEMIES: EnemyTemplate[] = unitsData.enemies as EnemyTemplate[];
export const ROOMS = roomsData.rooms as { id: string; tiles: string[] }[];

export const ITEM_BY_ID = new Map<string, ItemDef>(ITEMS.map((item) => [item.id, item]));
export const DRONE_BY_ID = new Map<string, DroneTemplate>(DRONES.map((unit) => [unit.id, unit]));
export const ENEMY_BY_ID = new Map<string, EnemyTemplate>(ENEMIES.map((unit) => [unit.id, unit]));

export function getItem(itemId: string): ItemDef {
  const item = ITEM_BY_ID.get(itemId);
  if (!item) {
    throw new Error(`Unknown item: ${itemId}`);
  }
  return item;
}

export function createInitialState(seed: number): GameState {
  let rng = createRng(seed);
  const { grid, doors, consoles, crates, extractionPos, rng: nextRng } = buildRaidGrid(
    rng,
    ROOMS,
    GRID.roomCount
  );
  rng = nextRng;

  const units: Record<string, UnitState> = {};
  const startPositions: Vec2[] = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 }
  ];
  const startSquad = ["bulwark", "striker", "specter", "patcher"];

  startSquad.forEach((chassisId, index) => {
    const template = DRONE_BY_ID.get(chassisId);
    if (!template) {
      throw new Error(`Missing drone template: ${chassisId}`);
    }
    const primary = createWeaponState("arc-rifle");
    const secondary = createWeaponState("sidearm");
    const modules = ["aegis-plate", "dash-coupler"].slice(0, 2);
    const consumables = [createConsumableState("repair-foam"), createConsumableState("smoke-canister")];
    units[`drone-${index + 1}`] = {
      id: `drone-${index + 1}`,
      typeId: template.id,
      faction: "drone",
      pos: startPositions[index],
      hp: template.hp,
      maxHp: template.hp,
      armor: template.armor,
      statuses: [],
      loadout: {
        primary,
        secondary,
        modules,
        consumables
      },
      inventory: {
        backpack: [],
        capacity: ACTION_LIMITS.backpackSlots,
        sealedItem: null
      }
    };
  });

  let enemyCounter = 1;
  for (let roomIndex = 1; roomIndex < GRID.roomCount; roomIndex += 1) {
    const offsetX = roomIndex * (GRID.roomWidth + GRID.corridorWidth);
    const targetX = offsetX + 4;
    const targetY = 4;
    const pick = pickOne(rng, ENEMIES);
    rng = pick.state;
    units[`enemy-${enemyCounter}`] = {
      id: `enemy-${enemyCounter}`,
      typeId: pick.value.id,
      faction: "enemy",
      pos: { x: targetX, y: targetY },
      hp: pick.value.hp,
      maxHp: pick.value.hp,
      armor: pick.value.armor,
      statuses: [],
      aiRole: pick.value.role
    };
    enemyCounter += 1;
  }

  const scoutActive = Object.values(units).some((unit) => {
    if (unit.faction !== "drone") {
      return false;
    }
    const template = DRONE_BY_ID.get(unit.typeId);
    return Boolean(template && template.traits.startOfFightMark);
  });
  if (scoutActive) {
    const markedTarget = Object.values(units)
      .filter((unit) => unit.faction === "enemy" && unit.hp > 0)
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (markedTarget) {
      markedTarget.statuses.push({ id: "MARKED", turns: 1 });
    }
  }

  return {
    seed,
    rng,
    turn: 1,
    power: POWER.start,
    lowPower: { active: false, turns: 0 },
    grid,
    doors,
    consoles,
    crates,
    units,
    extractionPos,
    mission: { status: "IN_PROGRESS" }
  };
}

export function createWeaponState(itemId: string): WeaponState {
  const item = getItem(itemId);
  if (!item.maxAmmo) {
    throw new Error(`Weapon missing maxAmmo: ${itemId}`);
  }
  return {
    itemId,
    ammo: item.maxAmmo,
    maxAmmo: item.maxAmmo
  };
}

export function createConsumableState(itemId: string): ConsumableState {
  const item = getItem(itemId);
  const charges = item.charges ?? 1;
  return { itemId, charges };
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function getUnit(state: GameState, unitId: string): UnitState {
  const unit = state.units[unitId];
  if (!unit) {
    throw new Error(`Missing unit: ${unitId}`);
  }
  return unit;
}
