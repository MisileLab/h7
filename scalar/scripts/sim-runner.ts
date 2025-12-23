import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { WegoCommands } from "../src/sim/schemas";

interface CommandLogFile {
  seed?: number;
  turns?: number;
  commands?: WegoCommands[];
}

const args = process.argv.slice(2);
const seedArg = getArgNumber(args, "--seed");
const turnsArg = getArgNumber(args, "--turns");
const commandsPath = getArg(args, "--commands");
const outPath = getArg(args, "--out") ?? "replay.json";

const commandLog = loadCommands(commandsPath);
const seed = seedArg ?? commandLog.seed ?? 1;
const commands = commandLog.commands ?? [];
const turns = turnsArg ?? commandLog.turns ?? (commands.length > 0 ? commands.length : 1);

let state = createInitialState(seed);
const eventsByTurn = [] as unknown[];
const observations = [] as unknown[];

for (let i = 0; i < turns; i += 1) {
  const turnCommands = commands[i] ?? [];
  const result = step(state, turnCommands);
  eventsByTurn.push(result.events);
  observations.push(result.observation);
  state = result.nextState;
}

const finalHash = hashState(state);
const replay = {
  seed,
  turns,
  commands,
  events: eventsByTurn,
  observations,
  finalHash
};

writeFileSync(outPath, JSON.stringify(replay, null, 2));

function getArg(argsList: string[], name: string): string | undefined {
  const index = argsList.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argsList[index + 1];
}

function getArgNumber(argsList: string[], name: string, fallback?: number): number | undefined {
  const value = getArg(argsList, name);
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadCommands(path?: string): CommandLogFile {
  if (!path) {
    return {};
  }
  const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (Array.isArray(raw)) {
    return { commands: raw };
  }
  return raw as CommandLogFile;
}

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
