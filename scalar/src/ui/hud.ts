import Phaser from 'phaser'

export function createHudPlaceholder(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const { width } = scene.scale

  const container = scene.add.container(0, 0)
  const bar = scene.add.rectangle(0, 0, width, 36, 0x10161a).setOrigin(0)
  bar.setAlpha(0.88)
  container.add(bar)

  container.setScrollFactor(0)
  return container
}

export function createPanel(
  scene: Phaser.Scene,
  opts: {
    x: number
    y: number
    w: number
    h: number
    title?: string
  },
): {
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Rectangle
  title?: Phaser.GameObjects.Text
} {
  const container = scene.add.container(opts.x, opts.y)

  const bg = scene.add.rectangle(0, 0, opts.w, opts.h, 0x10161a).setOrigin(0)
  bg.setAlpha(0.92)
  bg.setStrokeStyle(1, 0x2a3137, 1)
  container.add(bg)

  let title: Phaser.GameObjects.Text | undefined
  if (opts.title) {
    title = scene.add
      .text(10, 8, opts.title, {
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        fontSize: '12px',
        color: '#d8caa7',
      })
      .setOrigin(0)
    container.add(title)
  }

  container.setScrollFactor(0)
  container.setDepth(1000)
  return { container, bg, title }
}

export function createTextButton(
  scene: Phaser.Scene,
  opts: {
    x: number
    y: number
    w: number
    h: number
    label: string
    onClick: () => void
  },
): {
  container: Phaser.GameObjects.Container
  setDisabled: (disabled: boolean) => void
  setLabel: (label: string) => void
} {
  const bg = scene.add.rectangle(0, 0, opts.w, opts.h, 0x2a3137).setOrigin(0)
  bg.setAlpha(0.9)
  bg.setStrokeStyle(1, 0xd8caa7, 0.35)

  const txt = scene.add
    .text(opts.w / 2, opts.h / 2, opts.label, {
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      fontSize: '12px',
      color: '#d8caa7',
    })
    .setOrigin(0.5)

  const container = scene.add.container(opts.x, opts.y, [bg, txt])
  container.setScrollFactor(0)
  container.setDepth(1001)

  const enable = () => {
    bg.setInteractive({ useHandCursor: true })
    bg.setFillStyle(0x2a3137, 0.9)
    bg.setStrokeStyle(1, 0xd8caa7, 0.35)
    txt.setColor('#d8caa7')
  }

  const disable = () => {
    bg.disableInteractive()
    bg.setFillStyle(0x1a2227, 0.9)
    bg.setStrokeStyle(1, 0x2a3137, 1)
    txt.setColor('#2a3137')
  }

  enable()

  bg.on('pointerover', () => {
    bg.setFillStyle(0x394249, 0.9)
  })

  bg.on('pointerout', () => {
    bg.setFillStyle(0x2a3137, 0.9)
  })

  bg.on('pointerdown', () => {
    opts.onClick()
  })

  return {
    container,
    setDisabled(disabled: boolean) {
      if (disabled) disable()
      else enable()
    },
    setLabel(label: string) {
      txt.setText(label)
    },
  }
}
