import { Observation, Phase } from "./schemas";
import { GameState } from "./state";
import { getBackpackUsed } from "./rules/loot";

export function buildObservation(state: GameState, phase: Phase): Observation {
  return {
    turn: state.turn,
    phase,
    seed: state.seed,
    power: state.power,
    lowPowerState: { ...state.lowPower },
    grid: {
      width: state.grid.width,
      height: state.grid.height,
      tiles: state.grid.tiles.map((tile) => ({ ...tile }))
    },
    units: Object.values(state.units).map((unit) => ({
      id: unit.id,
      typeId: unit.typeId,
      faction: unit.faction,
      pos: { ...unit.pos },
      hp: unit.hp,
      armor: unit.armor,
      statuses: unit.statuses.map((status) => ({ ...status }))
    })),
    inventory: Object.values(state.units)
      .filter((unit) => unit.faction === "drone" && unit.inventory)
      .map((unit) => ({
        unitId: unit.id,
        backpackUsed: getBackpackUsed(unit.inventory!),
        backpackCapacity: unit.inventory!.capacity,
        sealedItem: unit.inventory!.sealedItem ? unit.inventory!.sealedItem.itemId : null
      })),
    visibleObjects: [
      ...Object.values(state.doors).map((door) => ({
        id: door.id,
        pos: { ...door.pos },
        type: "door" as const,
        state: door.open ? "open" : door.locked ? "locked" : "closed"
      })),
      ...Object.values(state.consoles).map((console) => ({
        id: console.id,
        pos: { ...console.pos },
        type: "console" as const,
        state: console.used ? "used" : "ready"
      })),
      ...Object.values(state.crates).map((crate) => ({
        id: crate.id,
        pos: { ...crate.pos },
        type: "crate" as const,
        state: crate.opened ? "opened" : "sealed"
      }))
    ]
  };
}
