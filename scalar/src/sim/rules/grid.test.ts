import { describe, expect, it } from "vitest";
import { lineOfSight } from "./grid";
import { DoorState, GridState, TileState } from "../state";

function makeGrid(width: number, height: number, walls: Set<string>): GridState {
  const tiles: TileState[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      tiles.push({ x, y, terrain: walls.has(key) ? "wall" : "floor" });
    }
  }
  return { width, height, tiles };
}

describe("grid lineOfSight", () => {
  it("blocks LOS through walls", () => {
    const grid = makeGrid(3, 1, new Set(["1,0"]));
    const doors: Record<string, DoorState> = {};
    const visible = lineOfSight(grid, doors, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(visible).toBe(false);
  });

  it("allows LOS without walls", () => {
    const grid = makeGrid(3, 1, new Set());
    const doors: Record<string, DoorState> = {};
    const visible = lineOfSight(grid, doors, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(visible).toBe(true);
  });
});
