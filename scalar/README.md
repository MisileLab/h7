# SCALAR

A deterministic grid-based WEGO tactical extraction sim.

## Overview

Scalar is a tactical game where you command a squad of drones in a high-stakes extraction mission. The game uses a WEGO system where all units (drones and enemies) plan their actions simultaneously, which are then resolved in a deterministic simulation step.

## Getting Started

### Prerequisites

- Node.js (v20+)
- npm

### Installation

```bash
npm install
```

### Running the Game

```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Scripts

- `npm run test`: Run simulation tests.
- `npm run sim:run`: Run a simulation from a command log.
  - Usage: `npm run sim:run -- --seed 123 --turns 10 --out replay.json`
- `npm run sim:validate`: Validate a replay file against the current sim core.
  - Usage: `npm run sim:validate -- replay.json`

## Key Mechanics

- **WEGO System**: Plan actions for all drones, then watch them resolve alongside enemy actions.
- **Power Management**: Drones consume power for maintenance and actions. Running out of power leads to "Low Power" state and eventual mission failure.
- **Deterministic Simulation**: Given the same seed and commands, the simulation always produces the same outcome.
- **Extraction**: Reach the extraction zone and use the EXTRACT command to escape with your loot.
- **Station Meta**: Upgrade your squad's power budget and backpack capacity between raids.
- **Loadout Cycling**: Cycle through primary and secondary weapons at the Station.
- **Loot Recovery**: Recover all items in your backpack and sealed slot upon successful extraction. If the mission fails, only successfully sealed items are recovered.

## Replays

You can load and watch replays in the browser by adding the `?replay=` query parameter:
`http://localhost:5173/?replay=path/to/replay.json`
