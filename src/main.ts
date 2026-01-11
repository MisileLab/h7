import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { SplashScene } from './scenes/SplashScene'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'

function startGame(parent: string) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: '#0f1316',
    pixelArt: true,
    scene: [BootScene, SplashScene, MenuScene, GameScene],
  }

  new Phaser.Game(config)
}

document.addEventListener('DOMContentLoaded', () => {
  const containerId = 'game-container'
  const el = document.getElementById(containerId)
  if (!el) {
    throw new Error(`Missing #${containerId} element`)
  }
  startGame(containerId)
})
