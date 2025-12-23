import { expect, it } from "vitest";
import { buildEnemyCommands } from "./ai";
import { createInitialState } from "../state";

it("buildEnemyCommands shoots when target in range", () => {
  const state = createInitialState(11);
  const enemy = state.units["enemy-1"];
  const drone = state.units["drone-1"];
  const drone2 = state.units["drone-2"];
  enemy.pos = { x: 3, y: 1 };
  drone.pos = { x: 4, y: 1 };
  drone2.pos = { x: 100, y: 100 };
  const commands = buildEnemyCommands(state);
  expect(commands.some((cmd) => cmd.type === "SHOOT" && cmd.params.targetId === drone.id)).toBe(true);
});
