import Phaser from 'phaser'
import { theme } from '../theme'
import { createPanel, createTextButton } from '../ui/hud'
import { loadFromSlot, loadSettings, saveSettings, type Settings } from '../core/save'
import { milestoneAtLeast, type Milestone } from '../types'

const milestones: { id: Milestone; title: string; summary: string; hint: string }[] = [
  { id: 'M0', title: 'Wiring Only', summary: 'Scenes + basic flow only.', hint: 'No gameplay systems.' },
  { id: 'M1', title: 'Free Roam', summary: 'Drone free-move + HUD.', hint: 'No nodes.' },
  { id: 'M2', title: 'Node Graph', summary: 'Node selection + actions.', hint: 'Edges constrain moves.' },
  { id: 'M3', title: 'Day Loop', summary: 'Day advances + autosave.', hint: 'Heat pressure grows.' },
  { id: 'M4', title: 'Down + Salvage', summary: 'Drone can be downed.', hint: 'Salvage to recover.' },
  { id: 'M5', title: 'Options + Slots', summary: 'Options + save slots.', hint: 'Manual saves enabled.' },
  { id: 'M6', title: 'Endings', summary: 'Win/Fail endings.', hint: 'Full loop.' },
]

export class MenuScene extends Phaser.Scene {
  private selectedMilestone: Milestone = 'M6'
  private detailsText!: Phaser.GameObjects.Text
  private optionOverlay?: Phaser.GameObjects.Container
  private settings: Settings = loadSettings()
  private optionsBtn?: ReturnType<typeof createTextButton>

  constructor() {
    super('Menu')
  }

  create() {
    const { width, height } = this.scale

    this.add.rectangle(0, 0, width, height, theme.colors.bg).setOrigin(0)

    this.add
      .text(width / 2, 64, 'MENU', {
        fontFamily: theme.fonts.ui,
        fontSize: '24px',
        color: theme.colors.sandHex,
      })
      .setOrigin(0.5)

    const scenesPanel = createPanel(this, { x: 48, y: 120, w: 220, h: 360, title: 'SCENES' })
    const sessionPanel = createPanel(this, { x: width / 2 - 130, y: 160, w: 260, h: 180, title: 'SESSION' })
    const slotsPanel = createPanel(this, { x: width / 2 - 130, y: 360, w: 260, h: 150, title: 'SAVE SLOTS' })
    const detailsPanel = createPanel(this, { x: width - 320, y: 120, w: 260, h: 240, title: 'DETAILS' })

    this.detailsText = this.add
      .text(width - 300, 160, '', {
        fontFamily: theme.fonts.ui,
        fontSize: '12px',
        color: theme.colors.sandHex,
        lineSpacing: 4,
        wordWrap: { width: 220 },
      })
      .setOrigin(0)
    detailsPanel.container.add(this.detailsText)

    const sceneButtons = milestones.map((m, idx) => {
      return createTextButton(this, {
        x: 68,
        y: 150 + idx * 40,
        w: 180,
        h: 28,
        label: m.id,
        onClick: () => this.startNewRun(m.id),
      })
    })

    sceneButtons.forEach((btn, idx) => {
      const milestone = milestones[idx]
      btn.container.on('pointerover', () => this.updateDetails(milestone))
      scenesPanel.container.add(btn.container)
    })

    const continueBtn = createTextButton(this, {
      x: width / 2 - 110,
      y: 200,
      w: 220,
      h: 34,
      label: 'Continue',
      onClick: () => this.continueGame(),
    })

    const optionsBtn = createTextButton(this, {
      x: width / 2 - 110,
      y: 250,
      w: 220,
      h: 34,
      label: 'Options',
      onClick: () => this.openOptions(),
    })

    this.optionsBtn = optionsBtn

    sessionPanel.container.add(continueBtn.container)
    sessionPanel.container.add(optionsBtn.container)

    const slotButtons = ['slot1', 'slot2', 'slot3'].map((slot, idx) => {
      return createTextButton(this, {
        x: width / 2 - 110,
        y: 390 + idx * 40,
        w: 220,
        h: 28,
        label: `Load ${slot.toUpperCase()}`,
        onClick: () => this.loadSlot(slot as 'slot1' | 'slot2' | 'slot3'),
      })
    })

    slotButtons.forEach((btn) => slotsPanel.container.add(btn.container))

    this.add
      .text(width / 2, height - 36, 'M0–M6 build selector', {
        fontFamily: theme.fonts.ui,
        fontSize: '12px',
        color: theme.colors.charcoalHex,
      })
      .setOrigin(0.5)

    this.updateDetails(milestones[milestones.length - 1])
    this.refreshContinue(continueBtn)
    this.refreshSlots(slotButtons)
    this.refreshOptions(optionsBtn)

    this.createOptionsOverlay()

    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.on('keydown', (ev: KeyboardEvent) => {
        if (this.optionOverlay?.visible) {
          if (ev.key === 'Escape') this.closeOptions()
          return
        }
        const key = ev.key.toLowerCase()
        if (key >= '1' && key <= '7') {
          const idx = Number(key) - 1
          const target = milestones[idx]
          if (target) this.startNewRun(target.id)
        }
        if (key === 'c') this.continueGame()
        if (key === 'o') this.openOptions()
      })
    }
  }

  private startNewRun(milestone: Milestone) {
    this.scene.start('Game', { milestone })
  }

  private continueGame() {
    const saved = loadFromSlot('autosave')
    if (!saved) return
    this.scene.start('Game', { loadState: saved })
  }

  private loadSlot(slot: 'slot1' | 'slot2' | 'slot3') {
    const saved = loadFromSlot(slot)
    if (!saved) return
    this.scene.start('Game', { loadState: saved })
  }

  private refreshContinue(btn: ReturnType<typeof createTextButton>) {
    const saved = loadFromSlot('autosave')
    btn.setDisabled(!saved)
    btn.setLabel(saved ? 'Continue' : 'Continue (empty)')
  }

  private refreshSlots(btns: ReturnType<typeof createTextButton>[]) {
    const slots: Array<{ key: 'slot1' | 'slot2' | 'slot3'; label: string }> = [
      { key: 'slot1', label: 'SLOT 1' },
      { key: 'slot2', label: 'SLOT 2' },
      { key: 'slot3', label: 'SLOT 3' },
    ]
    btns.forEach((btn, idx) => {
      const slot = slots[idx]
      const saved = loadFromSlot(slot.key)
      btn.setDisabled(!saved)
      btn.setLabel(saved ? `Load ${slot.label}` : `${slot.label} (empty)`)
    })
  }

  private refreshOptions(btn: ReturnType<typeof createTextButton>) {
    const enabled = milestoneAtLeast(this.selectedMilestone, 'M5')
    btn.setDisabled(!enabled)
  }

  private updateDetails(milestone: { id: Milestone; title: string; summary: string; hint: string }) {
    this.selectedMilestone = milestone.id
    this.detailsText.setText(`${milestone.id} — ${milestone.title}\n${milestone.summary}\n${milestone.hint}`)
    if (this.optionsBtn) this.refreshOptions(this.optionsBtn)
  }

  private createOptionsOverlay() {
    const { width, height } = this.scale
    const overlay = this.add.container(0, 0)

    const bg = this.add.rectangle(0, 0, width, height, 0x0f1316, 0.72).setOrigin(0)
    bg.setInteractive()

    const panel = createPanel(this, {
      x: width / 2 - 170,
      y: height / 2 - 140,
      w: 340,
      h: 280,
      title: 'OPTIONS',
    })

    const labels = [
      this.add.text(width / 2 - 140, height / 2 - 90, 'Scanlines', { fontFamily: theme.fonts.ui, fontSize: '12px', color: theme.colors.sandHex }),
      this.add.text(width / 2 - 140, height / 2 - 50, 'Camera Shake', { fontFamily: theme.fonts.ui, fontSize: '12px', color: theme.colors.sandHex }),
      this.add.text(width / 2 - 140, height / 2 - 10, 'Volume', { fontFamily: theme.fonts.ui, fontSize: '12px', color: theme.colors.sandHex }),
    ]

    const scanBtn = createTextButton(this, {
      x: width / 2 + 20,
      y: height / 2 - 104,
      w: 120,
      h: 28,
      label: '',
      onClick: () => {
        this.settings = { ...this.settings, scanlines: !this.settings.scanlines }
        scanBtn.setLabel(this.settings.scanlines ? 'On' : 'Off')
      },
    })

    const shakeBtn = createTextButton(this, {
      x: width / 2 + 20,
      y: height / 2 - 64,
      w: 120,
      h: 28,
      label: '',
      onClick: () => {
        this.settings = { ...this.settings, cameraShake: !this.settings.cameraShake }
        shakeBtn.setLabel(this.settings.cameraShake ? 'On' : 'Off')
      },
    })

    const volumeBtn = createTextButton(this, {
      x: width / 2 + 20,
      y: height / 2 - 24,
      w: 120,
      h: 28,
      label: '',
      onClick: () => {
        const next = Math.round((this.settings.volume + 0.1) * 10) / 10
        this.settings = { ...this.settings, volume: next > 1 ? 0 : next }
        volumeBtn.setLabel(`${Math.round(this.settings.volume * 100)}%`)
      },
    })

    const applyBtn = createTextButton(this, {
      x: width / 2 - 120,
      y: height / 2 + 100,
      w: 120,
      h: 30,
      label: 'Apply',
      onClick: () => {
        saveSettings(this.settings)
        this.closeOptions()
      },
    })

    const closeBtn = createTextButton(this, {
      x: width / 2 + 20,
      y: height / 2 + 100,
      w: 120,
      h: 30,
      label: 'Close',
      onClick: () => this.closeOptions(),
    })

    scanBtn.setLabel(this.settings.scanlines ? 'On' : 'Off')
    shakeBtn.setLabel(this.settings.cameraShake ? 'On' : 'Off')
    volumeBtn.setLabel(`${Math.round(this.settings.volume * 100)}%`)

    overlay.add([bg, panel.container, ...labels, scanBtn.container, shakeBtn.container, volumeBtn.container, applyBtn.container, closeBtn.container])
    overlay.setDepth(2000)
    overlay.setVisible(false)

    this.optionOverlay = overlay
  }

  private openOptions() {
    if (!milestoneAtLeast(this.selectedMilestone, 'M5')) return
    if (!this.optionOverlay) return
    this.optionOverlay.setVisible(true)
  }

  private closeOptions() {
    if (!this.optionOverlay) return
    this.optionOverlay.setVisible(false)
  }
}
