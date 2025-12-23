import { createInitialState, createWeaponState, GameState, ItemDef } from '../sim/state';
import { step, StepResult } from '../sim/step';
import { DroneCommand } from '../sim/schemas';
import { StationState } from './types';
import logsData from '../shared/text/logs.json';
import itemsData from '../shared/data/items.json';

interface LogEntry {
  id: string;
  title: string;
  body: string;
}

interface LogsData {
  logs: LogEntry[];
}

interface ItemsData {
  items: ItemDef[];
}

const LOGS = (logsData as LogsData).logs;
const ITEMS = (itemsData as ItemsData).items;
const PRIMARY_WEAPONS = ITEMS.filter((item) => item.kind === 'weapon' && item.slot === 'primary');
const SECONDARY_WEAPONS = ITEMS.filter((item) => item.kind === 'weapon' && item.slot === 'secondary');

class SimBridge {
  private static instance: SimBridge;

  private raidState: GameState | null = null;
  private stationState: StationState;
  private replayData: Record<number, DroneCommand[]> | null = null;
  private replayExpectedHash: string | null = null;
  private replayTurnCount: number | null = null;

  private constructor() {
    this.stationState = {
      powerBudget: 120,
      backpackCapacity: 8,
      logsUnlocked: [],
      nextSeed: 1,
      dialogueIndex: 0,
      primaryWeaponId: PRIMARY_WEAPONS[0]?.id ?? 'arc-rifle',
      secondaryWeaponId: SECONDARY_WEAPONS[0]?.id ?? 'sidearm',
      recoveredLoot: []
    };
  }
  
  static getInstance(): SimBridge {
    if (!SimBridge.instance) {
      SimBridge.instance = new SimBridge();
    }
    return SimBridge.instance;
  }
  
  // Station Methods
  getStationState() { return this.stationState; }
  
  upgradePower() {
    this.stationState.powerBudget += 5;
  }
  
  upgradeBackpack() {
    this.stationState.backpackCapacity += 1;
  }

  cyclePrimaryWeapon(): string {
    if (PRIMARY_WEAPONS.length === 0) {
      return this.stationState.primaryWeaponId;
    }
    const index = PRIMARY_WEAPONS.findIndex((item) => item.id === this.stationState.primaryWeaponId);
    const next = PRIMARY_WEAPONS[(index + 1) % PRIMARY_WEAPONS.length];
    if (next) {
      this.stationState.primaryWeaponId = next.id;
    }
    return this.stationState.primaryWeaponId;
  }

  cycleSecondaryWeapon(): string {
    if (SECONDARY_WEAPONS.length === 0) {
      return this.stationState.secondaryWeaponId;
    }
    const index = SECONDARY_WEAPONS.findIndex((item) => item.id === this.stationState.secondaryWeaponId);
    const next = SECONDARY_WEAPONS[(index + 1) % SECONDARY_WEAPONS.length];
    if (next) {
      this.stationState.secondaryWeaponId = next.id;
    }
    return this.stationState.secondaryWeaponId;
  }

  getLoadoutSummary(): { primary: string; secondary: string } {
    const primary = PRIMARY_WEAPONS.find((item) => item.id === this.stationState.primaryWeaponId);
    const secondary = SECONDARY_WEAPONS.find((item) => item.id === this.stationState.secondaryWeaponId);
    return {
      primary: primary?.name ?? this.stationState.primaryWeaponId,
      secondary: secondary?.name ?? this.stationState.secondaryWeaponId
    };
  }
  
  getNextSeed(): number {
    const seed = this.stationState.nextSeed;
    this.stationState.nextSeed += 1;
    return seed;
  }

  nextDialogueIndex(max: number): number {
    if (max <= 0) {
      return 0;
    }
    const index = this.stationState.dialogueIndex % max;
    this.stationState.dialogueIndex = (this.stationState.dialogueIndex + 1) % max;
    return index;
  }

  unlockLog() {
    const next = LOGS.find((log) => !this.stationState.logsUnlocked.includes(log.id));
    if (!next) {
      return null;
    }
    this.stationState.logsUnlocked.push(next.id);
    return next.id;
  }

  unlockLogs(count: number): string[] {
    const unlocked: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const id = this.unlockLog();
      if (!id) {
        break;
      }
      unlocked.push(id);
    }
    return unlocked;
  }

  getUnlockedLogs() {
    return LOGS.filter((log) => this.stationState.logsUnlocked.includes(log.id));
  }

  getRecoveredLoot(): string[] {
    return [...this.stationState.recoveredLoot];
  }

  recordRaidOutcome(state: GameState): void {
    const drones = Object.values(state.units).filter((unit) => unit.faction === 'drone');
    const sealedItems = drones
      .map((unit) => unit.inventory?.sealedItem?.itemId)
      .filter((itemId): itemId is string => Boolean(itemId));

    if (state.mission.status === 'FAILED') {
      if (sealedItems.length > 0) {
        this.stationState.recoveredLoot.push(sealedItems[0]);
      }
      return;
    }

    const collected: string[] = [];
    for (const unit of drones) {
      if (unit.inventory) {
        collected.push(...unit.inventory.backpack.map((item) => item.itemId));
        if (unit.inventory.sealedItem) {
          collected.push(unit.inventory.sealedItem.itemId);
        }
      }
    }
    this.stationState.recoveredLoot.push(...collected);
  }
  
  // Raid Methods
  startRaid(seed: number) {
    this.raidState = createInitialState(seed);
    this.replayData = null;
    this.replayExpectedHash = null;
    this.replayTurnCount = null;
    // Apply upgrades
    this.raidState.power = this.stationState.powerBudget;
    Object.values(this.raidState.units).forEach(unit => {
      if (unit.faction !== 'drone') {
        return;
      }
      if (unit.inventory) {
        unit.inventory.capacity = this.stationState.backpackCapacity;
      }
      if (unit.loadout) {
        unit.loadout.primary = createWeaponState(this.stationState.primaryWeaponId);
        unit.loadout.secondary = createWeaponState(this.stationState.secondaryWeaponId);
      }
    });
    return this.raidState;
  }

  startReplay(
    seed: number,
    commands: Record<number, DroneCommand[]>,
    expectedHash?: string,
    turnCount?: number
  ) {
    this.startRaid(seed);
    this.replayData = commands;
    this.replayExpectedHash = expectedHash ?? null;
    if (turnCount !== undefined) {
      this.replayTurnCount = turnCount;
    } else {
      const keys = Object.keys(commands).map((key) => Number(key));
      this.replayTurnCount = keys.length > 0 ? Math.max(...keys) : null;
    }
  }

  clearReplay(): void {
    this.replayData = null;
    this.replayExpectedHash = null;
    this.replayTurnCount = null;
  }

  isReplayActive(): boolean {
      return this.replayData !== null;
  }

  getReplayCommandsForTurn(turn: number): DroneCommand[] | null {
      if (!this.replayData) return null;
      return this.replayData[turn] || [];
  }

  getReplayTurnCount(): number | null {
    return this.replayTurnCount;
  }

  async validateReplay(): Promise<{ ok: boolean; hash: string } | null> {
    if (!this.raidState) {
      return null;
    }
    const hash = await hashState(this.raidState);
    if (!this.replayExpectedHash) {
      return { ok: true, hash };
    }
    return { ok: this.replayExpectedHash === hash, hash };
  }
  
  getRaidState(): GameState | null {
    return this.raidState;
  }
  
  submitTurn(commands: DroneCommand[]): StepResult {
    if (!this.raidState) throw new Error("No raid active");
    const result = step(this.raidState, commands);
    this.raidState = result.nextState;
    return result;
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const body = entries
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(',');
    return `{${body}}`;
  }
  return JSON.stringify(value);
}

async function hashState(state: unknown): Promise<string> {
  const input = stableStringify(state);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await subtle.digest('SHA-256', data);
    return bufferToHex(digest);
  }
  return hashFallback(input);
}

function hashFallback(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const simBridge = SimBridge.getInstance();
