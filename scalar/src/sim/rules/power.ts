import { ACTION_COSTS, POWER } from "../../shared/config";
import { DRONE_BY_ID, GameState, StatusId, UnitState } from "../state";
import { DroneCommand, SimEvent } from "../schemas";

export function applyMaintenance(state: GameState, events: SimEvent[]): void {
  const aliveDrones = Object.values(state.units).filter(
    (unit) => unit.faction === "drone" && unit.hp > 0
  );
  const cost = aliveDrones.length * POWER.maintenancePerDrone;
  if (cost > 0) {
    state.power -= cost;
    events.push({ type: "PowerConsumed", amount: cost, reason: "maintenance" });
  }
}

export function updateLowPower(state: GameState, events: SimEvent[]): void {
  if (state.power <= POWER.lowPowerThreshold) {
    state.lowPower.active = true;
    state.lowPower.turns += 1;
    events.push({ type: "PowerLow", turns: state.lowPower.turns });
  } else {
    state.lowPower.active = false;
    state.lowPower.turns = 0;
  }
}

export function applyActionPowerCosts(
  state: GameState,
  commands: DroneCommand[],
  events: SimEvent[]
): DroneCommand[] {
  const sorted = [...commands].sort((a, b) => a.droneId.localeCompare(b.droneId));
  const approved: DroneCommand[] = [];

  for (const command of sorted) {
    const unit = state.units[command.droneId];
    if (!unit || unit.hp <= 0) {
      continue;
    }
    const cost = getActionPowerCost(state, unit, command);
    if (cost > state.power) {
      events.push({ type: "CommandFailed", unitId: unit.id, reason: "insufficient_power" });
      continue;
    }
    if (cost > 0) {
      state.power -= cost;
      events.push({ type: "PowerConsumed", amount: cost, reason: "action" });
    }
    approved.push(command);
  }

  return approved;
}

export function getActionPowerCost(state: GameState, unit: UnitState, command: DroneCommand): number {
  switch (command.type) {
    case "DASH": {
      const cost = ACTION_COSTS.dash + getDashCostMod(unit);
      return Math.max(0, cost);
    }
    case "SHOOT":
      return ACTION_COSTS.shoot;
    case "RELOAD":
      return ACTION_COSTS.reload;
    case "USE_ITEM":
      return ACTION_COSTS.useItem;
    case "HACK":
      return command.params.force ? ACTION_COSTS.forceDoor : getHackCost(state, unit);
    case "LOOT": {
      const cost = getLootCostMod(unit);
      return Math.max(0, cost);
    }
    case "SEAL":
      return ACTION_COSTS.sealAction + ACTION_COSTS.sealExtra;
    default:
      return 0;
  }
}

function getHackCost(state: GameState, unit: UnitState): number {
  const traitMod = getTrait(unit, "hackCostMod");
  const jamMod = hasStatus(unit, "JAMMED") ? 1 : 0;
  const base = ACTION_COSTS.hack + traitMod + jamMod;
  return Math.max(1, base);
}

function getDashCostMod(unit: UnitState): number {
  return getTrait(unit, "dashCostMod");
}

function getLootCostMod(unit: UnitState): number {
  return getTrait(unit, "lootCostMod");
}

function getTrait(unit: UnitState, key: "hackCostMod" | "dashCostMod" | "lootCostMod"): number {
  if (unit.faction !== "drone") {
    return 0;
  }
  const template = DRONE_BY_ID.get(unit.typeId);
  if (!template) {
    return 0;
  }
  return template.traits[key] ?? 0;
}

function hasStatus(unit: UnitState, statusId: StatusId): boolean {
  return unit.statuses.some((status) => status.id === statusId && status.turns > 0);
}
