import { expect, it } from "vitest";
import { applyDamage, buildDamage } from "./combat";
import { createInitialState, getItem } from "../state";

it("buildDamage accounts for armor and cover", () => {
  const state = createInitialState(1);
  const attacker = state.units["drone-1"];
  const target = state.units["enemy-1"];
  attacker.pos = { x: 1, y: 1 };
  target.pos = { x: 2, y: 1 };
  const tile = state.grid.tiles.find((t) => t.x === 2 && t.y === 1);
  if (tile) {
    tile.cover = "full";
  }
  target.armor = 1;
  const weapon = getItem("arc-rifle");
  const pending = buildDamage(state, attacker, target, weapon);
  expect(pending.amount).toBe(1);
});

it("applyDamage applies status on hit", () => {
  const state = createInitialState(2);
  const attacker = state.units["drone-1"];
  const target = state.units["enemy-1"];
  attacker.pos = { x: 1, y: 1 };
  target.pos = { x: 2, y: 1 };
  const weapon = getItem("coil-cannon");
  const pending = [buildDamage(state, attacker, target, weapon)];
  applyDamage(state, pending, []);
  expect(target.statuses.some((status) => status.id === "SHRED")).toBe(true);
});
