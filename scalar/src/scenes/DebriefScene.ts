import Phaser from 'phaser'
import { theme } from '../theme'
import { createPanel, createTextButton } from '../ui/hud'
import type { GameState } from '../core/state'
import { resetDaySummary } from '../core/sim'

export class DebriefScene extends Phaser.Scene {
  private state!: GameState

  constructor() {
    super('Debrief')
  }

  init(data: { state: GameState }) {
    this.state = data.state
  }

  create() {
    const { width, height } = this.scale

    this.add.rectangle(0, 0, width, height, theme.colors.bg).setOrigin(0)

    this.add
      .text(width / 2, 48, `DAY ${this.state.day} SUMMARY`, {
        fontFamily: theme.fonts.ui,
        fontSize: '20px',
        color: theme.colors.sandHex,
      })
      .setOrigin(0.5)

    const panelW = 600
    const panelH = 380
    const panelX = width / 2 - panelW / 2
    const panelY = 100

    const panel = createPanel(this, { x: panelX, y: panelY, w: panelW, h: panelH, title: 'DEBRIEF' })

    const summary = this.state.daySummary
    const lines: string[] = []

    lines.push('RESOURCES:')
    if (summary.gained.power > 0 || summary.spent.power > 0) {
      lines.push(`  Power: +${summary.gained.power} / -${summary.spent.power}`)
    }
    if (summary.gained.supplies > 0 || summary.spent.supplies > 0) {
      lines.push(`  Supplies: +${summary.gained.supplies} / -${summary.spent.supplies}`)
    }
    if (summary.gained.parts > 0 || summary.spent.parts > 0) {
      lines.push(`  Parts: +${summary.gained.parts} / -${summary.spent.parts}`)
    }

    lines.push('')
    lines.push('SYSTEM PRESSURE:')
    lines.push(`  Heat: ${summary.heatDelta >= 0 ? '+' : ''}${summary.heatDelta} (Total: ${this.state.heat})`)

    lines.push('')
    lines.push('SCALA STATUS:')
    if (summary.scalaDelta.vitals !== 0) {
      lines.push(`  Vitals: ${summary.scalaDelta.vitals >= 0 ? '+' : ''}${summary.scalaDelta.vitals} (${this.state.scala.vitals})`)
    }
    if (summary.scalaDelta.stress !== 0) {
      lines.push(`  Stress: ${summary.scalaDelta.stress >= 0 ? '+' : ''}${summary.scalaDelta.stress} (${this.state.scala.stress})`)
    }
    if (summary.scalaDelta.trust !== 0) {
      lines.push(`  Trust: ${summary.scalaDelta.trust >= 0 ? '+' : ''}${summary.scalaDelta.trust} (${this.state.scala.trust})`)
    }

    lines.push('')
    lines.push('DRONE STATUS:')
    lines.push(`  Integrity: ${summary.droneDelta.integrityDelta >= 0 ? '+' : ''}${summary.droneDelta.integrityDelta} (${this.state.drone.integrity})`)
    if (summary.droneDelta.wentDown) {
      lines.push('  ⚠ DRONE WENT DOWN')
    }
    if (this.state.drone.status === 'Down') {
      lines.push('  ⚠ DRONE CURRENTLY DOWN')
    }

    if (summary.keyEvents.length > 0) {
      lines.push('')
      lines.push('KEY EVENTS:')
      for (const event of summary.keyEvents) {
        lines.push(`  • ${event}`)
      }
    }

    const bodyText = this.add
      .text(panelX + 20, panelY + 40, lines.join('\n'), {
        fontFamily: theme.fonts.ui,
        fontSize: '11px',
        color: theme.colors.sandHex,
        lineSpacing: 4,
      })
      .setOrigin(0)

    panel.container.add(bodyText)

    const btnW = 200
    const btnH = 36
    const btnX = width / 2 - btnW / 2
    const btnY = panelY + panelH + 32

    const nextDayBtn = createTextButton(this, {
      x: btnX,
      y: btnY,
      w: btnW,
      h: btnH,
      label: 'Next Day',
      onClick: () => this.onNextDay(),
    })

    this.add.existing(nextDayBtn.container)

    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.on('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          this.onNextDay()
        }
        if (ev.key === 'Escape') {
          this.scene.start('Menu')
        }
      })
    }
  }

  private onNextDay() {
    let next = { ...this.state, day: this.state.day + 1 }
    next = { ...next, run: { ...next.run, mode: 'Planning' as const, droneNodeId: 'N0_HOME' } }
    next = resetDaySummary(next)
    this.scene.start('Game', { loadState: next })
  }
}
