export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

function splitMix32(seed: number): number {
  let t = (seed + 0x9e3779b9) | 0;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
  return (t ^ (t >>> 15)) | 0;
}

export function createRng(seed: number): RngState {
  const a = splitMix32(seed);
  const b = splitMix32(a);
  const c = splitMix32(b);
  const d = splitMix32(c);
  return { a, b, c, d };
}

export function nextRng(state: RngState): { value: number; state: RngState } {
  let { a, b, c, d } = state;
  const t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  const res = (t + d) | 0;
  c = (c + res) | 0;
  const value = (res >>> 0) / 0xffffffff;
  return { value, state: { a, b, c, d } };
}

export function nextInt(state: RngState, min: number, max: number): { value: number; state: RngState } {
  const { value, state: next } = nextRng(state);
  const span = max - min + 1;
  const scaled = Math.floor(value * span) + min;
  return { value: scaled, state: next };
}

export function pickOne<T>(state: RngState, items: T[]): { value: T; state: RngState } {
  if (items.length === 0) {
    throw new Error("Cannot pick from empty array");
  }
  const { value, state: next } = nextInt(state, 0, items.length - 1);
  return { value: items[value], state: next };
}
