import type { Quality } from "./cityChoreography";

export interface Tower {
  x: number;
  z: number;
  /** vertical offset of the box base (0 = street level) */
  base: number;
  width: number;
  depth: number;
  height: number;
  /** 1..7 — the turn this tower appears in */
  turn: number;
  /** 0 = unhealthy, 1 = healthy */
  health: number;
  /** 1 for the tower blamed by the autopsy */
  flag: number;
  seed: number;
  /** 0 = building body, 1 = antenna/spire, 2 = podium */
  kind: number;
  /** 0..1 position in the accent palette */
  tint: number;
  /** 0..1 share of windows that are lit */
  lit: number;
  /** rooftop beacon intensity */
  glow: number;
}

/** Shared with the ground shader so streets line up with the blocks. */
export const CITY_LAYOUT = {
  blocks: 4,
  pitch: 8.2,
  street: 2.8,
  plaza: 4.2,
};

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIP: Record<Quality, number> = {
  high: 0.04,
  medium: 0.16,
  low: 0.3,
};

/**
 * A block grid with streets instead of a random scatter: every block holds up
 * to four lots, tall towers get a setback and an antenna, and the centre is
 * kept open as a plaza for the blamed file.
 */
export function makeCity(quality: Quality): Tower[] {
  const random = mulberry32(0x6c6f7374);
  const towers: Tower[] = [];
  const { blocks, pitch, street, plaza } = CITY_LAYOUT;
  const half = (blocks - 1) / 2;
  const lot = (pitch - street) / 2;
  const skip = SKIP[quality];
  const detailed = quality !== "low";

  for (let bx = 0; bx < blocks; bx += 1) {
    for (let bz = 0; bz < blocks; bz += 1) {
      const blockX = (bx - half) * pitch;
      const blockZ = (bz - half) * pitch;
      const downtown =
        1 - Math.min(1, Math.hypot(blockX, blockZ) / (half * pitch + 1.5));
      const blockTint = random();

      for (let lx = 0; lx < 2; lx += 1) {
        for (let lz = 0; lz < 2; lz += 1) {
          if (random() < skip) continue;

          const x = blockX + (lx - 0.5) * lot + (random() - 0.5) * 0.26;
          const z = blockZ + (lz - 0.5) * lot + (random() - 0.5) * 0.26;
          if (Math.hypot(x, z) < plaza) continue;

          const width = 1.25 + random() * 0.85;
          const depth = 1.25 + random() * 0.85;
          const cap = 2.1 + downtown * 5.9;
          const height = 1.15 + Math.pow(random(), 1.7) * cap;
          const seed = random();
          const tint = Math.min(1, Math.max(0, blockTint * 0.62 + random() * 0.38));
          const lit = 0.22 + random() * 0.58;
          const health = 0.55 + random() * 0.45;
          const turn = 1 + Math.floor(random() * 7);

          towers.push({
            x,
            z,
            base: 0,
            width,
            depth,
            height,
            turn,
            health,
            flag: 0,
            seed,
            kind: 0,
            tint,
            lit,
            glow: 0,
          });

          // Setback: a slimmer volume stacked on the roof.
          if (detailed && height > 4.3 && random() < 0.55) {
            towers.push({
              x,
              z,
              base: height - 0.12,
              width: width * 0.62,
              depth: depth * 0.62,
              height: 0.7 + random() * 2.1,
              turn,
              health,
              flag: 0,
              seed: seed + 0.13,
              kind: 0,
              tint: Math.min(1, tint + 0.12),
              lit: lit * 0.85,
              glow: 0,
            });
          }

          // Antenna with a small beacon on top.
          if (detailed && height > 6.1 && random() < 0.5) {
            towers.push({
              x,
              z,
              base: height,
              width: 0.1,
              depth: 0.1,
              height: 1.1 + random() * 1.9,
              turn,
              health,
              flag: 0,
              seed: seed + 0.31,
              kind: 1,
              tint,
              lit: 0,
              glow: 0.6 + random() * 0.4,
            });
          }

          // Podium / awning at street level.
          if (height > 5.0 && random() < 0.28) {
            towers.push({
              x,
              z,
              base: 0,
              width: width * 1.38,
              depth: depth * 1.38,
              height: 0.5,
              turn,
              health,
              flag: 0,
              seed: seed + 0.47,
              kind: 2,
              tint: Math.min(1, tint + 0.2),
              lit: 0.3,
              glow: 0,
            });
          }
        }
      }
    }
  }

  // The blamed file: tall, central, clearly turn 4.
  const flagSeed = 0.42;
  towers.push({
    x: 0.8,
    z: -0.6,
    base: 0,
    width: 1.75,
    depth: 1.55,
    height: 8.6,
    turn: 4,
    health: 0.06,
    flag: 1,
    seed: flagSeed,
    kind: 0,
    tint: 0.08,
    lit: 0.55,
    glow: 0,
  });
  towers.push({
    x: 0.8,
    z: -0.6,
    base: 8.5,
    width: 1.05,
    depth: 0.95,
    height: 1.5,
    turn: 4,
    health: 0.06,
    flag: 1,
    seed: flagSeed + 0.2,
    kind: 0,
    tint: 0.02,
    lit: 0.4,
    glow: 0,
  });
  towers.push({
    x: 0.8,
    z: -0.6,
    base: 10.0,
    width: 0.12,
    depth: 0.12,
    height: 1.9,
    turn: 4,
    health: 0.06,
    flag: 1,
    seed: flagSeed + 0.4,
    kind: 1,
    tint: 0,
    lit: 0,
    glow: 1,
  });

  return towers;
}
