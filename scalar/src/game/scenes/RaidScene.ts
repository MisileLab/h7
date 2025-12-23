import Phaser from 'phaser';
import { SCENE_KEYS, COLORS } from '../types';
import { simBridge } from '../simBridge';
import { GameState, UnitState, Vec2 } from '../../sim/state';
import { DroneCommand } from '../../sim/schemas';
import { UIScene } from './UIScene';

const TILE_SIZE = 24;
const GRID_OFFSET_X = 50;
const GRID_OFFSET_Y = 100;

function parseHexColor(hex: string): number {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  return Number.parseInt(normalized, 16);
}

export class RaidScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private selectedUnitId: string | null = null;
  private currentCommandType: string | null = null;
  private pendingCommands: DroneCommand[] = [];
  private actionButtons: Phaser.GameObjects.Container | undefined;
  private lastAutoTurnTime: number = 0;
  private replayValidationPending: boolean = false;

  constructor() {
    super(SCENE_KEYS.RAID);
  }

  create() {
    this.graphics = this.add.graphics();
    
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleGridClick(pointer.x, pointer.y);
    });

    this.add.text(800, 700, '[ EXECUTE ]', { fontSize: '24px', color: COLORS.accent, backgroundColor: '#222', padding: { x: 10, y: 5 } })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.executeTurn());
      
    this.createActionUI();
  }

  update(time: number) {
    this.graphics.clear();
    this.renderGrid();
    this.renderUnits();
    this.renderHighlights();

     if (simBridge.isReplayActive()) {
         const state = simBridge.getRaidState();
         const ui = this.scene.get(SCENE_KEYS.UI) as UIScene;
         if (state) {
             const replayTurns = simBridge.getReplayTurnCount();
             if (replayTurns && state.turn > replayTurns && !this.replayValidationPending) {
                 this.replayValidationPending = true;
                 simBridge.validateReplay().then((validation) => {
                     if (validation) {
                         const message = validation.ok
                             ? `REPLAY OK: ${validation.hash}`
                             : `REPLAY MISMATCH: ${validation.hash}`;
                         ui.addLog(message);
                         if (!validation.ok) {
                             alert(`REPLAY VALIDATION FAILED: ${validation.hash}`);
                         }
                     }
                     simBridge.clearReplay();
                     this.replayValidationPending = false;
                 });
                 return;
             }
             if (state.mission.status === 'IN_PROGRESS' && time - this.lastAutoTurnTime > 500) {
                 const cmds = simBridge.getReplayCommandsForTurn(state.turn);
                 if (cmds) {
                     this.pendingCommands = cmds;
                     this.executeTurn();
                     this.lastAutoTurnTime = time;
                 }
             }
         }
     }

  }

  private renderGrid() {
    const state = simBridge.getRaidState();
    if (!state) return;

    // Draw Floor
    this.graphics.fillStyle(COLORS.floor);
    for (const tile of state.grid.tiles) {
      if (tile.terrain === 'floor') {
        const x = GRID_OFFSET_X + tile.x * TILE_SIZE;
        const y = GRID_OFFSET_Y + tile.y * TILE_SIZE;
        this.graphics.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
        
        // Smoke
        if (tile.smoke) {
            this.graphics.fillStyle(0xcccccc, 0.3);
            this.graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            this.graphics.fillStyle(COLORS.floor); // Reset
        }
        
        // Extraction Zone
        if (tile.extraction) {
            this.graphics.lineStyle(2, parseHexColor(COLORS.accent));
            this.graphics.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    
    // Draw Walls (implied by lack of floor or specific wall tiles if they exist in list, usually walls are grid bound)
    // Actually state.grid.tiles includes walls if they are explicitly in the list.
    this.graphics.fillStyle(COLORS.wall);
    for (const tile of state.grid.tiles) {
      if (tile.terrain === 'wall') {
        const x = GRID_OFFSET_X + tile.x * TILE_SIZE;
        const y = GRID_OFFSET_Y + tile.y * TILE_SIZE;
        this.graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw Objects
    Object.values(state.doors).forEach(door => {
      const x = GRID_OFFSET_X + door.pos.x * TILE_SIZE;
      const y = GRID_OFFSET_Y + door.pos.y * TILE_SIZE;
      this.graphics.fillStyle(parseHexColor(COLORS.door), door.open ? 0.3 : 1.0);
      this.graphics.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    });

    Object.values(state.consoles).forEach(console => {
        const x = GRID_OFFSET_X + console.pos.x * TILE_SIZE;
        const y = GRID_OFFSET_Y + console.pos.y * TILE_SIZE;
        this.graphics.fillStyle(COLORS.console);
        this.graphics.fillCircle(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/4);
    });

    Object.values(state.crates).forEach(crate => {
        if (crate.opened) return;
        const x = GRID_OFFSET_X + crate.pos.x * TILE_SIZE;
        const y = GRID_OFFSET_Y + crate.pos.y * TILE_SIZE;
        this.graphics.fillStyle(COLORS.crate);
        this.graphics.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    });
  }

  private renderUnits() {
    const state = simBridge.getRaidState();
    if (!state) return;

    Object.values(state.units).forEach(unit => {
      if (unit.hp <= 0) return;
      const x = GRID_OFFSET_X + unit.pos.x * TILE_SIZE;
      const y = GRID_OFFSET_Y + unit.pos.y * TILE_SIZE;
      
      this.graphics.fillStyle(unit.faction === 'drone' ? COLORS.drone : COLORS.enemy);
      this.graphics.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      
      // HP Bar
      const hpPct = unit.hp / unit.maxHp;
      this.graphics.fillStyle(0x00ff00);
      this.graphics.fillRect(x, y - 4, TILE_SIZE * hpPct, 2);
    });
  }

  private renderHighlights() {
    const state = simBridge.getRaidState();
    if (!state) return;

    // Selected Unit
    if (this.selectedUnitId) {
      const unit = state.units[this.selectedUnitId];
      if (unit && unit.hp > 0) {
        const x = GRID_OFFSET_X + unit.pos.x * TILE_SIZE;
        const y = GRID_OFFSET_Y + unit.pos.y * TILE_SIZE;
        this.graphics.lineStyle(2, 0xffffff);
        this.graphics.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // Pending Commands
    this.pendingCommands.forEach(cmd => {
      if (cmd.type === 'MOVE' || cmd.type === 'DASH') {
        const path = cmd.params.path;
        this.graphics.lineStyle(2, 0xffff00, 0.5);
        this.graphics.beginPath();
        if (path.length > 0) {
            const startX = GRID_OFFSET_X + path[0].x * TILE_SIZE + TILE_SIZE/2;
            const startY = GRID_OFFSET_Y + path[0].y * TILE_SIZE + TILE_SIZE/2;
            this.graphics.moveTo(startX, startY);
            for (let i = 1; i < path.length; i++) {
                const px = GRID_OFFSET_X + path[i].x * TILE_SIZE + TILE_SIZE/2;
                const py = GRID_OFFSET_Y + path[i].y * TILE_SIZE + TILE_SIZE/2;
                this.graphics.lineTo(px, py);
            }
        }
        this.graphics.strokePath();
      }
    });
  }

  private handleGridClick(screenX: number, screenY: number) {
    if (simBridge.isReplayActive()) {
      return;
    }

    const state = simBridge.getRaidState();
    if (!state) {
      return;
    }

    const gridWidthPx = state.grid.width * TILE_SIZE;
    const gridHeightPx = state.grid.height * TILE_SIZE;
    const inGridBounds =
      screenX >= GRID_OFFSET_X &&
      screenY >= GRID_OFFSET_Y &&
      screenX < GRID_OFFSET_X + gridWidthPx &&
      screenY < GRID_OFFSET_Y + gridHeightPx;

    if (!inGridBounds) {
      return;
    }

    const gridX = Math.floor((screenX - GRID_OFFSET_X) / TILE_SIZE);
    const gridY = Math.floor((screenY - GRID_OFFSET_Y) / TILE_SIZE);

    const clickedUnit = Object.values(state.units).find(u => u.pos.x === gridX && u.pos.y === gridY && u.hp > 0);

    if (this.currentCommandType && this.selectedUnitId) {
        this.resolveCommand(gridX, gridY, clickedUnit);
    } else {
        // Selection
        if (clickedUnit && clickedUnit.faction === 'drone') {
            this.selectedUnitId = clickedUnit.id;
            this.showActionUI(true);
            this.currentCommandType = null;
        } else {
            this.selectedUnitId = null;
            this.showActionUI(false);
        }
    }
  }

  private resolveCommand(x: number, y: number, targetUnit?: UnitState) {
      if (!this.selectedUnitId || !this.currentCommandType) return;
      
      const state = simBridge.getRaidState();
      if (!state) return;
      const unit = state.units[this.selectedUnitId];
      if (!unit) return;

      const ui = this.scene.get(SCENE_KEYS.UI) as UIScene;

      // Filter existing commands for this unit
      this.pendingCommands = this.pendingCommands.filter(c => c.droneId !== this.selectedUnitId);

      switch (this.currentCommandType) {
          case 'MOVE':
          case 'DASH':
              // Simple pathfinding: just straight line or naive for prototype
              // Wait, I need a path. 
              // For prototype: Just [currentPos, targetPos] and let sim validate/truncate?
              // Sim expects adjacent steps. I need a pathfinder.
              // I will implement a very dumb BFS here since I can't import sim's pathfinding easily or it's not exported.
              // Actually `isPassable` is exported from `src/sim/rules/grid`. I can import it?
              // The requirements say "Keep /src/sim pure; only import from sim". Yes I can import FROM sim.
              // So I'll implement BFS here using sim's `isPassable` if I can export it, or just replicate logic.
              // Let's just do Manhattan path for now.
              {
                  const path = this.findPath(unit.pos, { x, y }, state);
                  if (path) {
                    this.pendingCommands.push({ 
                        droneId: this.selectedUnitId, 
                        type: this.currentCommandType as 'MOVE' | 'DASH', 
                        params: { path } 
                    });
                    ui.addLog(`Planned ${this.currentCommandType} to ${x},${y}`);
                  } else {
                      ui.addLog("Cannot move there.");
                  }
              }
              break;
          case 'SHOOT':
              if (targetUnit && targetUnit.faction === 'enemy') {
                  this.pendingCommands.push({
                      droneId: this.selectedUnitId,
                      type: 'SHOOT',
                      params: { targetId: targetUnit.id }
                  });
                  ui.addLog(`Targeted ${targetUnit.id}`);
              }
              break;
          case 'RELOAD':
              this.pendingCommands.push({
                  droneId: this.selectedUnitId,
                  type: 'RELOAD'
              });
              ui.addLog(`Reloading ${this.selectedUnitId}`);
              break;
          case 'USE_ITEM':
              if (unit.loadout) {
                  const item = unit.loadout.consumables.find(c => c.charges > 0);
                  if (item) {
                      this.pendingCommands.push({
                          droneId: this.selectedUnitId,
                          type: 'USE_ITEM',
                          params: { itemId: item.itemId, targetId: unit.id }
                      });
                      ui.addLog(`Using ${item.itemId}`);
                  } else {
                      ui.addLog('No consumables available');
                  }
              }
              break;
          case 'SEAL':
              if (unit.inventory && unit.inventory.backpack.length > 0) {
                  const itemId = unit.inventory.backpack[0].itemId;
                  this.pendingCommands.push({
                      droneId: this.selectedUnitId,
                      type: 'SEAL',
                      params: { itemId }
                  });
                  ui.addLog(`Sealing ${itemId}`);
              } else {
                  ui.addLog('No items to seal');
              }
              break;
          case 'HACK':
              // Check for door or console at pos
              const door = Object.values(state.doors).find(d => d.pos.x === x && d.pos.y === y);
              const consoleObj = Object.values(state.consoles).find(c => c.pos.x === x && c.pos.y === y);
              if (door) {
                  this.pendingCommands.push({ droneId: this.selectedUnitId, type: 'HACK', params: { objectId: door.id } });
                  ui.addLog(`Hacking door ${door.id}`);
              } else if (consoleObj) {
                  this.pendingCommands.push({ droneId: this.selectedUnitId, type: 'HACK', params: { objectId: consoleObj.id } });
                  ui.addLog(`Hacking console`);
              }
              break;
          case 'LOOT':
              const crate = Object.values(state.crates).find(c => c.pos.x === x && c.pos.y === y);
              if (crate) {
                  this.pendingCommands.push({ droneId: this.selectedUnitId, type: 'LOOT', params: { crateId: crate.id } });
                  ui.addLog(`Looting crate`);
              }
              break;
          case 'EXTRACT':
               if (unit.pos.x === state.extractionPos.x && unit.pos.y === state.extractionPos.y) {
                   this.pendingCommands.push({ droneId: this.selectedUnitId, type: 'EXTRACT' });
                   ui.addLog('Prepare for extraction');
               } else {
                   ui.addLog('Unit not at extraction');
               }
               break;
      }
      
      this.currentCommandType = null;
      // Keep selection active to allow changing command
  }

  private executeTurn() {
      const ui = this.scene.get(SCENE_KEYS.UI) as UIScene;
      try {
          const result = simBridge.submitTurn(this.pendingCommands);
          this.pendingCommands = [];
          
          // Log events
          result.events.forEach(e => {
             if (e.type === 'ShotFired') ui.addLog(`Shot fired at ${e.targetId} for ${e.damage} dmg`);
             if (e.type === 'MovementResolved' && !e.success) ui.addLog(`${e.unitId} move failed`);
             if (e.type === 'MissionFailed') ui.addLog(`MISSION FAILED: ${e.reason}`);
             if (e.type === 'ExtractionSuccess') ui.addLog(`${e.unitId} extracted!`);
          });

          // Check mission status
          if (result.nextState.mission.status === 'FAILED') {
              simBridge.recordRaidOutcome(result.nextState);
              const unlocked = simBridge.unlockLogs(1);
              const msg = unlocked.length > 0 ? `LOG DECRYPTED: ${unlocked.join(', ')}` : 'NO NEW DATA';
              alert(`MISSION FAILED: ${result.nextState.mission.failureReason}. ${msg}`);
              this.scene.stop(SCENE_KEYS.UI);
              this.scene.start(SCENE_KEYS.STATION);
          } else if (result.nextState.mission.status === 'EXTRACTED') {
              simBridge.recordRaidOutcome(result.nextState);
              const unlocked = simBridge.unlockLogs(2);
              const msg = unlocked.length > 0 ? `LOG DECRYPTED: ${unlocked.join(', ')}` : 'NO NEW DATA';
              alert(`MISSION COMPLETE! ${msg}`);
              this.scene.stop(SCENE_KEYS.UI);
              this.scene.start(SCENE_KEYS.STATION);
          }
      } catch (error: unknown) {
          console.error(error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          ui.addLog(`Error: ${message}`);
      }
  }

  private createActionUI() {
      this.actionButtons = this.add.container(50, 650);
      const actions = ['MOVE', 'DASH', 'SHOOT', 'RELOAD', 'USE_ITEM', 'HACK', 'LOOT', 'SEAL', 'EXTRACT'];
      
      const buttonsPerRow = 5;
      actions.forEach((action, index) => {
          const col = index % buttonsPerRow;
          const row = Math.floor(index / buttonsPerRow);
          const btn = this.add.text(col * 120, row * 32, `[ ${action} ]`, { fontSize: '20px', color: '#888', backgroundColor: '#111' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.currentCommandType = action;
                const ui = this.scene.get(SCENE_KEYS.UI) as UIScene;
                ui.addLog(`Selected ${action} - Choose Target`);
            });
            // highlight active command?
          this.actionButtons?.add(btn);
      });
      
      this.actionButtons.setVisible(false);
  }

  private showActionUI(show: boolean) {
      this.actionButtons?.setVisible(show);
  }

  // Very naive BFS for prototype
  private findPath(start: Vec2, end: Vec2, state: GameState): Vec2[] | null {
      const queue: { pos: Vec2; path: Vec2[] }[] = [{ pos: start, path: [start] }];
      const visited = new Set<string>();
      visited.add(`${start.x},${start.y}`);
      
      // Limit depth for perf
      while (queue.length > 0) {
          const current = queue.shift();
          if (!current) {
              break;
          }
          const { pos, path } = current;
          if (pos.x === end.x && pos.y === end.y) return path;
          
          if (path.length > 10) continue; 

          const neighbors = [
              { x: pos.x + 1, y: pos.y },
              { x: pos.x - 1, y: pos.y },
              { x: pos.x, y: pos.y + 1 },
              { x: pos.x, y: pos.y - 1 }
          ];

          for (const n of neighbors) {
              const key = `${n.x},${n.y}`;
              if (visited.has(key)) {
                  continue;
              }
              const tile = state.grid.tiles.find((t) => t.x === n.x && t.y === n.y);
              // Passable if tile exists and is floor (ignore units for planning, sim will handle collision/block)
              if (tile && tile.terrain === 'floor') {
                  visited.add(key);
                  queue.push({ pos: n, path: [...path, n] });
              }
          }
      }
      return null;
  }
}
