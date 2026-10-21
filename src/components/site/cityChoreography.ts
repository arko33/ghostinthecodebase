import * as THREE from "three";

export type Quality = "high" | "medium" | "low";

export interface CameraKey {
  /** page scroll progress this key is anchored to, 0..1 */
  at: number;
  /** orbit angle around the city, radians — monotonically increasing */
  angle: number;
  radius: number;
  height: number;
  targetY: number;
  fog: number;
  /** 0 = full city color, 1 = pulled back and desaturated */
  dim: number;
  fov: number;
  /** subtle camera roll, radians */
  roll: number;
  accentA: string;
  accentB: string;
  accentC: string;
  ghostAngle: number;
  ghostRadius: number;
  ghostHeight: number;
  ghostScale: number;
  ghostOpacity: number;
}

/**
 * One source of truth for the whole landing choreography. The camera walks a
 * full circle around the city as you scroll; every value is interpolated with
 * a Catmull-Rom spline so the move never snaps between keys.
 */
export const CAMERA_KEYS: CameraKey[] = [
  {
    at: 0,
    angle: 0.12,
    radius: 22.6,
    height: 7.1,
    targetY: 6.1,
    fog: 0.0135,
    dim: 0,
    fov: 42,
    roll: 0,
    accentA: "#1f5f4b",
    accentB: "#8fe6c2",
    accentC: "#357f70",
    ghostAngle: 1.3,
    ghostRadius: 7.4,
    ghostHeight: 9.8,
    ghostScale: 1.45,
    ghostOpacity: 0.85,
  },
  {
    at: 0.12,
    angle: 0.55,
    radius: 20.4,
    height: 8.1,
    targetY: 5.4,
    fog: 0.017,
    dim: 0.08,
    fov: 43,
    roll: 0.018,
    accentA: "#1a5142",
    accentB: "#7fd6b4",
    accentC: "#2f7365",
    ghostAngle: 1.7,
    ghostRadius: 7.4,
    ghostHeight: 9.8,
    ghostScale: 1.4,
    ghostOpacity: 0.72,
  },
  {
    at: 0.24,
    angle: 1.15,
    radius: 19.1,
    height: 6.4,
    targetY: 4.8,
    fog: 0.0205,
    dim: 0.18,
    fov: 41,
    roll: 0.028,
    accentA: "#17463a",
    accentB: "#6fc4a6",
    accentC: "#2a6559",
    ghostAngle: 2.0,
    ghostRadius: 7.2,
    ghostHeight: 8.0,
    ghostScale: 1.5,
    ghostOpacity: 0.68,
  },
  {
    at: 0.36,
    angle: 1.8,
    radius: 17.6,
    height: 5.2,
    targetY: 4.2,
    fog: 0.0145,
    dim: 0.02,
    fov: 39,
    roll: 0,
    accentA: "#1d5a47",
    accentB: "#86e0bd",
    accentC: "#337a6b",
    ghostAngle: 2.7,
    ghostRadius: 6.4,
    ghostHeight: 5.8,
    ghostScale: 0.95,
    ghostOpacity: 0.8,
  },
  {
    at: 0.48,
    angle: 2.45,
    radius: 16.9,
    height: 4.9,
    targetY: 4.0,
    fog: 0.0125,
    dim: 0,
    fov: 38,
    roll: -0.018,
    accentA: "#256b53",
    accentB: "#9af0cc",
    accentC: "#3d8d7b",
    ghostAngle: 3.3,
    ghostRadius: 6.2,
    ghostHeight: 5.6,
    ghostScale: 0.9,
    ghostOpacity: 0.9,
  },
  {
    at: 0.6,
    angle: 3.1,
    radius: 18.1,
    height: 6.3,
    targetY: 4.4,
    fog: 0.0165,
    dim: 0.06,
    fov: 40,
    roll: -0.026,
    accentA: "#1e5b49",
    accentB: "#86e0bd",
    accentC: "#357f70",
    ghostAngle: 3.9,
    ghostRadius: 6.6,
    ghostHeight: 6.0,
    ghostScale: 0.95,
    ghostOpacity: 0.78,
  },
  {
    at: 0.72,
    angle: 3.85,
    radius: 21.2,
    height: 8.7,
    targetY: 5.0,
    fog: 0.0205,
    dim: 0.28,
    fov: 42,
    roll: -0.014,
    accentA: "#174438",
    accentB: "#6aa898",
    accentC: "#2a5f55",
    ghostAngle: 4.6,
    ghostRadius: 7.4,
    ghostHeight: 8.8,
    ghostScale: 1.4,
    ghostOpacity: 0.45,
  },
  {
    at: 0.84,
    angle: 4.65,
    radius: 25.2,
    height: 11.1,
    targetY: 5.2,
    fog: 0.024,
    dim: 0.45,
    fov: 44,
    roll: 0.016,
    accentA: "#123a30",
    accentB: "#5e9184",
    accentC: "#244f47",
    ghostAngle: 5.2,
    ghostRadius: 8.2,
    ghostHeight: 10.0,
    ghostScale: 1.3,
    ghostOpacity: 0.3,
  },
  {
    at: 0.93,
    angle: 5.45,
    radius: 23.0,
    height: 8.9,
    targetY: 5.6,
    fog: 0.0185,
    dim: 0.14,
    fov: 42,
    roll: 0.024,
    accentA: "#1a5042",
    accentB: "#78c9ab",
    accentC: "#2f7365",
    ghostAngle: 6.05,
    ghostRadius: 8.0,
    ghostHeight: 9.4,
    ghostScale: 1.4,
    ghostOpacity: 0.65,
  },
  {
    at: 1,
    angle: 6.283185307179586,
    radius: 22.6,
    height: 7.1,
    targetY: 6.1,
    fog: 0.0135,
    dim: 0,
    fov: 42,
    roll: 0,
    accentA: "#1f5f4b",
    accentB: "#8fe6c2",
    accentC: "#357f70",
    ghostAngle: 7.85,
    ghostRadius: 9.0,
    ghostHeight: 10.6,
    ghostScale: 1.4,
    ghostOpacity: 0.85,
  },
];

interface PreparedKey extends Omit<CameraKey, "accentA" | "accentB" | "accentC"> {
  colorA: THREE.Color;
  colorB: THREE.Color;
  colorC: THREE.Color;
}

const PREPARED: PreparedKey[] = CAMERA_KEYS.map((key) => ({
  ...key,
  colorA: new THREE.Color(key.accentA),
  colorB: new THREE.Color(key.accentB),
  colorC: new THREE.Color(key.accentC),
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
  fov: number;
  roll: number;
  ghostX: number;
  ghostY: number;
  ghostZ: number;
  ghostScale: number;
  ghostOpacity: number;
  colorA: THREE.Color;
  colorB: THREE.Color;
  colorC: THREE.Color;
}

const scratch: ChoreographySample = {
  x: 0,
  y: 7,
  z: 22.6,
  tx: 0,
  ty: 6,
  tz: 0,
  fog: 0.014,
  dim: 0,
  fov: 42,
  roll: 0,
  ghostX: 5,
  ghostY: 8.6,
  ghostZ: 4,
  ghostScale: 1.7,
  ghostOpacity: 0.85,
  colorA: new THREE.Color("#1f5f4b"),
  colorB: new THREE.Color("#8fe6c2"),
  colorC: new THREE.Color("#357f70"),
};

function smootherstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Interpolate the film at a given progress. Writes into one scratch object. */
export function sampleChoreography(progress: number): ChoreographySample {
  const p = Math.min(1, Math.max(0, progress));

  let index = 0;
  while (index < PREPARED.length - 2 && p > PREPARED[index + 1].at) {
    index += 1;
  }

  const k0 = PREPARED[Math.max(0, index - 1)];
  const k1 = PREPARED[index];
  const k2 = PREPARED[Math.min(PREPARED.length - 1, index + 1)];
  const k3 = PREPARED[Math.min(PREPARED.length - 1, index + 2)];

  const span = Math.max(0.0001, k2.at - k1.at);
  const t = Math.min(1, Math.max(0, (p - k1.at) / span));
  const ease = smootherstep(t);

  const spline = (pick: (key: PreparedKey) => number) =>
    catmull(pick(k0), pick(k1), pick(k2), pick(k3), t);
  const blend = (from: number, to: number) => from + (to - from) * ease;

  const angle = spline((key) => key.angle);
  const radius = Math.max(12, spline((key) => key.radius));

  scratch.x = Math.sin(angle) * radius;
  scratch.z = Math.cos(angle) * radius;
  scratch.y = spline((key) => key.height);
  scratch.ty = spline((key) => key.targetY);
  scratch.tx = Math.sin(angle * 0.7 + 0.8) * 1.1;
  scratch.tz = Math.cos(angle * 0.55 + 0.3) * 1.4;

  scratch.fog = spline((key) => key.fog);
  scratch.dim = spline((key) => key.dim);
  scratch.fov = spline((key) => key.fov);
  scratch.roll = spline((key) => key.roll);

  const ghostAngle = spline((key) => key.ghostAngle);
  const ghostRadius = spline((key) => key.ghostRadius);
  scratch.ghostX = Math.sin(ghostAngle) * ghostRadius;
  scratch.ghostZ = Math.cos(ghostAngle) * ghostRadius;
  scratch.ghostY = spline((key) => key.ghostHeight);
  scratch.ghostScale = blend(k1.ghostScale, k2.ghostScale);
  scratch.ghostOpacity = blend(k1.ghostOpacity, k2.ghostOpacity);

  scratch.colorA.copy(k1.colorA).lerp(k2.colorA, ease);
  scratch.colorB.copy(k1.colorB).lerp(k2.colorB, ease);
  scratch.colorC.copy(k1.colorC).lerp(k2.colorC, ease);

  return scratch;
}
