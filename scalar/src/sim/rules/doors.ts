import { GameState, UnitState, Vec2 } from "../state";
import { SimEvent } from "../schemas";
import { getTile } from "./grid";
import { CONSOLE, POWER } from "../../shared/config";

export function isAdjacent(a: Vec2, b: Vec2): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1 || (dx === 0 && dy === 0);
}

export function tryOpenDoor(
  state: GameState,
  unit: UnitState,
  doorId: string,
  method: "hack" | "force",
  events: SimEvent[]
): boolean {
  const door = state.doors[doorId];
  if (!door) {
    events.push({ type: "HackFailed", objectId: doorId, reason: "missing" });
    return false;
  }
  if (!isAdjacent(unit.pos, door.pos)) {
    events.push({ type: "HackFailed", objectId: doorId, reason: "not_adjacent" });
    return false;
  }
  if (door.open) {
    events.push({ type: "HackFailed", objectId: doorId, reason: "already_open" });
    return false;
  }
  door.locked = false;
  door.open = true;
  events.push({ type: "DoorOpened", doorId, method });
  return true;
}

export function tryUseConsole(
  state: GameState,
  unit: UnitState,
  consoleId: string,
  events: SimEvent[]
): boolean {
  const console = state.consoles[consoleId];
  if (!console) {
    events.push({ type: "HackFailed", objectId: consoleId, reason: "missing" });
    return false;
  }
  if (!isAdjacent(unit.pos, console.pos)) {
    events.push({ type: "HackFailed", objectId: consoleId, reason: "not_adjacent" });
    return false;
  }
  if (console.used) {
    events.push({ type: "HackFailed", objectId: consoleId, reason: "used" });
    return false;
  }
  console.used = true;
  state.power += CONSOLE.powerRestore;
  events.push({ type: "HackSucceeded", objectId: consoleId });
  events.push({ type: "PowerConsumed", amount: -CONSOLE.powerRestore, reason: "console" });
  return true;
}

export function getObjectAt(state: GameState, pos: Vec2): { type: "door" | "console" | "crate"; id: string } | null {
  const tile = getTile(state.grid, pos);
  if (!tile) {
    return null;
  }
  if (tile.doorId) {
    return { type: "door", id: tile.doorId };
  }
  if (tile.consoleId) {
    return { type: "console", id: tile.consoleId };
  }
  if (tile.crateId) {
    return { type: "crate", id: tile.crateId };
  }
  return null;
}

export function canHack(state: GameState): boolean {
  if (state.lowPower.active && POWER.lowPowerHackDisabled) {
    return false;
  }
  return true;
}
