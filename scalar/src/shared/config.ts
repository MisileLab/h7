export const GRID = {
  roomWidth: 8,
  roomHeight: 8,
  roomCount: 5,
  corridorWidth: 1
};

export const POWER = {
  start: 120,
  maintenancePerDrone: 1,
  lowPowerThreshold: 0,
  lowPowerMovePenalty: 1,
  lowPowerTurnsToFail: 2,
  lowPowerHackDisabled: true
};

export const ACTION_LIMITS = {
  moveMax: 3,
  dashMax: 6,
  backpackSlots: 8,
  sealedItemLimit: 1
};

export const ACTION_COSTS = {
  dash: 1,
  shoot: 1,
  reload: 1,
  useItem: 1,
  hack: 2,
  forceDoor: 2,
  sealAction: 1,
  sealExtra: 5
};

export const COMBAT = {
  cover: {
    half: 1,
    full: 2
  }
};

export const CONSOLE = {
  powerRestore: 10
};
