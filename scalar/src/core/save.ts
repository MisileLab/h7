import type { GameState } from './state'

export type SaveSlot = 'autosave' | 'slot1' | 'slot2' | 'slot3'

export type Settings = {
  scanlines: boolean
  cameraShake: boolean
  volume: number
}

const PREFIX = 'crystal-scala:'
const SETTINGS_KEY = `${PREFIX}settings`

export function saveToSlot(slot: SaveSlot, state: GameState): void {
  localStorage.setItem(`${PREFIX}${slot}`, JSON.stringify(state))
}

export function loadFromSlot(slot: SaveSlot): GameState | undefined {
  const raw = localStorage.getItem(`${PREFIX}${slot}`)
  if (!raw) return undefined
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object') return undefined
  const s = parsed as Partial<GameState>

  if (typeof s.day !== 'number' || typeof s.heat !== 'number') return undefined
  if (!s.scala || typeof s.scala !== 'object') return undefined
  if (!s.inventory || typeof s.inventory !== 'object') return undefined
  if (!s.drone || typeof s.drone !== 'object') return undefined

  if (!s.run || typeof s.run !== 'object') {
    ;(s as GameState).run = { mode: 'Planning', droneNodeId: 'N0_HOME' }
  }

  if (typeof s.milestone !== 'string') {
    ;(s as GameState).milestone = 'M6'
  }

  if (!s.progress || typeof s.progress !== 'object') {
    ;(s as GameState).progress = { extractedFrom: {}, storyRead: {}, hazardResolved: {} }
  } else {
    const p = s.progress as Partial<GameState['progress']>
    if (!p.extractedFrom || typeof p.extractedFrom !== 'object') {
      ;(s as GameState).progress = { ...(s as GameState).progress, extractedFrom: {} }
    }
    if (!p.storyRead || typeof p.storyRead !== 'object') {
      ;(s as GameState).progress = { ...(s as GameState).progress, storyRead: {} }
    }
    if (!p.hazardResolved || typeof p.hazardResolved !== 'object') {
      ;(s as GameState).progress = { ...(s as GameState).progress, hazardResolved: {} }
    }
  }

  if (!Array.isArray(s.log)) {
    ;(s as GameState).log = []
  }

  if (!s.daySummary || typeof s.daySummary !== 'object') {
    ;(s as GameState).daySummary = {
      gained: { power: 0, supplies: 0, parts: 0 },
      spent: { power: 0, supplies: 0, parts: 0 },
      heatDelta: 0,
      scalaDelta: { vitals: 0, stress: 0, trust: 0 },
      droneDelta: { integrityDelta: 0, wentDown: false, salvageMarked: false },
      keyEvents: [],
    }
  }

  if (!s.wardenState || typeof s.wardenState !== 'object') {
    ;(s as GameState).wardenState = {
      lastBroadcastBucket: -1,
      broadcastBucketsTriggered: [],
    }
  }

  return s as GameState
}

export function clearSlot(slot: SaveSlot): void {
  localStorage.removeItem(`${PREFIX}${slot}`)
}

export function loadSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return { scanlines: false, cameraShake: true, volume: 0.9 }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      scanlines: Boolean(parsed.scanlines),
      cameraShake: parsed.cameraShake !== undefined ? Boolean(parsed.cameraShake) : true,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.9,
    }
  } catch {
    return { scanlines: false, cameraShake: true, volume: 0.9 }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      scanlines: settings.scanlines,
      cameraShake: settings.cameraShake,
      volume: Math.max(0, Math.min(1, settings.volume)),
    }),
  )
}
