import { expect, it } from "vitest";
import { applyMaintenance } from "./power";
import { createInitialState } from "../state";

it("applyMaintenance drains power per alive drone", () => {
  const state = createInitialState(7);
  state.power = 10;
  const droneIds = Object.values(state.units)
    .filter((unit) => unit.faction === "drone")
    .map((unit) => unit.id);
  state.units[droneIds[2]].hp = 0;
  state.units[droneIds[3]].hp = 0;
  applyMaintenance(state, []);
  expect(state.power).toBe(8);
});
