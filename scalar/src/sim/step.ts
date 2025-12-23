import { ACTION_LIMITS, POWER } from "../shared/config";
import { buildEnemyCommands } from "./rules/ai";
import {
  applyDamage,
  applyKnockback,
  applyStatus,
  buildDamage,
  canShoot,
  tickStatuses
} from "./rules/combat";
import { canHack, tryOpenDoor, tryUseConsole } from "./rules/doors";
import { applyExtraction } from "./rules/extraction";
import { getTile, isPassable } from "./rules/grid";
import { tryLoot, trySeal } from "./rules/loot";
import { applyActionPowerCosts, applyMaintenance, updateLowPower } from "./rules/power";
import { DroneCommand, SimEvent, WegoCommands } from "./schemas";
import {
  cloneState,
  DRONE_BY_ID,
  ENEMY_BY_ID,
  GameState,
  getItem,
  ItemDef,
  StatusId,
  UnitState,
  Vec2
} from "./state";
import { buildObservation } from "./observe";

export interface StepResult {
  nextState: GameState;
  events: SimEvent[];
  observation: ReturnType<typeof buildObservation>;
}

export function step(state: GameState, commands: WegoCommands): StepResult {
  const nextState = cloneState(state);
  const events: SimEvent[] = [];

  if (nextState.mission.status !== "IN_PROGRESS") {
    return {
      nextState,
      events,
      observation: buildObservation(nextState, "RESOLUTION")
    };
  }

  applyMaintenance(nextState, events);
  updateLowPower(nextState, events);

  const playerCommands = sanitizePlayerCommands(commands, nextState, events);
  const paidCommands = applyActionPowerCosts(nextState, playerCommands, events);

  const enemyCommands = buildEnemyCommands(nextState);
  const allCommands = dedupeCommands([...paidCommands, ...enemyCommands], events);

  const moveCommands = allCommands.filter((command) => command.type === "MOVE" || command.type === "DASH");
  const otherCommands = allCommands.filter((command) => command.type !== "MOVE" && command.type !== "DASH");

  resolveMovement(nextState, moveCommands, events);

  const pendingDamage: ReturnType<typeof buildDamage>[] = [];
  const pendingHeals: { targetId: string; amount: number }[] = [];
  const pendingStatuses: { targetId: string; statusId: StatusId; turns: number }[] = [];
  const pendingSmoke: { center: Vec2; radius: number; turns: number }[] = [];

  for (const command of otherCommands) {
    const unit = nextState.units[command.droneId];
    if (!unit || unit.hp <= 0) {
      continue;
    }
    if (hasStatus(unit, "EMP")) {
      events.push({ type: "CommandFailed", unitId: unit.id, reason: "emp" });
      continue;
    }
    switch (command.type) {
      case "SHOOT": {
        const target = nextState.units[command.params.targetId];
        if (!target || target.hp <= 0) {
          events.push({ type: "CommandFailed", unitId: unit.id, reason: "invalid_target" });
          break;
        }
        const weapon = getUnitWeapon(unit);
        if (!weapon) {
          events.push({ type: "CommandFailed", unitId: unit.id, reason: "no_weapon" });
          break;
        }
        if (unit.faction === "drone") {
          const loadout = unit.loadout;
          if (!loadout || loadout.primary.ammo <= 0) {
            events.push({ type: "CommandFailed", unitId: unit.id, reason: "empty_ammo" });
            break;
          }
          if (!canShoot(nextState, unit, target, weapon)) {
            events.push({ type: "CommandFailed", unitId: unit.id, reason: "no_los" });
            break;
          }
          loadout.primary.ammo -= 1;
          events.push({
            type: "ShotFired",
            attackerId: unit.id,
            targetId: target.id,
            damage: weapon.damage ?? 0
          });
          pendingDamage.push(buildDamage(nextState, unit, target, weapon));
        } else {
          const template = ENEMY_BY_ID.get(unit.typeId);
          if (!template) {
            break;
          }
          if (!canShoot(nextState, unit, target, template.weapon)) {
            break;
          }
          events.push({
            type: "ShotFired",
            attackerId: unit.id,
            targetId: target.id,
            damage: template.weapon.damage
          });
          pendingDamage.push(buildDamage(nextState, unit, target, template));
        }
        break;
      }
      case "RELOAD": {
        if (!unit.loadout) {
          break;
        }
        unit.loadout.primary.ammo = unit.loadout.primary.maxAmmo;
        break;
      }
      case "HACK": {
        if (!canHack(nextState)) {
          events.push({ type: "HackFailed", objectId: command.params.objectId, reason: "low_power" });
          break;
        }
        if (command.params.force) {
          tryOpenDoor(nextState, unit, command.params.objectId, "force", events);
          break;
        }
        const door = nextState.doors[command.params.objectId];
        if (door) {
          tryOpenDoor(nextState, unit, door.id, "hack", events);
          break;
        }
        tryUseConsole(nextState, unit, command.params.objectId, events);
        break;
      }
      case "LOOT": {
        const crate = nextState.crates[command.params.crateId];
        if (!crate) {
          break;
        }
        tryLoot(unit, crate, events);
        break;
      }
      case "USE_ITEM": {
        if (!unit.loadout) {
          events.push({ type: "CommandFailed", unitId: unit.id, reason: "no_items" });
          break;
        }
        const consumable = unit.loadout.consumables.find(
          (item) => item.itemId === command.params.itemId && item.charges > 0
        );
        if (!consumable) {
          events.push({ type: "CommandFailed", unitId: unit.id, reason: "missing_item" });
          break;
        }
        const item = getItem(command.params.itemId);
        consumable.charges -= 1;
        if (!item.effect) {
          break;
        }
        if (item.effect.type === "heal") {
          const targetId = command.params.targetId ?? unit.id;
          const amount = (item.effect.amount ?? 0) + getRepairBonus(unit);
          pendingHeals.push({ targetId, amount });
        }
        if (item.effect.type === "status") {
          const targetId = command.params.targetId ?? unit.id;
          const turns = item.effect.duration ?? 1;
          pendingStatuses.push({ targetId, statusId: item.effect.status ?? "EMP", turns });
        }
        if (item.effect.type === "smoke") {
          const center = command.params.targetPos ?? unit.pos;
          const radius = item.effect.radius ?? 1;
          const turns = item.effect.duration ?? 1;
          pendingSmoke.push({ center, radius, turns });
        }
        break;
      }
      case "EXTRACT": {
        applyExtraction(nextState, unit, events);
        break;
      }
      default:
        break;
    }
  }

  const damagedUnits = applyDamage(nextState, pendingDamage, events);
  applyKnockback(nextState, pendingDamage);

  applyHeals(nextState, pendingHeals, events);
  applyStatuses(nextState, pendingStatuses, events);
  applySmoke(nextState, pendingSmoke);

  resolveSeals(nextState, paidCommands, damagedUnits, events);

  tickStatuses(nextState);
  tickSmoke(nextState);

  if (nextState.power > POWER.lowPowerThreshold && nextState.lowPower.active) {
    nextState.lowPower.active = false;
    nextState.lowPower.turns = 0;
  }

  if (nextState.mission.status === "IN_PROGRESS") {
    if (nextState.lowPower.active && nextState.lowPower.turns >= POWER.lowPowerTurnsToFail) {
      nextState.mission.status = "FAILED";
      nextState.mission.failureReason = "power_out";
      events.push({ type: "MissionFailed", reason: "power_out" });
    }

    if (isSquadWiped(nextState)) {
      nextState.mission.status = "FAILED";
      nextState.mission.failureReason = "squad_wipe";
      events.push({ type: "MissionFailed", reason: "squad_wipe" });
    }
  }

  nextState.turn += 1;

  return {
    nextState,
    events,
    observation: buildObservation(nextState, "RESOLUTION")
  };
}

function sanitizePlayerCommands(
  commands: WegoCommands,
  state: GameState,
  events: SimEvent[]
): DroneCommand[] {
  const filtered = commands.filter((command) => {
    const unit = state.units[command.droneId];
    return unit && unit.faction === "drone";
  });
  return dedupeCommands(filtered, events);
}

function dedupeCommands(commands: DroneCommand[], events: SimEvent[]): DroneCommand[] {
  const deduped: DroneCommand[] = [];
  const seen = new Set<string>();
  for (const command of commands) {
    if (seen.has(command.droneId)) {
      events.push({ type: "CommandFailed", unitId: command.droneId, reason: "duplicate_command" });
      continue;
    }
    seen.add(command.droneId);
    deduped.push(command);
  }
  return deduped;
}

function resolveMovement(state: GameState, commands: DroneCommand[], events: SimEvent[]): void {
  const occupied = new Set(Object.values(state.units).map((unit) => key(unit.pos)));
  const sorted = [...commands].sort((a, b) => a.droneId.localeCompare(b.droneId));
  for (const command of sorted) {
    const unit = state.units[command.droneId];
    if (!unit || unit.hp <= 0) {
      continue;
    }
    if (hasStatus(unit, "EMP")) {
      events.push({ type: "CommandFailed", unitId: unit.id, reason: "emp" });
      continue;
    }
    const path = command.params.path;
    if (path.length === 0 || !isPathValid(unit, path)) {
      events.push({ type: "MovementResolved", unitId: unit.id, from: unit.pos, to: unit.pos, success: false });
      continue;
    }
    const from = { ...unit.pos };
    const limit = command.type === "DASH" ? ACTION_LIMITS.dashMax : ACTION_LIMITS.moveMax;
    const penalty = state.lowPower.active ? POWER.lowPowerMovePenalty : 0;
    const allowed = Math.max(0, limit - penalty);
    const trimmedPath = path.slice(0, allowed + 1);
    let destination = from;
    for (let i = 1; i < trimmedPath.length; i += 1) {
      const step = trimmedPath[i];
      if (!isPassable(state.grid, step, state.doors)) {
        break;
      }
      destination = step;
    }
    if (destination.x === from.x && destination.y === from.y) {
      events.push({ type: "MovementResolved", unitId: unit.id, from, to: from, success: true });
      continue;
    }
    if (occupied.has(key(destination))) {
      events.push({ type: "MovementResolved", unitId: unit.id, from, to: from, success: false });
      continue;
    }
    occupied.delete(key(from));
    unit.pos = destination;
    occupied.add(key(destination));
    events.push({ type: "MovementResolved", unitId: unit.id, from, to: destination, success: true });
  }
}

function isPathValid(unit: UnitState, path: Vec2[]): boolean {
  if (path.length === 0) {
    return false;
  }
  if (path[0].x !== unit.pos.x || path[0].y !== unit.pos.y) {
    return false;
  }
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const next = path[i];
    const dx = Math.abs(next.x - prev.x);
    const dy = Math.abs(next.y - prev.y);
    if (dx + dy !== 1) {
      return false;
    }
  }
  return true;
}

function getUnitWeapon(unit: UnitState): ItemDef | null {
  if (!unit.loadout) {
    return null;
  }
  return getItem(unit.loadout.primary.itemId);
}

function applyHeals(state: GameState, heals: { targetId: string; amount: number }[], events: SimEvent[]): void {
  for (const heal of heals) {
    const target = state.units[heal.targetId];
    if (!target || target.hp <= 0 || heal.amount <= 0) {
      continue;
    }
    target.hp = Math.min(target.maxHp, target.hp + heal.amount);
    events.push({ type: "DamageApplied", targetId: target.id, amount: -heal.amount, hpLeft: target.hp });
  }
}

function applyStatuses(
  state: GameState,
  statuses: { targetId: string; statusId: StatusId; turns: number }[],
  events: SimEvent[]
): void {
  for (const entry of statuses) {
    const target = state.units[entry.targetId];
    if (!target) {
      continue;
    }
    applyStatus(target, entry.statusId, entry.turns);
    events.push({ type: "StatusApplied", targetId: target.id, statusId: entry.statusId, turns: entry.turns });
  }
}

function applySmoke(state: GameState, smoke: { center: Vec2; radius: number; turns: number }[]): void {
  for (const entry of smoke) {
    for (let y = entry.center.y - entry.radius; y <= entry.center.y + entry.radius; y += 1) {
      for (let x = entry.center.x - entry.radius; x <= entry.center.x + entry.radius; x += 1) {
        const tile = getTile(state.grid, { x, y });
        if (!tile) {
          continue;
        }
        if (Math.abs(entry.center.x - x) + Math.abs(entry.center.y - y) <= entry.radius) {
          tile.smoke = Math.max(tile.smoke ?? 0, entry.turns);
        }
      }
    }
  }
}

function resolveSeals(
  state: GameState,
  commands: DroneCommand[],
  damagedUnits: Set<string>,
  events: SimEvent[]
): void {
  for (const command of commands) {
    if (command.type !== "SEAL") {
      continue;
    }
    const unit = state.units[command.droneId];
    if (!unit || unit.hp <= 0) {
      continue;
    }
    if (damagedUnits.has(unit.id)) {
      events.push({ type: "SealFailed", unitId: unit.id, reason: "took_damage" });
      continue;
    }
    trySeal(unit, command.params.itemId, events);
  }
}

function tickSmoke(state: GameState): void {
  for (const tile of state.grid.tiles) {
    if (tile.smoke && tile.smoke > 0) {
      tile.smoke = tile.smoke - 1;
    }
    if (tile.smoke !== undefined && tile.smoke <= 0) {
      delete tile.smoke;
    }
  }
}

function isSquadWiped(state: GameState): boolean {
  return Object.values(state.units).every((unit) => unit.faction !== "drone" || unit.hp <= 0);
}

function hasStatus(unit: UnitState, status: string): boolean {
  return unit.statuses.some((statusState) => statusState.id === status && statusState.turns > 0);
}

function getRepairBonus(unit: UnitState): number {
  if (unit.faction !== "drone") {
    return 0;
  }
  const template = DRONE_BY_ID.get(unit.typeId);
  return template?.traits.repairBonus ?? 0;
}

function key(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}
