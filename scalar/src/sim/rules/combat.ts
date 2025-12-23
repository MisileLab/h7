import { COMBAT } from "../../shared/config";
import { getCoverReduction, isPassable, lineOfSight } from "./grid";
import {
  EnemyTemplate,
  GameState,
  ItemDef,
  StatusId,
  UnitState,
  Vec2
} from "../state";
import { SimEvent } from "../schemas";

export interface PendingDamage {
  targetId: string;
  sourcePos: Vec2;
  amount: number;
  status?: { id: StatusId; turns: number };
  knockback?: number;
}

export function canShoot(
  state: GameState,
  attacker: UnitState,
  target: UnitState,
  weapon: { range: number }
): boolean {
  const range = weapon.range;
  const distance = Math.abs(attacker.pos.x - target.pos.x) + Math.abs(attacker.pos.y - target.pos.y);
  if (distance > range) {
    return false;
  }
  return lineOfSight(state.grid, state.doors, attacker.pos, target.pos);
}

export function buildDamage(
  state: GameState,
  attacker: UnitState,
  target: UnitState,
  weapon: ItemDef | EnemyTemplate
): PendingDamage {
  let baseDamage = 0;
  if ("weapon" in weapon) {
    baseDamage = weapon.weapon.damage;
  } else {
    baseDamage = weapon.damage ?? 0;
  }

  const cover = getCoverReduction(state.grid, target.pos);
  const coverReduction = applyMarked(target, cover);
  const armorReduction = Math.max(0, target.armor - getShredStacks(target));
  const damage = Math.max(0, baseDamage - armorReduction - coverReduction);
  const statusOnHit = getStatusOnHit(weapon);
  const knockback = "knockback" in weapon && weapon.knockback ? weapon.knockback : 0;
  return {
    targetId: target.id,
    sourcePos: { ...attacker.pos },
    amount: damage,
    status: statusOnHit,
    knockback: knockback > 0 ? knockback : undefined
  };
}

export function applyDamage(
  state: GameState,
  pending: PendingDamage[],
  events: SimEvent[]
): Set<string> {
  const damaged = new Set<string>();
  const grouped = new Map<string, PendingDamage[]>();
  for (const entry of pending) {
    const list = grouped.get(entry.targetId) ?? [];
    list.push(entry);
    grouped.set(entry.targetId, list);
  }

  for (const [targetId, entries] of grouped.entries()) {
    const target = state.units[targetId];
    if (!target) {
      continue;
    }
    const totalDamage = entries.reduce((sum, entry) => sum + entry.amount, 0);
    if (totalDamage !== 0) {
      target.hp = Math.max(0, target.hp - totalDamage);
      damaged.add(targetId);
      events.push({
        type: "DamageApplied",
        targetId,
        amount: totalDamage,
        hpLeft: target.hp
      });
    }
    for (const entry of entries) {
      if (entry.status) {
        applyStatus(target, entry.status.id, entry.status.turns);
        events.push({
          type: "StatusApplied",
          targetId,
          statusId: entry.status.id,
          turns: entry.status.turns
        });
      }
    }
  }

  return damaged;
}

export function applyKnockback(state: GameState, pending: PendingDamage[]): void {
  const occupied = new Set(
    Object.values(state.units)
      .filter((unit) => unit.hp > 0)
      .map((unit) => `${unit.pos.x},${unit.pos.y}`)
  );
  for (const entry of pending) {
    if (!entry.knockback || entry.knockback <= 0) {
      continue;
    }
    const target = state.units[entry.targetId];
    if (!target || target.hp <= 0) {
      continue;
    }
    const direction = getKnockbackDirection(entry.sourcePos, target.pos);
    if (!direction) {
      continue;
    }
    let current = { ...target.pos };
    for (let i = 0; i < entry.knockback; i += 1) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      if (!isPassable(state.grid, next, state.doors)) {
        break;
      }
      const key = `${next.x},${next.y}`;
      if (occupied.has(key)) {
        break;
      }
      occupied.delete(`${current.x},${current.y}`);
      occupied.add(key);
      current = next;
    }
    target.pos = current;
  }
}

function getKnockbackDirection(from: Vec2, to: Vec2): Vec2 | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return null;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: Math.sign(dx), y: 0 };
  }
  return { x: 0, y: Math.sign(dy) };
}

export function applyStatus(unit: UnitState, statusId: StatusId, turns: number): void {
  const existing = unit.statuses.find((status) => status.id === statusId);
  if (existing) {
    existing.turns = Math.max(existing.turns, turns);
  } else {
    unit.statuses.push({ id: statusId, turns });
  }
}

export function tickStatuses(state: GameState): void {
  for (const unit of Object.values(state.units)) {
    unit.statuses = unit.statuses
      .map((status) => ({ ...status, turns: status.turns - 1 }))
      .filter((status) => status.turns > 0);
  }
}

export function applyMarked(target: UnitState, coverReduction: number): number {
  const marked = target.statuses.some((status) => status.id === "MARKED" && status.turns > 0);
  if (!marked) {
    return coverReduction;
  }
  return Math.max(0, coverReduction - COMBAT.cover.half);
}

export function getShredStacks(target: UnitState): number {
  return target.statuses.filter((status) => status.id === "SHRED" && status.turns > 0).length;
}

function getStatusOnHit(weapon: ItemDef | EnemyTemplate): { id: StatusId; turns: number } | undefined {
  if ("statusOnHit" in weapon && weapon.statusOnHit) {
    return { id: weapon.statusOnHit.status, turns: weapon.statusOnHit.turns };
  }
  return undefined;
}
