import Phaser from 'phaser';
import { SCENE_KEYS, COLORS } from '../types';
import { simBridge } from '../simBridge';

export class UIScene extends Phaser.Scene {
  private infoText: Phaser.GameObjects.Text | undefined;
  private logText: Phaser.GameObjects.Text | undefined;
  private logMessages: string[] = [];

  constructor() {
    super(SCENE_KEYS.UI);
  }

  create() {
    // Top-left info
    this.infoText = this.add.text(10, 10, '', { 
      fontSize: '16px', 
      color: COLORS.text, 
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 10 }
    });

    // Bottom-left event log
    this.logText = this.add.text(10, 550, '', { 
      fontSize: '14px', 
      color: '#aaaaaa', 
      fontFamily: 'monospace', 
      wordWrap: { width: 300 },
      backgroundColor: '#00000088',
      padding: { x: 10, y: 10 }
    });
  }

  update() {
    const state = simBridge.getRaidState();
    if (!state) return;

    this.infoText?.setText(
      `TURN: ${state.turn}\nPOWER: ${state.power}\nSTATUS: ${state.mission.status}\nLOW POWER: ${state.lowPower.active ? 'ACTIVE' : 'OFF'}`
    );
  }

  addLog(message: string) {
    this.logMessages.push(`> ${message}`);
    if (this.logMessages.length > 8) this.logMessages.shift();
    this.logText?.setText(this.logMessages.join('\n'));
  }
}
