import { CrateState, InventoryState, ItemStack, UnitState, Vec2 } from "../state";
import { SimEvent } from "../schemas";
import { isAdjacent } from "./doors";

export function getBackpackUsed(inventory: InventoryState): number {
  return inventory.backpack.reduce((sum, item) => sum + item.size, 0);
}

export function canFit(inventory: InventoryState, size: number): boolean {
  return getBackpackUsed(inventory) + size <= inventory.capacity;
}

export function tryLoot(
  unit: UnitState,
  crate: CrateState,
  events: SimEvent[]
): ItemStack[] {
  if (!unit.inventory) {
    return [];
  }
  if (!isAdjacent(unit.pos, crate.pos)) {
    return [];
  }
  const picked: ItemStack[] = [];
  const remaining: ItemStack[] = [];
  for (const item of crate.items) {
    if (canFit(unit.inventory, item.size)) {
      unit.inventory.backpack.push({ ...item });
      picked.push(item);
    } else {
      remaining.push(item);
    }
  }
  if (picked.length > 0) {
    crate.items = remaining;
    crate.opened = true;
    events.push({
      type: "LootPicked",
      unitId: unit.id,
      crateId: crate.id,
      items: picked.map((item) => item.itemId)
    });
  }
  return picked;
}

export function trySeal(
  unit: UnitState,
  itemId: string,
  events: SimEvent[]
): boolean {
  if (!unit.inventory) {
    events.push({ type: "SealFailed", unitId: unit.id, reason: "no_inventory" });
    return false;
  }
  if (unit.inventory.sealedItem) {
    events.push({ type: "SealFailed", unitId: unit.id, reason: "already_sealed" });
    return false;
  }
  const index = unit.inventory.backpack.findIndex((item) => item.itemId === itemId);
  if (index < 0) {
    events.push({ type: "SealFailed", unitId: unit.id, reason: "missing_item" });
    return false;
  }
  const item = unit.inventory.backpack[index];
  unit.inventory.backpack.splice(index, 1);
  unit.inventory.sealedItem = item;
  events.push({ type: "SealSucceeded", unitId: unit.id, itemId });
  return true;
}

export function isOnTile(unitPos: Vec2, target: Vec2): boolean {
  return unitPos.x === target.x && unitPos.y === target.y;
}
