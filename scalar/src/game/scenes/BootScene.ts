import Phaser from 'phaser';
import { SCENE_KEYS } from '../types';
import { simBridge } from '../simBridge';
import { DroneCommand } from '../../sim/schemas';

interface ReplayFile {
  seed: number;
  turns: number;
  commands: DroneCommand[][];
  finalHash?: string;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload() {
    // No assets to preload as per requirement (rectangles/graphics only)
  }

  create() {
    const replayPath = new URLSearchParams(window.location.search).get('replay');
    if (replayPath) {
      this.loadReplay(replayPath);
      return;
    }
    this.scene.start(SCENE_KEYS.STATION);
  }

  private async loadReplay(path: string) {
    try {
      const response = await fetch(path);
      const data = (await response.json()) as ReplayFile;
      const commandsByTurn = this.toCommandRecord(data.commands);
      simBridge.startReplay(data.seed, commandsByTurn, data.finalHash, data.turns);
      this.scene.start(SCENE_KEYS.RAID);
      this.scene.launch(SCENE_KEYS.UI);
    } catch (error: unknown) {
      console.error(error);
      this.scene.start(SCENE_KEYS.STATION);
    }
  }

  private toCommandRecord(commands: DroneCommand[][]): Record<number, DroneCommand[]> {
    const record: Record<number, DroneCommand[]> = {};
    commands.forEach((turnCommands, index) => {
      record[index + 1] = turnCommands;
    });
    return record;
  }
}
