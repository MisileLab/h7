import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { StationScene } from './game/scenes/StationScene';
import { RaidScene } from './game/scenes/RaidScene';
import { UIScene } from './game/scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#050505',
  scene: [BootScene, StationScene, RaidScene, UIScene],
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
