import { expect, it } from "vitest";
import { tryLoot } from "./loot";
import { CrateState, UnitState } from "../state";
import { SimEvent } from "../schemas";

it("tryLoot respects backpack capacity", () => {
  const unit: UnitState = {
    id: "drone-1",
    typeId: "bulwark",
    faction: "drone",
    pos: { x: 1, y: 1 },
    hp: 10,
    maxHp: 10,
    armor: 1,
    statuses: [],
    inventory: { backpack: [], capacity: 4, sealedItem: null }
  };
  const crate: CrateState = {
    id: "crate-1",
    pos: { x: 1, y: 1 },
    opened: false,
    items: [
      { itemId: "fuel-cell", size: 2 },
      { itemId: "relic-case", size: 4 }
    ]
  };
  const events: SimEvent[] = [];
  const picked = tryLoot(unit, crate, events);
  expect(picked.length).toBe(1);
  expect(unit.inventory?.backpack.length).toBe(1);
  expect(crate.items.length).toBe(1);
});
