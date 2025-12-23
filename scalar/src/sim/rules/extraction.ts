import { GameState, UnitState } from "../state";
import { SimEvent } from "../schemas";
import { getTile } from "./grid";

export function canExtract(state: GameState, unit: UnitState): boolean {
  const tile = getTile(state.grid, unit.pos);
  return Boolean(tile && tile.extraction);
}

export function applyExtraction(state: GameState, unit: UnitState, events: SimEvent[]): void {
  if (!canExtract(state, unit)) {
    return;
  }
  state.mission.status = "EXTRACTED";
  events.push({ type: "ExtractionSuccess", unitId: unit.id });
}
