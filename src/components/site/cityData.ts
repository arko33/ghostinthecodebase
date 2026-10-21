import type { Quality } from "./cityChoreography";

export interface Tower {
  x: number;
  z: number;
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
}

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

const COUNTS: Record<Quality, { cols: number; rows: number; spacing: number; skip: number }> = {
  high: { cols: 13, rows: 11, spacing: 2.35, skip: 0.08 },
  medium: { cols: 11, rows: 9, spacing: 2.55, skip: 0.12 },
  low: { cols: 9, rows: 7, spacing: 2.8, skip: 0.16 },
};

/**
 * Towers are laid out on a jittered grid. Height encodes file churn; turn
 * encodes when the file appeared; the flagged tower is the leak introduced by
 * turn 4 in src/store/invoices.ts.
 */
export function makeCity(quality: Quality): Tower[] {
  const config = COUNTS[quality];
  const random = mulberry32(0x6c6f7374);
  const towers: Tower[] = [];

  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      if (random() < config.skip) continue;

      const x =
        (col - (config.cols - 1) / 2) * config.spacing +
        (random() - 0.5) * 0.9;
      const z =
        (row - (config.rows - 1) / 2) * config.spacing * 0.92 +
        (random() - 0.5) * 0.9 -
        1.5;

      if (Math.abs(x) < 1.15 && Math.abs(z) < 1.15) continue;

      const height = 0.9 + Math.pow(random(), 2.1) * 7.4;
      const width = 0.52 + random() * 0.62;
      const depth = 0.52 + random() * 0.62;
      const turn = 1 + Math.floor(random() * 7);
      const health = 0.55 + random() * 0.45;

      towers.push({
        x,
        z,
        width,
        depth,
        height,
        turn,
        health,
        flag: 0,
        seed: random(),
      });
    }
  }

  // The blamed file: tall, central, and clearly turn 4.
  towers.push({
    x: 2.15,
    z: 0.35,
    width: 1.05,
    depth: 0.95,
    height: 8.7,
    turn: 4,
    health: 0.08,
    flag: 1,
    seed: 0.42,
  });

  // A short foreground cluster so the city has depth near the camera.
  const foreground: Array<[number, number, number]> = [
    [-4.6, 5.4, 1.8],
    [-2.4, 6.6, 2.6],
    [0.4, 6.2, 1.3],
    [3.9, 5.6, 2.1],
    [6.4, 4.9, 1.6],
  ];
  foreground.forEach(([x, z, height], index) => {
    towers.push({
      x,
      z,
      width: 0.75 + (index % 3) * 0.12,
      depth: 0.72,
      height,
      turn: 1 + (index % 7),
      health: 0.82,
      flag: 0,
      seed: 0.11 + index * 0.17,
    });
  });

  return towers;
}
