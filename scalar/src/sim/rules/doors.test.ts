import { expect, it } from "vitest";
import { tryOpenDoor } from "./doors";
import { createInitialState } from "../state";
import { SimEvent } from "../schemas";

it("tryOpenDoor unlocks and opens door", () => {
  const state = createInitialState(5);
  const doorId = Object.keys(state.doors)[0];
  const door = state.doors[doorId];
  const unit = state.units["drone-1"];
  unit.pos = { ...door.pos };
  const events: SimEvent[] = [];
  tryOpenDoor(state, unit, doorId, "hack", events);
  expect(state.doors[doorId].open).toBe(true);
  expect(state.doors[doorId].locked).toBe(false);
});
