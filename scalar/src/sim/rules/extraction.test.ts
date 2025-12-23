import { expect, it } from "vitest";
import { applyExtraction } from "./extraction";
import { createInitialState } from "../state";
import { SimEvent } from "../schemas";

it("applyExtraction marks mission extracted", () => {
  const state = createInitialState(3);
  const unit = state.units["drone-1"];
  unit.pos = { ...state.extractionPos };
  const events: SimEvent[] = [];
  applyExtraction(state, unit, events);
  expect(state.mission.status).toBe("EXTRACTED");
});
