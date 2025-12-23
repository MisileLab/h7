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
  const damageEvent = result.events.find(
    (event) => event.type === "DamageApplied" && event.targetId === enemy.id
  );
  expect(damageEvent).toBeTruthy();
});

it("step rejects MOVE with empty path", () => {
  const state = createInitialState(21);
  const drone = state.units["drone-1"];
  drone.pos = { x: 1, y: 1 };

  const result = step(state, [
    { droneId: drone.id, type: "MOVE", params: { path: [] } }
  ]);

  const movement = result.events.find(
    (event) => event.type === "MovementResolved" && event.unitId === drone.id
  );

  expect(movement).toBeTruthy();
  if (!movement || movement.type !== "MovementResolved") {
    throw new Error("Expected MovementResolved event");
  }
  expect(movement.success).toBe(false);
});

it("step moves a unit along a valid path", () => {
  const state = createInitialState(21);
  const drone = state.units["drone-1"];

  drone.pos = { x: 1, y: 1 };

  state.units["drone-2"].pos = { x: 2, y: 2 };
  state.units["drone-3"].pos = { x: 1, y: 2 };
  state.units["drone-4"].pos = { x: 1, y: 3 };

  const result = step(state, [
    {
      droneId: drone.id,
      type: "MOVE",
      params: { path: [drone.pos, { x: 2, y: 1 }] }
    }
  ]);

  const movement = result.events.find(
    (event) => event.type === "MovementResolved" && event.unitId === drone.id
  );

  expect(movement).toBeTruthy();
  if (!movement || movement.type !== "MovementResolved") {
    throw new Error("Expected MovementResolved event");
  }

  expect(movement.success).toBe(true);
  expect(result.nextState.units[drone.id]?.pos).toEqual({ x: 2, y: 1 });
});
