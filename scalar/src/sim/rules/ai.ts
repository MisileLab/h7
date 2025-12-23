import { findPath } from "./grid";
import { ENEMY_BY_ID, GameState, UnitState } from "../state";
import { DroneCommand } from "../schemas";
import { canShoot } from "./combat";

export function buildEnemyCommands(state: GameState): DroneCommand[] {
  const enemies = Object.values(state.units).filter(
    (unit) => unit.faction === "enemy" && unit.hp > 0
  );
  const drones = Object.values(state.units).filter(
    (unit) => unit.faction === "drone" && unit.hp > 0
  );

  const commands: DroneCommand[] = [];

  for (const enemy of enemies) {
    if (enemy.statuses.some((status) => status.id === "EMP" && status.turns > 0)) {
      continue;
    }
    const target = pickNearestTarget(enemy, drones);
    if (!target) {
      continue;
    }
    const weapon = getEnemyWeapon(enemy);
    const shouldHoldPosition = enemy.aiRole?.includes("turret") || enemy.aiRole === "camera";
    if (weapon && canShoot(state, enemy, target, weapon)) {
      commands.push({
        droneId: enemy.id,
        type: "SHOOT",
        params: { targetId: target.id }
      });
      continue;
    }
    if (shouldHoldPosition) {
      continue;
    }
    const path = findPath(state.grid, state.doors, enemy.pos, target.pos);
    const movePath = path.slice(0, 4);
    if (movePath.length > 1) {
      commands.push({
        droneId: enemy.id,
        type: "MOVE",
        params: { path: movePath }
      });
    }
  }

  return commands;
}

function pickNearestTarget(enemy: UnitState, drones: UnitState[]): UnitState | null {
  let best: UnitState | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const drone of drones) {
    const distance = Math.abs(drone.pos.x - enemy.pos.x) + Math.abs(drone.pos.y - enemy.pos.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = drone;
    }
    if (distance === bestDistance && best && drone.id < best.id) {
      best = drone;
    }
  }
  return best;
}

function getEnemyWeapon(enemy: UnitState): { range: number } | null {
  const template = ENEMY_BY_ID.get(enemy.typeId);
  if (!template) {
    return null;
  }
  return template.weapon;
}
