import Phaser from 'phaser';
import { SCENE_KEYS, COLORS } from '../types';
import { simBridge } from '../simBridge';
import dialogueData from '../../shared/text/dialogue.json';

interface DialogueEntry {
  id: string;
  speaker: string;
  text: string;
}

interface DialogueData {
  dialogue: DialogueEntry[];
}

export class StationScene extends Phaser.Scene {
  private statsText: Phaser.GameObjects.Text | undefined;
  private loadoutText: Phaser.GameObjects.Text | undefined;

  constructor() {
    super(SCENE_KEYS.STATION);
  }

  create() {
    const { width, height } = this.scale;
    
    // Background
    this.add.rectangle(0, 0, width, height, COLORS.background).setOrigin(0);

    // Header
    this.add.text(50, 50, 'STATION: HAB-MED', { fontSize: '32px', color: COLORS.text, fontFamily: 'monospace' });

    // Stats
    this.updateStats();
    this.updateLoadout();

    // Dialogue
    const dialogues = (dialogueData as DialogueData).dialogue;
    const entry = dialogues.length > 0 ? dialogues[simBridge.nextDialogueIndex(dialogues.length)] : null;
    const dialogueText = entry ? `${entry.speaker}: "${entry.text}"` : 'NO COMMS AVAILABLE';
    this.add.text(50, 150, dialogueText, { 
      fontSize: '18px', 
      color: COLORS.accent, 
      fontFamily: 'monospace',
      wordWrap: { width: width - 100 }
    });

    // Buttons
    this.createButton(50, 250, 'START RAID', () => {
      const seed = simBridge.getNextSeed();
      simBridge.startRaid(seed);
      this.scene.start(SCENE_KEYS.RAID);
      this.scene.launch(SCENE_KEYS.UI);
    });

    this.createButton(50, 320, 'UPGRADE POWER (+5)', () => {
      simBridge.upgradePower();
      this.updateStats();
    });

    this.createButton(50, 390, 'UPGRADE BACKPACK (+1)', () => {
      simBridge.upgradeBackpack();
      this.updateStats();
    });

    this.createButton(50, 460, 'CYCLE PRIMARY', () => {
      simBridge.cyclePrimaryWeapon();
      this.updateLoadout();
    });

    this.createButton(50, 520, 'CYCLE SECONDARY', () => {
      simBridge.cycleSecondaryWeapon();
      this.updateLoadout();
    });

    // Logs
    this.add.text(width / 2, 250, 'LOGS DECRYPTED:', { fontSize: '24px', color: COLORS.text, fontFamily: 'monospace' });
    const logs = simBridge.getUnlockedLogs();
    if (logs.length === 0) {
      this.add.text(width / 2, 290, '[NO LOGS]', { fontSize: '16px', color: '#666', fontFamily: 'monospace' });
    } else {
      logs.forEach((log, index) => {
        this.add.text(width / 2, 290 + (index * 80), `> ${log.title}`, { fontSize: '18px', color: String(COLORS.door), fontFamily: 'monospace' });
        this.add.text(width / 2 + 20, 315 + (index * 80), log.body, { fontSize: '14px', color: '#aaa', fontFamily: 'monospace', wordWrap: { width: 400 } });
      });
    }

    // Recovered Loot
    const loot = simBridge.getRecoveredLoot();
    this.add.text(50, 620, 'RECOVERED LOOT:', { fontSize: '18px', color: COLORS.text, fontFamily: 'monospace' });
    if (loot.length === 0) {
      this.add.text(50, 650, '[NONE]', { fontSize: '14px', color: '#666', fontFamily: 'monospace' });
    } else {
      const shown = loot.slice(-5);
      shown.forEach((itemId, index) => {
        this.add.text(50, 650 + (index * 18), `- ${itemId}`, { fontSize: '14px', color: '#aaa', fontFamily: 'monospace' });
      });
    }
  }

  updateStats() {
    const state = simBridge.getStationState();
    if (this.statsText) this.statsText.destroy();
    this.statsText = this.add.text(50, 100, `POWER BUDGET: ${state.powerBudget} | BACKPACK: ${state.backpackCapacity}`, { fontSize: '20px', color: COLORS.text, fontFamily: 'monospace' });
  }

  updateLoadout() {
    const loadout = simBridge.getLoadoutSummary();
    if (this.loadoutText) this.loadoutText.destroy();
    this.loadoutText = this.add.text(50, 580, `LOADOUT: ${loadout.primary} / ${loadout.secondary}`, { fontSize: '18px', color: COLORS.text, fontFamily: 'monospace' });
  }

  createButton(x: number, y: number, text: string, onClick: () => void) {
    const button = this.add.text(x, y, `[ ${text} ]`, { fontSize: '24px', color: COLORS.text, fontFamily: 'monospace' })
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => button.setColor(COLORS.accent))
      .on('pointerout', () => button.setColor(COLORS.text))
      .on('pointerdown', onClick);
    return button;
  }
}
