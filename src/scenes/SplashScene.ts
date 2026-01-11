import Phaser from 'phaser'

export class SplashScene extends Phaser.Scene {
  private advanced = false

  constructor() {
    super('Splash')
  }

  create() {
    const { width, height } = this.scale

    this.add.rectangle(0, 0, width, height, 0x0f1316).setOrigin(0)

    const title = this.add.text(width / 2, height / 2 - 26, 'CRYSTAL / SCALA')
    title.setOrigin(0.5)
    title.setFontFamily('ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial')
    title.setFontSize(40)
    title.setColor('#d8caa7')

    const title2 = this.add.text(width / 2, height / 2 + 18, 'PROJECT LATTICE')
    title2.setOrigin(0.5)
    title2.setFontFamily('ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial')
    title2.setFontSize(18)
    title2.setColor('#d8caa7')

    const prompt = this.add.text(width / 2, height - 72, 'Press any key / click')
    prompt.setOrigin(0.5)
    prompt.setStyle({
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      fontSize: 16,
      color: '#d8caa7',
      letterSpacing: 0,
    } as unknown as Phaser.Types.GameObjects.Text.TextStyle)

    this.tweens.add({
      targets: prompt,
      alpha: 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const goNext = () => {
      if (this.advanced) return
      this.advanced = true
      this.scene.start('Menu')
    }

    this.input.once('pointerdown', goNext)

    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.once('keydown', goNext)
    }
  }
}
