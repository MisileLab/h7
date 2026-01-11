export interface Rng {
  next(): number
  int(minInclusive: number, maxInclusive: number): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0

  const next = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0x1_0000_0000
  }

  return {
    next,
    int(minInclusive, maxInclusive) {
      const min = Math.ceil(minInclusive)
      const max = Math.floor(maxInclusive)
      if (max < min) throw new Error('Invalid int range')
      const r = next()
      return min + Math.floor(r * (max - min + 1))
    },
  }
}
