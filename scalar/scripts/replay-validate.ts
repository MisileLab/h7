import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { WegoCommands } from "../src/sim/schemas";

interface ReplayFile {
  seed: number;
  turns: number;
  commands: WegoCommands[];
  finalHash?: string;
}

const args = process.argv.slice(2);
const replayPath = args[0] ?? "replay.json";
const replay = JSON.parse(readFileSync(replayPath, "utf-8")) as ReplayFile;

let state = createInitialState(replay.seed);
for (let i = 0; i < replay.turns; i += 1) {
  const commands = replay.commands[i] ?? [];
  const result = step(state, commands);
  state = result.nextState;
}

const hash = hashState(state);
if (replay.finalHash && replay.finalHash !== hash) {
  console.error(`Replay hash mismatch: expected ${replay.finalHash} got ${hash}`);
  process.exit(1);
}

console.log(`Replay validated. Final hash: ${hash}`);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const body = entries
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
}

function hashState(state: unknown): string {
  return createHash("sha256").update(stableStringify(state)).digest("hex");
}
