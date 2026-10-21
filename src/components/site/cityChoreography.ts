import * as THREE from "three";

export type Quality = "high" | "medium" | "low";

export interface CameraKey {
  /** page scroll progress this key is anchored to, 0..1 */
  at: number;
  position: [number, number, number];
  target: [number, number, number];
  fog: number;
  /** 0 = full city color, 1 = pulled back and desaturated */
  dim: number;
  accentA: string;
  accentB: string;
  ghost: [number, number, number];
  ghostScale: number;
  ghostOpacity: number;
}

/**
 * One source of truth for the whole landing choreography. Tune the film here,
 * not in the scene graph.
 */
export const CAMERA_KEYS: CameraKey[] = [
  {
    at: 0,
    position: [0, 6.6, 24],
    target: [0, 8.05, -3],
    fog: 0.017,
    dim: 0,
    accentA: "#8b7cff",
    accentB: "#67e8f9",
    ghost: [3.4, 9.15, 1.2],
    ghostScale: 1.25,
    ghostOpacity: 1,
  },
  {
    at: 0.16,
    position: [9.5, 13, 32],
    target: [0, 5.8, -2],
    fog: 0.026,
    dim: 0.36,
    accentA: "#8b7cff",
    accentB: "#9aa3b8",
    ghost: [7, 8.4, -4],
    ghostScale: 0.72,
    ghostOpacity: 0.45,
  },
  {
    at: 0.3,
    position: [-2, 7.4, 18.5],
    target: [1.4, 4.4, 0],
    fog: 0.025,
    dim: 0.12,
    accentA: "#8b7cff",
    accentB: "#67e8f9",
    ghost: [-4.4, 5.6, 2],
    ghostScale: 0.9,
    ghostOpacity: 0.7,
  },
  {
    at: 0.46,
    position: [3.6, 6.4, 13.5],
    target: [2.2, 5.4, 0.8],
    fog: 0.017,
    dim: 0,
    accentA: "#ff7a6b",
    accentB: "#8b7cff",
    ghost: [5.4, 5, 2.6],
    ghostScale: 0.66,
    ghostOpacity: 0.55,
  },
  {
    at: 0.62,
    position: [0.5, 6.1, 12.4],
    target: [1.8, 4.6, 0.4],
    fog: 0.015,
    dim: 0,
    accentA: "#5eead4",
    accentB: "#67e8f9",
    ghost: [2.2, 4.9, 3.4],
    ghostScale: 0.95,
    ghostOpacity: 0.9,
  },
  {
    at: 0.72,
    position: [11, 11.5, 26],
    target: [0, 4.6, 0],
    fog: 0.022,
    dim: 0.5,
    accentA: "#5eead4",
    accentB: "#8b7cff",
    ghost: [4.5, 7.5, 0],
    ghostScale: 0.7,
    ghostOpacity: 0.35,
  },
  {
    at: 0.84,
    position: [-12, 14.5, 30],
    target: [0, 5, 0],
    fog: 0.026,
    dim: 0.68,
    accentA: "#8b7cff",
    accentB: "#9aa3b8",
    ghost: [-5, 8, 0],
    ghostScale: 0.6,
    ghostOpacity: 0.25,
  },
  {
    at: 0.92,
    position: [8.5, 9, 22],
    target: [0, 5.2, -1],
    fog: 0.021,
    dim: 0.18,
    accentA: "#8b7cff",
    accentB: "#67e8f9",
    ghost: [3.4, 6, 1],
    ghostScale: 0.9,
    ghostOpacity: 0.6,
  },
  {
    at: 1,
    position: [0, 5.5, 16.5],
    target: [0, 5.15, -2],
    fog: 0.018,
    dim: 0.05,
    accentA: "#8b7cff",
    accentB: "#67e8f9",
    ghost: [0, 5.05, -0.4],
    ghostScale: 1.15,
    ghostOpacity: 1,
  },
];

interface PreparedKey extends Omit<CameraKey, "accentA" | "accentB"> {
  colorA: THREE.Color;
  colorB: THREE.Color;
}

const PREPARED: PreparedKey[] = CAMERA_KEYS.map((key) => ({
  ...key,
  colorA: new THREE.Color(key.accentA),
  colorB: new THREE.Color(key.accentB),
}));

export interface ChoreographySample {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  fog: number;
  dim: number;
  ghostX: number;
  ghostY: number;
  ghostZ: number;
  ghostScale: number;
  ghostOpacity: number;
  colorA: THREE.Color;
  colorB: THREE.Color;
}

const scratch: ChoreographySample = {
  x: 0,
  y: 8,
  z: 24,
  tx: 0,
  ty: 5,
  tz: 0,
  fog: 0.024,
  dim: 0,
  ghostX: 4,
  ghostY: 6,
  ghostZ: 0,
  ghostScale: 1,
  ghostOpacity: 1,
  colorA: new THREE.Color("#8b7cff"),
  colorB: new THREE.Color("#67e8f9"),
};

function smootherstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Interpolate the film at a given progress. Writes into one scratch object. */
export function sampleChoreography(progress: number): ChoreographySample {
  const p = Math.min(1, Math.max(0, progress));

  let index = 0;
  while (index < PREPARED.length - 2 && p > PREPARED[index + 1].at) {
    index += 1;
  }

  const a = PREPARED[index];
  const b = PREPARED[index + 1] ?? PREPARED[PREPARED.length - 1];
  const span = Math.max(0.0001, b.at - a.at);
  const raw = (p - a.at) / span;
  const t = smootherstep(raw);

  const lerp = (from: number, to: number) => from + (to - from) * t;

  scratch.x = lerp(a.position[0], b.position[0]);
  scratch.y = lerp(a.position[1], b.position[1]);
  scratch.z = lerp(a.position[2], b.position[2]);
  scratch.tx = lerp(a.target[0], b.target[0]);
  scratch.ty = lerp(a.target[1], b.target[1]);
  scratch.tz = lerp(a.target[2], b.target[2]);
  scratch.fog = lerp(a.fog, b.fog);
  scratch.dim = lerp(a.dim, b.dim);
  scratch.ghostX = lerp(a.ghost[0], b.ghost[0]);
  scratch.ghostY = lerp(a.ghost[1], b.ghost[1]);
  scratch.ghostZ = lerp(a.ghost[2], b.ghost[2]);
  scratch.ghostScale = lerp(a.ghostScale, b.ghostScale);
  scratch.ghostOpacity = lerp(a.ghostOpacity, b.ghostOpacity);
  scratch.colorA.copy(a.colorA).lerp(b.colorA, t);
  scratch.colorB.copy(a.colorB).lerp(b.colorB, t);
  return scratch;
}
