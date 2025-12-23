import { DroneCommand } from '../sim/schemas';

export interface StationState {
  powerBudget: number;
  backpackCapacity: number;
  logsUnlocked: string[];
  nextSeed: number;
  dialogueIndex: number;
  primaryWeaponId: string;
  secondaryWeaponId: string;
  recoveredLoot: string[];
}

export interface ReplayData {
  seed: number;
  commands: Record<number, DroneCommand[]>;
}

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  STATION: 'StationScene',
  RAID: 'RaidScene',
  UI: 'UIScene'
};

export const COLORS = {
  background: 0x050505,
  grid: 0x222222,
  wall: 0x444444,
  floor: 0x111111,
  drone: 0x00ff88,
  enemy: 0xff4444,
  door: '#0088ff',
  console: 0xffff00,
  crate: 0xffaa00,
  text: '#e0e0e0',
  accent: '#00ff88',
  danger: '#ff4444'
};
