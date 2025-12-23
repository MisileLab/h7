import { GRID } from "../../shared/config";
import itemsData from "../../shared/data/items.json";
import { nextInt, pickOne, RngState } from "../rng";
import { CrateState, DoorState, GridState, TileState, Vec2 } from "../state";

const LOOT_ITEMS = (itemsData.items as { id: string; kind: string; size: number }[]).filter(
  (item) => item.kind === "loot"
);

export function buildRaidGrid(
  rng: RngState,
  rooms: { id: string; tiles: string[] }[],
  roomCount: number
): {
  grid: GridState;
  doors: Record<string, DoorState>;
  consoles: Record<string, { id: string; pos: Vec2; used: boolean }>;
  crates: Record<string, CrateState>;
  extractionPos: Vec2;
  rng: RngState;
} {
  const width = roomCount * GRID.roomWidth + (roomCount - 1) * GRID.corridorWidth;
  const height = GRID.roomHeight;
  const tiles: TileState[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({ x, y, terrain: "wall" });
    }
  }

  const doors: Record<string, DoorState> = {};
  const consoles: Record<string, { id: string; pos: Vec2; used: boolean }> = {};
  const crates: Record<string, CrateState> = {};
  let extractionPos: Vec2 = { x: width - 2, y: Math.floor(height / 2) };
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const reservedIds = new Set(["start", "power", "loot", "extraction"]);
  const standardRooms = rooms.filter((room) => !reservedIds.has(room.id));

  for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
    let template = roomsById.get("standard") ?? rooms[0];
    if (roomIndex === 0) {
      template = roomsById.get("start") ?? template;
    } else if (roomIndex === 1) {
      template = roomsById.get("power") ?? template;
    } else if (roomIndex === 2) {
      template = roomsById.get("loot") ?? template;
    } else if (roomIndex === roomCount - 1) {
      template = roomsById.get("extraction") ?? template;
    } else {
      const pool = standardRooms.length > 0 ? standardRooms : rooms;
      const pick = pickOne(rng, pool);
      rng = pick.state;
      template = pick.value;
    }
    const offsetX = roomIndex * (GRID.roomWidth + GRID.corridorWidth);

    for (let y = 0; y < GRID.roomHeight; y += 1) {
      const row = template.tiles[y];
      for (let x = 0; x < GRID.roomWidth; x += 1) {
        const char = row[x];
        const tileX = offsetX + x;
        const tileY = y;
        const tile = tileAt(tiles, width, tileX, tileY);
        applyTemplateChar(tile, char);

        if (char === "C") {
          const consoleId = `console-${roomIndex}-${x}-${y}`;
          tile.consoleId = consoleId;
          consoles[consoleId] = { id: consoleId, pos: { x: tileX, y: tileY }, used: false };
        }

        if (char === "L") {
          const crateId = `crate-${roomIndex}-${x}-${y}`;
          tile.crateId = crateId;
          const loot = rollCrateLoot(rng, 2, 3);
          rng = loot.rng;
          crates[crateId] = {
            id: crateId,
            pos: { x: tileX, y: tileY },
            items: loot.items,
            opened: false
          };
        }

        if (char === "E" && roomIndex === roomCount - 1) {
          tile.extraction = true;
          extractionPos = { x: tileX, y: tileY };
        }
      }
    }

    if (roomIndex < roomCount - 1) {
      const corridorX = offsetX + GRID.roomWidth;
      for (let y = 0; y < GRID.roomHeight; y += 1) {
        const tile = tileAt(tiles, width, corridorX, y);
        tile.terrain = "wall";
      }
      const doorY = Math.floor(GRID.roomHeight / 2);
      const doorId = `door-${roomIndex + 1}`;
      const doorTile = tileAt(tiles, width, corridorX, doorY);
      doorTile.terrain = "floor";
      doorTile.doorId = doorId;
      doors[doorId] = {
        id: doorId,
        pos: { x: corridorX, y: doorY },
        locked: roomIndex % 2 === 0,
        open: false
      };
    }
  }

  return {
    grid: { width, height, tiles },
    doors,
    consoles,
    crates,
    extractionPos,
    rng
  };
}

function applyTemplateChar(tile: TileState, char: string): void {
  if (char === "#") {
    tile.terrain = "wall";
    return;
  }
  tile.terrain = "floor";
  tile.cover = undefined;
  if (char === "H") {
    tile.cover = "half";
  }
  if (char === "F") {
    tile.cover = "full";
  }
}

function rollCrateLoot(
  rng: RngState,
  minItems: number,
  maxItems: number
): { items: { itemId: string; size: number }[]; rng: RngState } {
  const countRoll = nextInt(rng, minItems, maxItems);
  rng = countRoll.state;
  const items: { itemId: string; size: number }[] = [];
  for (let i = 0; i < countRoll.value; i += 1) {
    const pick = pickOne(rng, LOOT_ITEMS);
    rng = pick.state;
    items.push({ itemId: pick.value.id, size: pick.value.size });
  }
  return { items, rng };
}

export function tileAt(tiles: TileState[], width: number, x: number, y: number): TileState {
  return tiles[y * width + x];
}

export function inBounds(grid: GridState, pos: Vec2): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < grid.width && pos.y < grid.height;
}

export function getTile(grid: GridState, pos: Vec2): TileState | null {
  if (!inBounds(grid, pos)) {
    return null;
  }
  return tileAt(grid.tiles, grid.width, pos.x, pos.y);
}

export function isPassable(grid: GridState, pos: Vec2, doors: Record<string, DoorState>): boolean {
  const tile = getTile(grid, pos);
  if (!tile) {
    return false;
  }
  if (tile.terrain === "wall") {
    return false;
  }
  if (tile.doorId) {
    const door = doors[tile.doorId];
    return door ? door.open : false;
  }
  return true;
}

export function isTransparent(grid: GridState, pos: Vec2, doors: Record<string, DoorState>): boolean {
  const tile = getTile(grid, pos);
  if (!tile) {
    return false;
  }
  if (tile.terrain === "wall") {
    return false;
  }
  if (tile.doorId) {
    const door = doors[tile.doorId];
    if (door && !door.open) {
      return false;
    }
  }
  if (tile.smoke && tile.smoke > 0) {
    return false;
  }
  return true;
}

export function getCoverReduction(grid: GridState, target: Vec2): number {
  const tile = getTile(grid, target);
  if (!tile || !tile.cover) {
    return 0;
  }
  return tile.cover === "full" ? 2 : 1;
}

export function lineOfSight(
  grid: GridState,
  doors: Record<string, DoorState>,
  from: Vec2,
  to: Vec2
): boolean {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  let x = from.x;
  let y = from.y;
  let n = 1 + dx + dy;
  const xInc = to.x > from.x ? 1 : -1;
  const yInc = to.y > from.y ? 1 : -1;
  let error = dx - dy;
  const dx2 = dx * 2;
  const dy2 = dy * 2;

  for (; n > 0; n -= 1) {
    if (!(x === from.x && y === from.y)) {
      if (!isTransparent(grid, { x, y }, doors)) {
        return false;
      }
    }
    if (x === to.x && y === to.y) {
      break;
    }
    if (error > 0) {
      x += xInc;
      error -= dy2;
    } else {
      y += yInc;
      error += dx2;
    }
  }

  return true;
}

export function findPath(
  grid: GridState,
  doors: Record<string, DoorState>,
  from: Vec2,
  to: Vec2
): Vec2[] {
  const queue: Vec2[] = [from];
  const cameFrom = new Map<string, Vec2 | null>();
  const key = (pos: Vec2) => `${pos.x},${pos.y}`;
  cameFrom.set(key(from), null);

  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (current.x === to.x && current.y === to.y) {
      break;
    }
    for (const dir of directions) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      const nextKey = key(next);
      if (cameFrom.has(nextKey)) {
        continue;
      }
      if (!isPassable(grid, next, doors)) {
        continue;
      }
      cameFrom.set(nextKey, current);
      queue.push(next);
    }
  }

  if (!cameFrom.has(key(to))) {
    return [from];
  }

  const path: Vec2[] = [];
  let current: Vec2 | null = to;
  while (current) {
    path.push(current);
    current = cameFrom.get(key(current)) ?? null;
  }
  path.reverse();
  return path;
}

export function findOpenTile(
  grid: GridState,
  doors: Record<string, DoorState>,
  rng: RngState
): { pos: Vec2; rng: RngState } {
  let next = rng;
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const rollX = nextInt(next, 1, grid.width - 2);
    next = rollX.state;
    const rollY = nextInt(next, 1, grid.height - 2);
    next = rollY.state;
    const pos = { x: rollX.value, y: rollY.value };
    if (isPassable(grid, pos, doors)) {
      return { pos, rng: next };
    }
  }
  return { pos: { x: 1, y: 1 }, rng: next };
}
