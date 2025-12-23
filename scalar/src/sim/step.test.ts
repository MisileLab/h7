import { expect, it } from "vitest";
import { step } from "./step";
import { createInitialState } from "./state";

it("step resolves a basic shoot command", () => {
  const state = createInitialState(21);
  const drone = state.units["drone-1"];
  const enemy = state.units["enemy-1"];
  drone.pos = { x: 1, y: 1 };
  enemy.pos = { x: 2, y: 1 };
  const result = step(state, [
    { droneId: drone.id, type: "SHOOT", params: { targetId: enemy.id } }
  ]);
  const damageEvent = result.events.find((event) => event.type === "DamageApplied" && event.targetId === enemy.id);
  expect(damageEvent).toBeTruthy();
});
