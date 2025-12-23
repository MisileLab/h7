# Scalar Architecture & Design

## System Overview

Scalar is divided into two main layers:

1.  **Sim Core (`src/sim`)**: A pure, deterministic state machine. It takes a `GameState` and `WegoCommands`, and returns a `nextState`, `SimEvent[]`, and an `Observation`.
2.  **Game Layer (`src/game`)**: A Phaser-based visualization and interaction layer. It handles user input, rendering, and meta-progression (Station).

## WEGO Resolution Order

Each simulation `step()` follows a strict resolution order to ensure determinism:

1.  **Maintenance**: Power consumption for active units and systems.
2.  **Low Power Update**: Check if the system is in a low-power state (power below threshold).
3.  **Command Sanitization**: Filter out invalid player commands (e.g., commands for non-existent drones).
4.  **Power Costs**: Deduct power for player actions. If power is insufficient, the action fails.
5.  **AI Planning**: Enemies calculate their actions based on the current state.
6.  **Command Deduping**: Ensure each unit only has one command.
7.  **Movement Resolution**:
    - Movement and Dash commands are resolved first.
    - Units are processed in order of their `droneId`.
    - Collisions are checked against the grid and other units' current positions.
8.  **Action Resolution**:
    - Non-movement commands (Shoot, Reload, Hack, Loot, Use Item, Extract) are processed.
    - Actions are executed if the unit is still alive and not disabled (e.g., EMP status).
9.  **Application**:
    - Damage, heals, and status effects are applied.
    - Smoke tiles are updated.
10. **Loot Seals**: "Sealing" an item (making it persistent) succeeds only if the unit took no damage during the turn.
11. **Cleanup**: Statuses and smoke duration tick down.
12. **Mission Status**: Check for squad wipe, power exhaustion, or successful extraction.

## Power Rules

- **Starting Power**: Set by the Station's power budget (defaults to 120).
- **Maintenance**: Fixed cost per turn (1 power per alive drone).
- **Action Costs**: Specific costs for Dash (1), Shoot (1), Reload (1), Use Item (1), Hack (2), Force Door (2), and Seal (1 + 5 extra). These can be modified by unit traits.
- **Low Power Threshold**: When power drops to 0 or below, the mission enters a Low Power state.
- **Low Power Penalties**:
    - Movement range is reduced by 1.
    - Hacking is completely disabled.
- **Power Outage**: If the mission remains in a Low Power state for 2 or more turns (`>= lowPowerTurnsToFail`), it automatically fails.

## Loadout & Loot

- **Loadout Selection**: Players can cycle through available Primary and Secondary weapons at the Station. Modules and consumables are currently fixed based on the drone type.
- **Backpack**: Limited slots (default 8) for loot items found during raids.
- **Sealed Items**: A special slot for one item.
    - **Sealing**: Requires a special SEAL command.
    - **Interruption**: Sealing fails if the unit takes any damage during the turn it attempts to seal.
    - **Persistence**: If a mission fails, ONLY the item in the sealed slot is recovered (and only if it was successfully sealed during the raid). If the mission succeeds, all backpack and sealed items are recovered.
- **Upgrades**: Increase Power Budget (+5) and Backpack Capacity (+1) at the Station using free upgrade buttons (no loot currency required in current version).
- **Log Unlocking**:
    - **Failure**: Unlocks the next log in the list (1).
    - **Success**: Unlocks the next two logs in the list (if available).
