import Phaser from 'phaser'
import { theme } from '../theme'
import { createHudPlaceholder, createPanel, createTextButton } from '../ui/hud'
import { createInitialState } from '../core/state'
import { data, type NodeDef, type EdgeDef } from '../core/data'
import type { GameState } from '../core/state'
import type { Milestone, NodeId, NodeType } from '../types'
import { milestoneAtLeast } from '../types'
import { createRng } from '../core/rng'
import { applyExtractOutcome, applyHazardOutcome, applyMoveCost, appendLog, checkAndTriggerWardenBroadcast, initDayFlags, simulateExtract, simulateHazard, simulateMove, stepAndCheckEnd, trackDroneChange, trackHeatChange, trackKeyEvent, trackResourceGain, trackResourceSpend, trackScalaChange } from '../core/sim'
import { loadSettings, saveToSlot, type Settings } from '../core/save'

type Point = { x: number; y: number }

type SimSnapshot = {
  day: number
  heat: number
  vitals: number
  stress: number
  trust: number
  integrity: number
}

type SceneInitData = {
  milestone?: Milestone
  loadState?: GameState
}

export class GameScene extends Phaser.Scene {
  private state!: GameState
  private milestone: Milestone = 'M2'
  private settings: Settings = loadSettings()
  private allowFreeMove = false
  private lastStateRef!: GameState
  private graphNodes: NodeDef[] = []
  private graphEdges: EdgeDef[] = []
  private nodeIndex: Map<NodeId, NodeDef> = new Map()
  private nodeMarkers: Map<NodeId, Phaser.GameObjects.Arc> = new Map()
  private edgeGraphics!: Phaser.GameObjects.Graphics
  private selectedNodeId?: NodeId
  private nodeHoverId?: NodeId
  private lastSnapshot!: SimSnapshot
  private hudText!: Phaser.GameObjects.Text
  private logText?: Phaser.GameObjects.Text
  private drone!: Phaser.GameObjects.Arc
  private selectionRing!: Phaser.GameObjects.Arc
  private targetPos: Point | null = null
  private sidePanel?: Phaser.GameObjects.Container
  private panelTitle?: Phaser.GameObjects.Text
  private panelBody?: Phaser.GameObjects.Text
  private btnMove?: ReturnType<typeof createTextButton>
  private btnExtract?: ReturnType<typeof createTextButton>
  private btnStory?: ReturnType<typeof createTextButton>
  private btnHazard?: ReturnType<typeof createTextButton>
  private btnEndDay?: ReturnType<typeof createTextButton>
  private btnChangeRole?: ReturnType<typeof createTextButton>
  private rng = createRng(1337)
  private dayFlags = initDayFlags(createInitialState())
  private endOverlay?: Phaser.GameObjects.Container
  private scanlines?: Phaser.GameObjects.Graphics

  constructor() {
    super('Game')
  }

  init(data: SceneInitData = {}) {
    if (data.loadState) {
      const milestone = data.loadState.milestone ?? 'M6'
      this.state = { ...data.loadState, milestone }
    } else {
      this.state = createInitialState({ milestone: data.milestone ?? 'M2' })
    }
    this.milestone = this.state.milestone
    this.allowFreeMove = this.milestone === 'M1'
    this.settings = loadSettings()
  }

  create() {
    if (!this.state) {
      this.state = createInitialState({ milestone: 'M2' })
      this.milestone = this.state.milestone
    }

    this.dayFlags = initDayFlags(this.state)
    this.lastStateRef = this.state
    this.lastSnapshot = this.toSnapshot(this.state)

    const showGraph = this.isAtLeast('M2')
    this.graphNodes = showGraph ? [...data.nodes] : []
    this.graphEdges = showGraph ? [...data.edges] : []
    this.nodeIndex = new Map(this.graphNodes.map((n) => [n.id, n]))

    this.cameras.main.setBounds(0, 0, 2200, 1400)

    this.add.rectangle(0, 0, 2200, 1400, theme.colors.bg).setOrigin(0)

    this.drawGrid(2200, 1400, 32)

    this.edgeGraphics = this.add.graphics().setDepth(3)

    this.renderEdges()
    this.renderNodes()

    const startNode = this.nodeIndex.get(this.state.run.droneNodeId)
    const start = startNode ? startNode.pos : ({ x: 420, y: 360 } as const)
    this.drone = this.add.circle(start.x, start.y, 10, 0xffb000, 1) as Phaser.GameObjects.Arc
    this.drone.setDepth(10)

    this.selectionRing = this.add.circle(start.x, start.y, 18, 0x000000, 0) as Phaser.GameObjects.Arc
    this.selectionRing.setStrokeStyle(2, 0xffb000, 0.55)
    this.selectionRing.setDepth(9)

    createHudPlaceholder(this)

    this.hudText = this.add
      .text(12, 10, '', { fontFamily: theme.fonts.ui, fontSize: '12px', color: theme.colors.sandHex })
      .setScrollFactor(0)
      .setDepth(100)

    if (this.isAtLeast('M2')) {
      this.logText = this.add
        .text(12, 40, '', { fontFamily: theme.fonts.ui, fontSize: '11px', color: theme.colors.sandHex, lineSpacing: 2 })
        .setScrollFactor(0)
        .setDepth(100)

      this.createSidePanel()
      this.refreshSidePanel()
      this.refreshLogView()
    }

    this.add
      .text(20, 52, this.getHintText(), {
        fontFamily: theme.fonts.ui,
        fontSize: '12px',
        color: theme.colors.sandHex,
      })
      .setScrollFactor(0)

    this.cameras.main.centerOn(start.x, start.y)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.allowFreeMove) return
      if (p.leftButtonDown() && this.nodeHoverId) return
      const world = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      this.targetPos = { x: world.x, y: world.y }
    })

    this.snapDroneToNode(this.state.run.droneNodeId)

    const hash = (Date.now() ^ Math.floor(Math.random() * 1_000_000)) >>> 0
    this.rng = createRng(hash)

    const kb = this.input.keyboard
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)

      kb.on('keydown', (ev: KeyboardEvent) => {
        const key = ev.key.toLowerCase()
        if (this.endOverlay) {
          if (key === 'm') this.scene.start('Menu')
          if (key === 'r') this.scene.start('Game', { milestone: this.milestone })
          return
        }
        if (key === 'escape') {
          this.scene.start('Menu')
          return
        }
        if (this.isAtLeast('M5')) {
          if (key === 'f5') this.saveManual('slot1')
          if (key === 'f6') this.saveManual('slot2')
          if (key === 'f7') this.saveManual('slot3')
        }
      })
    }

    if (this.isAtLeast('M3')) {
      saveToSlot('autosave', this.state)
    }

    this.applySettings()
  }

  update(_: number, dtMs: number) {
    const dt = dtMs / 1000

    this.updateCameraPan(dt)

    if (this.allowFreeMove && this.targetPos) {
      const speed = 220
      const dx = this.targetPos.x - this.drone.x
      const dy = this.targetPos.y - this.drone.y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) {
        this.targetPos = null
      } else {
        const step = Math.min(dist, speed * dt)
        const nx = dx / dist
        const ny = dy / dist
        this.drone.x += nx * step
        this.drone.y += ny * step
      }
    }

    this.selectionRing.setPosition(this.drone.x, this.drone.y)

    if (this.state !== this.lastStateRef) {
      this.lastStateRef = this.state
    }
    const snap = this.toSnapshot(this.lastStateRef)
    if (
      !this.lastSnapshot ||
      snap.day !== this.lastSnapshot.day ||
      snap.heat !== this.lastSnapshot.heat ||
      snap.vitals !== this.lastSnapshot.vitals ||
      snap.stress !== this.lastSnapshot.stress ||
      snap.trust !== this.lastSnapshot.trust ||
      snap.integrity !== this.lastSnapshot.integrity
    ) {
      this.hudText.setText(
        `Day ${snap.day}  Heat ${snap.heat}  Power ${this.state.inventory.power}  Supplies ${this.state.inventory.supplies}  Parts ${this.state.inventory.parts}  Scala V ${snap.vitals}  Stress ${snap.stress}  Trust ${snap.trust}  Drone ${snap.integrity}`,
      )
      this.lastSnapshot = snap
    }

    if (this.endOverlay && this.isAtLeast('M2')) {
      const ended = stepAndCheckEnd(this.state).ended
      if (ended) {
        this.btnMove?.setDisabled(true)
        this.btnExtract?.setDisabled(true)
        this.btnStory?.setDisabled(true)
        this.btnHazard?.setDisabled(true)
      }
    }
  }

  private isAtLeast(target: Milestone): boolean {
    return milestoneAtLeast(this.milestone, target)
  }

  private getHintText(): string {
    if (this.milestone === 'M0') return 'M0: wiring only. ESC: Menu'
    if (this.milestone === 'M1') return 'M1: click to move. ESC: Menu'
    if (this.milestone === 'M2') return 'M2: select nodes to act. ESC: Menu'
    if (this.milestone === 'M3') return 'M3: day loop + autosave. ESC: Menu'
    if (this.milestone === 'M4') return 'M4: salvage drone when down. ESC: Menu'
    if (this.milestone === 'M5') return 'M5: options + save slots (F5-F7). ESC: Menu'
    return 'M6: endings live. ESC: Menu'
  }

  private toSnapshot(s: GameState): SimSnapshot {
    return {
      day: s.day,
      heat: s.heat,
      vitals: s.scala.vitals,
      stress: s.scala.stress,
      trust: s.scala.trust,
      integrity: s.drone.integrity,
    }
  }

  private renderEdges() {
    this.edgeGraphics.clear()
    if (!this.isAtLeast('M2')) return

    const baseColor = 0x253036
    this.edgeGraphics.lineStyle(2, baseColor, 0.65)

    for (const e of this.graphEdges) {
      const a = this.nodeIndex.get(e.from)
      const b = this.nodeIndex.get(e.to)
      if (!a || !b) continue
      this.edgeGraphics.beginPath()
      this.edgeGraphics.moveTo(a.pos.x, a.pos.y)
      this.edgeGraphics.lineTo(b.pos.x, b.pos.y)
      this.edgeGraphics.strokePath()
    }

    if (this.selectedNodeId) {
      const n = this.nodeIndex.get(this.selectedNodeId)
      if (n) {
        this.edgeGraphics.lineStyle(3, 0xffb000, 0.55)
        for (const e of this.graphEdges) {
          if (e.from !== n.id && e.to !== n.id) continue
          const a = this.nodeIndex.get(e.from)
          const b = this.nodeIndex.get(e.to)
          if (!a || !b) continue
          this.edgeGraphics.beginPath()
          this.edgeGraphics.moveTo(a.pos.x, a.pos.y)
          this.edgeGraphics.lineTo(b.pos.x, b.pos.y)
          this.edgeGraphics.strokePath()
        }
      }
    }
  }

  private renderNodes() {
    if (!this.isAtLeast('M2')) return

    for (const n of this.graphNodes) {
      const color = this.nodeFill(n.type)
      const arc = this.add.circle(n.pos.x, n.pos.y, 12, color, 1) as Phaser.GameObjects.Arc
      arc.setDepth(6)
      arc.setStrokeStyle(2, 0x0f1316, 0.9)
      arc.setInteractive({ useHandCursor: true })

      arc.on('pointerover', () => {
        this.nodeHoverId = n.id
        arc.setStrokeStyle(2, 0xffb000, 0.8)
      })

      arc.on('pointerout', () => {
        this.nodeHoverId = undefined
        arc.setStrokeStyle(2, 0x0f1316, 0.9)
      })

      arc.on('pointerdown', () => {
        this.selectedNodeId = n.id
        this.state = {
          ...this.state,
          run: { ...this.state.run, selectedNodeId: n.id },
        }
        this.updateSelectionRingToNode(n.id)
        this.renderEdges()
        this.refreshSidePanel()
      })

      const label = this.add
        .text(n.pos.x, n.pos.y + 18, n.name, {
          fontFamily: theme.fonts.ui,
          fontSize: '11px',
          color: theme.colors.sandHex,
        })
        .setOrigin(0.5, 0)
      label.setDepth(6)

      this.nodeMarkers.set(n.id, arc)
    }

    this.updateSelectionRingToNode(this.state.run.droneNodeId)
  }

  private updateSelectionRingToNode(nodeId: NodeId) {
    const n = this.nodeIndex.get(nodeId)
    if (!n) return
    this.selectionRing.setPosition(n.pos.x, n.pos.y)
  }

  private nodeFill(t: NodeType): number {
    if (t === 'Extract') return 0xffb000
    if (t === 'Story') return 0xd8caa7
    return 0xff6b3d
  }

  private updateCameraPan(dt: number) {
    const cam = this.cameras.main
    const speed = 420

    const kb = this.input.keyboard
    if (!kb) return

    const up = kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.W), 0) ||
      kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP), 0)
    const down = kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.S), 0) ||
      kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN), 0)
    const left = kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.A), 0) ||
      kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT), 0)
    const right = kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.D), 0) ||
      kb.checkDown(kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT), 0)

    if (up) cam.scrollY -= speed * dt
    if (down) cam.scrollY += speed * dt
    if (left) cam.scrollX -= speed * dt
    if (right) cam.scrollX += speed * dt
  }

  private createSidePanel() {
    const { width, height } = this.scale
    const w = 300
    const x = width - w - 12
    const y = 48
    const h = height - y - 12

    const panel = createPanel(this, { x, y, w, h, title: 'Node' })
    this.sidePanel = panel.container

    this.panelTitle = this.add
      .text(12, 30, '', { fontFamily: theme.fonts.ui, fontSize: '14px', color: theme.colors.sandHex })
      .setOrigin(0)
    this.sidePanel.add(this.panelTitle)

    this.panelBody = this.add
      .text(12, 54, '', { fontFamily: theme.fonts.ui, fontSize: '12px', color: theme.colors.sandHex, lineSpacing: 4, wordWrap: { width: w - 24 } })
      .setOrigin(0)
    this.sidePanel.add(this.panelBody)

    const btnW = w - 24
    const btnH = 28
    let by = h - 12 - btnH * 6 - 8 * 5

    this.btnMove = createTextButton(this, { x: x + 12, y: y + by, w: btnW, h: btnH, label: 'Move', onClick: () => this.onClickMove() })
    by += btnH + 8
    this.btnExtract = createTextButton(this, { x: x + 12, y: y + by, w: btnW, h: btnH, label: 'Extract', onClick: () => this.onClickExtract() })
    by += btnH + 8
    this.btnStory = createTextButton(this, { x: x + 12, y: y + by, w: btnW, h: btnH, label: 'Read', onClick: () => this.onClickStory() })
    by += btnH + 8
    this.btnHazard = createTextButton(this, { x: x + 12, y: y + by, w: btnW, h: btnH, label: 'Resolve Hazard', onClick: () => this.onClickHazard() })
    by += btnH + 8
    this.btnChangeRole = createTextButton(this, { x: x + 12, y: y + by, w: btnW, h: btnH, label: 'Change Role', onClick: () => this.onClickChangeRole() })
    by += btnH + 8
    this.btnEndDay = createTextButton(this, { x: x + 12, y: y + by, w: btnW, h: btnH, label: 'End Day', onClick: () => this.onClickEndDay() })

    this.sidePanel.add(this.btnMove.container)
    this.sidePanel.add(this.btnExtract.container)
    this.sidePanel.add(this.btnStory.container)
    this.sidePanel.add(this.btnHazard.container)
    this.sidePanel.add(this.btnChangeRole.container)
    this.sidePanel.add(this.btnEndDay.container)
  }

  private refreshSidePanel() {
    if (!this.panelTitle || !this.panelBody || !this.btnMove || !this.btnExtract || !this.btnStory || !this.btnHazard || !this.btnChangeRole || !this.btnEndDay) return

    const sel = this.state.run.selectedNodeId
    const current = this.state.run.droneNodeId
    const droneDown = this.state.drone.status === 'Down'
    const atHome = current === 'N0_HOME'

    // Change Role button: only active at Home
    this.btnChangeRole.setDisabled(!atHome || droneDown)
    this.btnChangeRole.setLabel(`Role: ${this.state.drone.role}`)

    // End Day button: only active at Home
    this.btnEndDay.setDisabled(!atHome || droneDown)

    if (!sel) {
      this.panelTitle.setText(droneDown ? 'Drone Down' : 'No selection')
      this.panelBody.setText(droneDown ? this.salvageSummary() : 'Click a node.')
      this.btnMove.setDisabled(true)
      this.btnExtract.setDisabled(true)
      this.btnStory.setDisabled(true)
      this.btnHazard.setLabel(droneDown ? 'Salvage Drone' : 'Resolve Hazard')
      this.btnHazard.setDisabled(!this.canSalvage())
      return
    }

    const n = this.nodeIndex.get(sel)
    if (!n) return

    const base: string[] = []
    base.push(`${n.type} · Risk ${n.risk}`)
    if (sel === current) base.push('You are here.')

    if (droneDown && this.isAtLeast('M4')) {
      base.push(this.salvageSummary())
      this.panelTitle.setText(n.name)
      this.panelBody.setText(base.join('\n'))
      this.btnMove.setDisabled(true)
      this.btnExtract.setDisabled(true)
      this.btnStory.setDisabled(true)
      this.btnHazard.setLabel('Salvage Drone')
      this.btnHazard.setDisabled(!this.canSalvage())
      return
    }

    if (n.type === 'Extract' && n.extract) {
      const done = Boolean(this.state.progress.extractedFrom[n.id])
      const r = n.extract.reward
      const rewardBits = [
        r.power ? `+${r.power} power` : '',
        r.supplies ? `+${r.supplies} supplies` : '',
        r.parts ? `+${r.parts} parts` : '',
        r.endingPart ? `+${r.endingPart}` : '',
      ].filter(Boolean)
      base.push(`Chance ${(n.extract.baseChance * 100).toFixed(0)}% · Heat +${n.extract.heatGain}`)
      base.push(`Reward: ${rewardBits.join(', ') || '—'}`)
      if (done) base.push('Extracted already.')
      this.btnExtract.setDisabled(done)
    } else {
      this.btnExtract.setDisabled(true)
    }

    if (n.type === 'Story' && n.story) {
      const read = Boolean(this.state.progress.storyRead[n.id])
      base.push(`${n.story.lines.length} lines`)
      if (n.story.once && read) base.push('Already read.')
      this.btnStory.setDisabled(Boolean(n.story.once && read))
      this.btnStory.setLabel(n.story.once && read ? 'Read (done)' : 'Read')
    } else {
      this.btnStory.setDisabled(true)
      this.btnStory.setLabel('Read')
    }

    if (n.type === 'Hazard' && n.hazard) {
      const resolved = Boolean(this.state.progress.hazardResolved[n.id])
      base.push(`${n.hazard.key} · Severity ${n.hazard.severity}`)
      if (resolved) base.push('Resolved.')
      this.btnHazard.setDisabled(resolved)
      this.btnHazard.setLabel(resolved ? 'Hazard (done)' : 'Resolve Hazard')
    } else {
      this.btnHazard.setDisabled(true)
      this.btnHazard.setLabel('Resolve Hazard')
    }

    const canMove = this.canMoveToSelected()
    this.btnMove.setDisabled(!canMove)

    this.panelTitle.setText(n.name)
    this.panelBody.setText(base.join('\n'))
  }

  private refreshLogView() {
    if (!this.logText) return
    const last = this.state.log.slice(-6)
    this.logText.setText(last.map((l: { speaker: string; text: string }) => `${l.speaker}: ${l.text}`).join('\n'))
  }

  private canMoveToSelected(): boolean {
    if (!this.isAtLeast('M2')) return false
    if (this.state.drone.status === 'Down') return false
    const sel = this.state.run.selectedNodeId
    if (!sel) return false
    if (sel === this.state.run.droneNodeId) return false
    return this.findEdge(this.state.run.droneNodeId, sel) !== undefined
  }

  private findEdge(a: NodeId, b: NodeId): EdgeDef | undefined {
    return this.graphEdges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))
  }

  private onClickMove() {
    if (!this.isAtLeast('M2')) return
    const sel = this.state.run.selectedNodeId
    if (!sel) return
    const edge = this.findEdge(this.state.run.droneNodeId, sel)
    if (!edge) return

    const before = this.state
    const oldHeat = before.heat
    const { outcome, flags } = simulateMove(before, this.rng, edge.cost, this.dayFlags)
    this.dayFlags = flags

    let next = applyMoveCost(before, { heat: outcome.deltaHeat, power: -outcome.deltaPower })
    
    // Track changes
    next = trackHeatChange(next, oldHeat, next.heat)
    next = trackResourceSpend(next, 'power', Math.max(0, -outcome.deltaPower))
    if (outcome.blockedByLockdown) {
      next = trackKeyEvent(next, 'LOCKDOWN')
    }

    // Check WARDEN broadcast
    const { state: wardenState, broadcast } = checkAndTriggerWardenBroadcast(next, this.rng)
    next = wardenState
    if (broadcast) {
      next = appendLog(next, { speaker: 'WARDEN', text: broadcast })
      next = trackKeyEvent(next, 'WARDEN_BROADCAST')
    }

    next = appendLog(next, { speaker: 'SYSTEM', text: `Move → ${this.nodeIndex.get(sel)?.name ?? sel}` })
    if (outcome.blockedByLockdown) {
      next = appendLog(next, { speaker: 'SYSTEM', text: 'Lockdown patrols force a detour.' })
    }

    next = { ...next, run: { ...next.run, droneNodeId: sel, selectedNodeId: sel } }
    next = this.applyTime(next, outcome.time)

    this.state = next
    this.snapDroneToNode(sel)
    this.refreshSidePanel()
    this.refreshLogView()
    this.maybeAutosave()
    this.checkEndAndMaybeOverlay()
  }

  private onClickExtract() {
    if (!this.isAtLeast('M2')) return
    const sel = this.state.run.selectedNodeId
    if (!sel) return
    const n = this.nodeIndex.get(sel)
    if (!n || n.type !== 'Extract' || !n.extract) return
    if (this.state.progress.extractedFrom[sel]) return

    const before = this.state
    const oldHeat = before.heat
    const oldScala = { ...before.scala }
    const oldDroneIntegrity = before.drone.integrity

    const out = simulateExtract(before, this.rng, {
      baseChance: n.extract.baseChance,
      reward: n.extract.reward,
      heatGain: n.extract.heatGain,
      stressGainOnFail: 10 + n.risk * 2,
      integrityLossOnFail: 12 + n.risk * 4,
    })

    let next = applyExtractOutcome(before, out)
    
    // Track changes
    next = trackHeatChange(next, oldHeat, next.heat)
    next = trackScalaChange(next, oldScala)
    next = trackDroneChange(next, oldDroneIntegrity, out.droneDown)
    if (out.ok) {
      if (out.deltaPower > 0) next = trackResourceGain(next, 'power', out.deltaPower)
      if (out.deltaSupplies > 0) next = trackResourceGain(next, 'supplies', out.deltaSupplies)
      if (out.deltaParts > 0) next = trackResourceGain(next, 'parts', out.deltaParts)
    }

    // Check WARDEN broadcast
    const { state: wardenState, broadcast } = checkAndTriggerWardenBroadcast(next, this.rng)
    next = wardenState
    if (broadcast) {
      next = appendLog(next, { speaker: 'WARDEN', text: broadcast })
      next = trackKeyEvent(next, 'WARDEN_BROADCAST')
    }

    next = appendLog(next, { speaker: 'SYSTEM', text: out.ok ? `Extract success at ${n.name}.` : `Extract failed at ${n.name}.` })
    if (!out.ok) this.maybeShake(0.01, 160)
    if (out.obtainedEndingPart) {
      next = appendLog(next, { speaker: 'SYSTEM', text: `Recovered: ${out.obtainedEndingPart}.` })
    }

    next = {
      ...next,
      progress: {
        ...next.progress,
        extractedFrom: { ...next.progress.extractedFrom, [sel]: true },
      },
    }

    next = this.applyTime(next, 1)
    this.state = next
    this.refreshSidePanel()
    this.refreshLogView()
    this.maybeAutosave()
    this.checkEndAndMaybeOverlay()
  }

  private onClickStory() {
    if (!this.isAtLeast('M2')) return
    const sel = this.state.run.selectedNodeId
    if (!sel) return
    const n = this.nodeIndex.get(sel)
    if (!n || n.type !== 'Story' || !n.story) return

    if (n.story.once && this.state.progress.storyRead[sel]) return

    let next = this.state
    for (const line of n.story.lines) {
      next = appendLog(next, line)
    }

    next = {
      ...next,
      progress: {
        ...next.progress,
        storyRead: { ...next.progress.storyRead, [sel]: true },
      },
    }

    next = this.applyTime(next, 1)
    this.state = next
    this.refreshSidePanel()
    this.refreshLogView()
    this.maybeAutosave()
  }

  private onClickHazard() {
    if (!this.isAtLeast('M2')) return
    if (this.isAtLeast('M4') && this.state.drone.status === 'Down') {
      this.performSalvage()
      return
    }

    const sel = this.state.run.selectedNodeId
    if (!sel) return
    const n = this.nodeIndex.get(sel)
    if (!n || n.type !== 'Hazard' || !n.hazard) return
    if (this.state.progress.hazardResolved[sel]) return

    const before = this.state
    const oldHeat = before.heat
    const oldScala = { ...before.scala }
    const oldDroneIntegrity = before.drone.integrity

    const out = simulateHazard(before, this.rng, { key: n.hazard.key, severity: n.hazard.severity })
    let next = applyHazardOutcome(before, out)
    
    // Track changes
    next = trackHeatChange(next, oldHeat, next.heat)
    next = trackScalaChange(next, oldScala)
    next = trackDroneChange(next, oldDroneIntegrity, out.droneDown)
    if (n.hazard.key === 'PatrolSweep') {
      next = trackKeyEvent(next, 'PATROL_SWEEP')
    } else if (n.hazard.key === 'WardenSweep') {
      next = trackKeyEvent(next, 'WARDEN_SWEEP')
    }

    // Check WARDEN broadcast
    const { state: wardenState, broadcast } = checkAndTriggerWardenBroadcast(next, this.rng)
    next = wardenState
    if (broadcast) {
      next = appendLog(next, { speaker: 'WARDEN', text: broadcast })
      next = trackKeyEvent(next, 'WARDEN_BROADCAST')
    }

    next = appendLog(next, { speaker: 'SYSTEM', text: out.ok ? `${n.hazard.key} cleared.` : `${n.hazard.key} hit.` })
    if (!out.ok) this.maybeShake(0.015, 180)

    next = {
      ...next,
      progress: {
        ...next.progress,
        hazardResolved: { ...next.progress.hazardResolved, [sel]: true },
      },
    }

    next = this.applyTime(next, 1)
    this.state = next
    this.refreshSidePanel()
    this.refreshLogView()
    this.maybeAutosave()
    this.checkEndAndMaybeOverlay()
  }

  private canSalvage(): boolean {
    if (!this.isAtLeast('M4')) return false
    if (this.state.drone.status !== 'Down') return false
    return this.state.inventory.parts >= 2 && this.state.inventory.power >= 1
  }

  private salvageSummary(): string {
    if (!this.isAtLeast('M4')) return 'Drone down.'
    if (this.canSalvage()) return 'Drone down. Salvage costs 2 parts + 1 power.'
    return 'Drone down. Need 2 parts + 1 power to salvage.'
  }

  private performSalvage() {
    if (!this.canSalvage()) return

    let next: GameState = {
      ...this.state,
      inventory: {
        ...this.state.inventory,
        parts: Math.max(0, this.state.inventory.parts - 2),
        power: Math.max(0, this.state.inventory.power - 1),
      },
      drone: {
        ...this.state.drone,
        integrity: 60,
        status: 'OK',
      },
    }

    next = appendLog(next, { speaker: 'SYSTEM', text: 'Salvage complete. Drone restored to 60%.' })
    next = this.applyTime(next, 1)

    this.state = next
    this.refreshSidePanel()
    this.refreshLogView()
    this.maybeAutosave()
  }

  private onClickEndDay() {
    if (!this.isAtLeast('M2')) return
    if (this.state.run.droneNodeId !== 'N0_HOME') return
    if (this.state.drone.status === 'Down') return

    this.scene.start('Debrief', { state: this.state })
  }

  private onClickChangeRole() {
    if (!this.isAtLeast('M2')) return
    if (this.state.run.droneNodeId !== 'N0_HOME') return
    if (this.state.drone.status === 'Down') return

    const roles: Array<'Scout' | 'Mule' | 'Hack'> = ['Scout', 'Mule', 'Hack']
    const currentIdx = roles.indexOf(this.state.drone.role)
    const nextIdx = (currentIdx + 1) % roles.length
    const nextRole = roles[nextIdx]

    this.state = {
      ...this.state,
      drone: {
        ...this.state.drone,
        role: nextRole,
      },
    }

    this.state = appendLog(this.state, { speaker: 'SYSTEM', text: `Drone role changed to ${nextRole}.` })
    this.refreshSidePanel()
    this.refreshLogView()
    this.maybeAutosave()
  }

  private applyTime(state: GameState, timeCost: number): GameState {
    if (!this.isAtLeast('M3')) return state
    if (timeCost <= 0) return state
    const next = { ...state, day: state.day + timeCost }
    this.dayFlags = initDayFlags(next)
    return next
  }

  private maybeAutosave() {
    if (!this.isAtLeast('M3')) return
    saveToSlot('autosave', this.state)
  }

  private saveManual(slot: 'slot1' | 'slot2' | 'slot3') {
    if (!this.isAtLeast('M5')) return
    saveToSlot(slot, this.state)
    this.state = appendLog(this.state, { speaker: 'SYSTEM', text: `Saved to ${slot.toUpperCase()}.` })
    this.refreshLogView()
  }

  private maybeShake(intensity: number, duration: number) {
    if (!this.isAtLeast('M5')) return
    if (!this.settings.cameraShake) return
    this.cameras.main.shake(duration, intensity)
  }

  private applySettings() {
    if (!this.isAtLeast('M5')) return
    const { width, height } = this.scale
    if (this.settings.scanlines) {
      if (!this.scanlines) {
        const g = this.add.graphics()
        g.setScrollFactor(0)
        g.setDepth(800)
        g.lineStyle(1, 0x0b0f12, 0.25)
        for (let y = 0; y < height; y += 3) {
          g.beginPath()
          g.moveTo(0, y)
          g.lineTo(width, y)
          g.strokePath()
        }
        this.scanlines = g
      } else {
        this.scanlines.setVisible(true)
      }
    } else if (this.scanlines) {
      this.scanlines.setVisible(false)
    }
  }

  private snapDroneToNode(nodeId: NodeId) {
    const n = this.nodeIndex.get(nodeId)
    if (!n) return
    this.drone.setPosition(n.pos.x, n.pos.y)
    this.targetPos = null
  }

  private checkEndAndMaybeOverlay() {
    if (!this.isAtLeast('M6')) return
    const res = stepAndCheckEnd(this.state)
    if (!res.ended) return

    this.state = res.state

    if (this.endOverlay) return

    const { width, height } = this.scale
    const container = this.add.container(0, 0)
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0)
    const msg = res.win ? 'ENDING: LATTICE LINK COMPLETE' : `FAILED: ${res.failReason ?? 'Unknown'}`
    const txt = this.add
      .text(width / 2, height / 2 - 12, msg, { fontFamily: theme.fonts.ui, fontSize: '18px', color: theme.colors.sandHex })
      .setOrigin(0.5)
    const sub = this.add
      .text(width / 2, height / 2 + 18, 'Press M for Menu · R to Restart', {
        fontFamily: theme.fonts.ui,
        fontSize: '12px',
        color: theme.colors.sandHex,
      })
      .setOrigin(0.5)

    container.add([bg, txt, sub])
    container.setScrollFactor(0)
    container.setDepth(2000)
    this.endOverlay = container
  }

  private drawGrid(worldW: number, worldH: number, cell: number) {
    const g = this.add.graphics()
    g.setDepth(1)

    const color = 0x1a2227
    const alpha = 0.55
    g.lineStyle(1, color, alpha)

    for (let x = 0; x <= worldW; x += cell) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, worldH)
      g.strokePath()
    }

    for (let y = 0; y <= worldH; y += cell) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(worldW, y)
      g.strokePath()
    }
  }
}
