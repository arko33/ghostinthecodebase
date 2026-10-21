"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sampleChoreography, type Quality } from "./cityChoreography";
import { CITY_LAYOUT, makeCity, type Tower } from "./cityData";
import type { ScrollSignals } from "./scroll";

interface Props {
  signals: MutableRefObject<ScrollSignals>;
  active: boolean;
  quality: Quality;
  reduced: boolean;
  onReady: () => void;
  onPerformanceDrop: () => void;
}

type Uniforms = Record<string, THREE.IUniform>;

const QUALITY_DPR: Record<Quality, [number, number]> = {
  high: [1, 1.5],
  medium: [1, 1.25],
  low: [0.75, 1],
};

const FOG_COLOR = "#040a08";

/* -------------------------------------------------------------------------- */
/* Towers                                                                      */
/* -------------------------------------------------------------------------- */

const TOWER_VERTEX = /* glsl */ `
  uniform float uReveal;
  attribute float aSeed;
  attribute float aHealth;
  attribute float aTurn;
  attribute float aFlag;
  attribute float aKind;
  attribute float aTint;
  attribute float aLit;
  attribute float aGlow;

  varying float vSeed;
  varying float vHealth;
  varying float vFlag;
  varying float vFogDepth;
  varying float vKind;
  varying float vTint;
  varying float vLit;
  varying float vGlow;
  varying vec3 vNormalL;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vScale;

  void main() {
    vSeed = aSeed;
    vHealth = aHealth;
    vFlag = aFlag;
    vKind = aKind;
    vTint = aTint;
    vLit = aLit;
    vGlow = aGlow;
    vLocal = position;
    vNormalL = normal;

    float rise = smoothstep(aTurn - 1.15, aTurn - 0.05, uReveal);
    vec3 p = position;
    p.y *= mix(0.001, 1.0, rise);

    vScale = vec3(
      length(instanceMatrix[0].xyz),
      length(instanceMatrix[1].xyz),
      length(instanceMatrix[2].xyz)
    );

    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vec4 view = viewMatrix * world;

    vWorld = world.xyz;
    vFogDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const TOWER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uAnomaly;
  uniform float uRewind;
  uniform float uDim;
  uniform vec3 uAccentA;
  uniform vec3 uAccentB;
  uniform vec3 uAccentC;
  uniform vec3 uAnomalyColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying float vSeed;
  varying float vHealth;
  varying float vFlag;
  varying float vFogDepth;
  varying float vKind;
  varying float vTint;
  varying float vLit;
  varying float vGlow;
  varying vec3 vNormalL;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vScale;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 n = normalize(vNormalL);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float facing = clamp(abs(dot(n, viewDir)), 0.0, 1.0);
    float fres = pow(1.0 - facing, 2.6);

    float up = clamp(vLocal.y, 0.0, 1.0);
    vec3 color = vec3(0.02, 0.03, 0.026);

    if (n.y > 0.55) {
      /* Roof: dark slab with a faint lit parapet. */
      float edge = min(
        min(vLocal.x + 0.5, 0.5 - vLocal.x),
        min(vLocal.z + 0.5, 0.5 - vLocal.z)
      );
      float rim = 1.0 - smoothstep(0.0, 0.085, edge);
      color = mix(vec3(0.016, 0.026, 0.023), uAccentA * 0.32, 0.4 + vTint * 0.4);
      color += uAccentB * rim * 0.085;
      color += uAccentB * 0.014 * hash21(floor(vLocal.xz * 24.0 + vSeed * 12.0));
    } else if (n.y < -0.55) {
      color = vec3(0.01, 0.016, 0.014);
    } else {
      float face = 0.0;
      vec2 uv;
      if (abs(n.x) > 0.5) {
        uv = vec2(vLocal.z * vScale.z, vLocal.y * vScale.y);
        face = n.x > 0.0 ? 1.0 : 2.0;
      } else {
        uv = vec2(vLocal.x * vScale.x, vLocal.y * vScale.y);
        face = n.z > 0.0 ? 3.0 : 4.0;
      }

      /* Window grid in metres so every building reads at the same scale. */
      float cellW = 0.7;
      float floorH = 0.8;
      vec2 g = vec2(uv.x / cellW, uv.y / floorH);
      vec2 cell = floor(g);
      vec2 f = fract(g);

      float win = smoothstep(0.17, 0.25, f.x) * (1.0 - smoothstep(0.75, 0.83, f.x));
      win *= smoothstep(0.2, 0.3, f.y) * (1.0 - smoothstep(0.72, 0.82, f.y));

      /* Ground floor reads as a taller storefront. */
      float ground = 1.0 - smoothstep(0.72, 1.05, uv.y);
      vec2 gf = fract(vec2(uv.x / 1.15, uv.y / 1.05));
      float store = smoothstep(0.05, 0.12, gf.x) * (1.0 - smoothstep(0.88, 0.95, gf.x));
      store *= smoothstep(0.14, 0.22, gf.y) * (1.0 - smoothstep(0.66, 0.76, gf.y));
      win = mix(win, store, ground * 0.9);

      float h1 = hash21(cell + vec2(face * 37.1, vSeed * 113.0));
      float h2 = hash21(cell.yx + vec2(vSeed * 71.0, face * 13.7));
      float floorSeed = hash21(vec2(cell.y, face + vSeed * 9.0));

      float litChance = 0.14 + vLit * 0.62;
      float on = step(1.0 - litChance, h1) * step(0.16, floorSeed);

      float warmth = step(0.74, h2);
      vec3 winCol = mix(uAccentB, vec3(1.0, 0.83, 0.58), warmth);
      winCol = mix(winCol, vec3(0.8, 0.95, 1.0), step(0.93, h2) * 0.7);

      float flicker = 0.9 + 0.1 * sin(uTime * (0.35 + h1 * 1.4) + h1 * 42.0);
      float level = mix(0.26, 1.0, h2) * flicker;

      vec3 glass = mix(vec3(0.05, 0.075, 0.066), uAccentA * 0.85, 0.22 + vTint * 0.5);
      vec3 stone = mix(vec3(0.075, 0.088, 0.08), uAccentC * 0.55, vTint);
      vec3 body = mix(stone, glass, 0.58);

      if (vKind > 0.5) body = vec3(0.022, 0.03, 0.027);
      if (vKind > 1.5) body *= 0.82;

      // A few blocks are warmer so the skyline is not one flat green.
      body = mix(body, vec3(0.11, 0.095, 0.075), smoothstep(0.72, 1.0, vTint) * 0.28);

      vec3 L1 = normalize(vec3(0.78, 0.52, 0.36));
      vec3 L2 = normalize(vec3(-0.6, 0.24, -0.72));
      float d1 = max(dot(n, L1), 0.0);
      float d2 = max(dot(n, L2), 0.0);
      float ao = mix(0.55, 1.0, smoothstep(0.0, 0.4, up));

      color = body * (0.4 + d1 * 1.04 + d2 * 0.32) * ao;
      color += uAccentA * up * 0.09 * d1;
      color += uAccentB * pow(up, 2.4) * 0.025;
      color += uAccentC * 0.012 * (1.0 - up);

      color += winCol * win * on * level * (0.42 + 0.46 * up);
      color += uAccentB * win * 0.02;
      color *= 1.0 - 0.3 * smoothstep(0.9, 0.99, f.y);

      // Lit crown at the top of every tower.
      float crown = smoothstep(0.9, 0.995, up);
      color += uAccentB * crown * (0.035 + vGlow * 0.08);

      /* Rooftop beacons (antennas, spires). */
      float beacon = vGlow * smoothstep(0.84, 1.0, vLocal.y);
      beacon *= 0.55 + 0.45 * sin(uTime * 2.1 + vSeed * 30.0);
      color += vec3(1.0, 0.4, 0.3) * beacon * 0.5;

      /* The blamed file glows during the anomaly beat. */
      float hot = clamp(uAnomaly * vFlag, 0.0, 1.0);
      float pulse = 0.62 + 0.38 * sin(uTime * 3.1);
      color = mix(color, uAnomalyColor * pulse * (0.35 + 0.65 * up), hot * 0.8);
      color += uAnomalyColor * hot * fres * 0.22;
    }

    float rewindBand = smoothstep(0.86, 1.0, sin(vWorld.y * 2.2 - uTime * 6.0)) * uRewind;
    color = mix(color, vec3(0.58, 0.94, 0.84), rewindBand * 0.32);

    color += uAccentB * fres * 0.07 * vHealth;

    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));
    color *= 1.0 - uDim * 0.42;

    color += (hash21(gl_FragCoord.xy * 0.7) - 0.5) * 0.004;

    gl_FragColor = vec4(max(color, 0.0), 1.0);
  }
`;

function TowerField({
  towers,
  uniforms,
}: {
  towers: Tower[];
  uniforms: Uniforms;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);

    const count = towers.length;
    const seeds = new Float32Array(count);
    const health = new Float32Array(count);
    const turns = new Float32Array(count);
    const flags = new Float32Array(count);
    const kinds = new Float32Array(count);
    const tints = new Float32Array(count);
    const lit = new Float32Array(count);
    const glow = new Float32Array(count);

    towers.forEach((tower, index) => {
      seeds[index] = tower.seed;
      health[index] = tower.health;
      turns[index] = tower.turn;
      flags[index] = tower.flag;
      kinds[index] = tower.kind;
      tints[index] = tower.tint;
      lit[index] = tower.lit;
      glow[index] = tower.glow;
    });

    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute("aHealth", new THREE.InstancedBufferAttribute(health, 1));
    geo.setAttribute("aTurn", new THREE.InstancedBufferAttribute(turns, 1));
    geo.setAttribute("aFlag", new THREE.InstancedBufferAttribute(flags, 1));
    geo.setAttribute("aKind", new THREE.InstancedBufferAttribute(kinds, 1));
    geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tints, 1));
    geo.setAttribute("aLit", new THREE.InstancedBufferAttribute(lit, 1));
    geo.setAttribute("aGlow", new THREE.InstancedBufferAttribute(glow, 1));
    return geo;
  }, [towers]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: TOWER_VERTEX,
        fragmentShader: TOWER_FRAGMENT,
        uniforms,
      }),
    [uniforms],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    towers.forEach((tower, index) => {
      position.set(tower.x, tower.base, tower.z);
      scale.set(tower.width, tower.height, tower.depth);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [towers]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, towers.length]}
      frustumCulled={false}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Rooftop beacons                                                             */
/* -------------------------------------------------------------------------- */

const HALO_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (150.0 / max(1.0, -view.z));
    gl_Position = projectionMatrix * view;
    vColor = aColor;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float alpha = pow(max(0.0, 1.0 - d), 3.0) * 0.4;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function TowerHalos({ towers }: { towers: Tower[] }) {
  const beacons = useMemo(
    () =>
      towers.filter(
        (tower) => tower.kind === 1 && (tower.glow > 0.05 || tower.flag === 1),
      ),
    [towers],
  );

  const geometry = useMemo(() => {
    const positions = new Float32Array(beacons.length * 3);
    const sizes = new Float32Array(beacons.length);
    const colors = new Float32Array(beacons.length * 3);
    const mint = new THREE.Color("#9af0cc");
    const coral = new THREE.Color("#ff8f7d");

    beacons.forEach((tower, index) => {
      positions[index * 3] = tower.x;
      positions[index * 3 + 1] = tower.base + tower.height + 0.06;
      positions[index * 3 + 2] = tower.z;
      sizes[index] = 2.4 + tower.glow * 2.6;
      const color = tower.flag === 1 ? coral : mint;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [beacons]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (!beacons.length) return null;

  return (
    <points>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* Light shafts + ground pools                                                 */
/* -------------------------------------------------------------------------- */

const BEAM_VERTEX = /* glsl */ `
  attribute float aSeed;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vSeed;

  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vSeed;

  void main() {
    float core = pow(
      clamp(abs(dot(normalize(vNormalW), normalize(vViewDir))), 0.0, 1.0),
      1.8
    );
    float fade = pow(1.0 - clamp(vUv.y, 0.0, 1.0), 1.7);
    float pulse = 0.82 + 0.18 * sin(uTime * 0.9 + vSeed * 18.0);
    float alpha = core * fade * uOpacity * pulse;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

/** Thin cones of green light rising off the tallest roofs. */
function LightBeams({ towers, quality }: { towers: Tower[]; quality: Quality }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const beams = useMemo(() => {
    const limit = quality === "high" ? 16 : quality === "medium" ? 10 : 6;
    return towers
      .filter((tower) => tower.kind === 0 && tower.height > 5.2)
      .sort((a, b) => b.height - a.height)
      .slice(0, limit);
  }, [towers, quality]);

  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.55, 0.12, 1, 10, 1, true);
    geo.translate(0, 0.5, 0);
    const seeds = new Float32Array(beams.length);
    beams.forEach((tower, index) => {
      seeds[index] = tower.seed;
    });
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    return geo;
  }, [beams]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEAM_VERTEX,
        fragmentShader: BEAM_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color("#8fe6c2") },
          uOpacity: { value: 0.26 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    beams.forEach((tower, index) => {
      const height = 4.5 + tower.seed * 8.5;
      position.set(tower.x, tower.base + tower.height + 0.04, tower.z);
      scale.set(0.7 + tower.seed * 0.5, height, 0.7 + tower.seed * 0.5);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [beams]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (!beams.length) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, beams.length]}
      frustumCulled={false}
    />
  );
}

const POOL_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const POOL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float alpha = pow(max(0.0, 1.0 - d), 2.6) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/** Soft pools of light on the ground around the taller blocks. */
function BaseGlows({ towers }: { towers: Tower[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glows = useMemo(
    () =>
      towers
        .filter((tower) => tower.kind === 0 && tower.height > 4.2)
        .slice(0, 28),
    [towers],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: POOL_VERTEX,
        fragmentShader: POOL_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color("#7fdcb8") },
          uOpacity: { value: 0.2 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    glows.forEach((tower, index) => {
      position.set(tower.x, 0.035, tower.z);
      const spread = 2.1 + tower.seed * 1.6;
      scale.set(tower.width * spread, 1, tower.depth * spread);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [glows]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (!glows.length) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, glows.length]}
      frustumCulled={false}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Ground                                                                      */
/* -------------------------------------------------------------------------- */

const GROUND_VERTEX = /* glsl */ `
  varying vec3 vWorld;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GROUND_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uAccentA;
  uniform vec3 uAccentB;
  uniform vec3 uFogColor;
  uniform float uDim;
  uniform float uPitch;
  uniform float uStreet;

  varying vec3 vWorld;

  void main() {
    vec2 p = vWorld.xz;

    float halfPitch = uPitch * 0.5;
    vec2 q = abs(mod(p + halfPitch, uPitch) - halfPitch);
    float roadDist = min(q.x, q.y);
    float road = 1.0 - smoothstep(uStreet * 0.38, uStreet * 0.54, roadDist);
    float curb = smoothstep(uStreet * 0.36, uStreet * 0.5, roadDist) * road;

    float d = length(p);
    float fade = 1.0 - smoothstep(18.0, 46.0, d);
    float core = exp(-d * 0.115);
    float plaza = exp(-d * 0.85);

    vec3 color = uFogColor;
    color += uAccentA * core * 0.42;
    color += uAccentA * road * 0.09;
    color += uAccentB * curb * 0.08;
    color += uAccentB * plaza * 0.24;
    color += uAccentB * 0.025 * sin(uTime * 0.5 + d * 0.4);

    float alpha = (road * 0.18 + curb * 0.26 + core * 0.16 + plaza * 0.32) * fade;
    color *= 1.0 - uDim * 0.45;

    gl_FragColor = vec4(color, alpha);
  }
`;

function Ground({ uniforms }: { uniforms: Uniforms }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GROUND_VERTEX,
        fragmentShader: GROUND_FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
      }),
    [uniforms],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[160, 160, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */
/* Ghost                                                                       */
/* -------------------------------------------------------------------------- */

const GHOST_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAgitation;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying vec3 vLocal;

  void main() {
    vec3 p = position;
    float sway = 1.0 + uAgitation * 2.2;

    float wobble =
      (sin(p.y * 3.4 + uTime * 1.5) * 0.013 +
        sin(p.x * 4.6 - uTime * 1.1) * 0.009 +
        sin(p.z * 4.2 + uTime * 0.9) * 0.009) * sway;

    float hem = smoothstep(-0.25, -1.0, p.y);
    p += normal * (wobble + hem * sin(p.x * 6.0 + uTime * 2.2) * 0.02);
    p.x += hem * sin(uTime * 0.9 + p.y * 2.0) * 0.02;

    vec4 world = modelMatrix * vec4(p, 1.0);

    vWorld = world.xyz;
    vLocal = position;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GHOST_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uTint;
  uniform vec3 uRim;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying vec3 vLocal;

  void main() {
    vec3 n = normalize(vNormalW);
    float facing = abs(dot(n, normalize(vViewDir)));
    float fres = pow(1.0 - clamp(facing, 0.0, 1.0), 1.9);

    float hemFade = smoothstep(-1.06, -0.6, vLocal.y);
    float veil = 0.52 + 0.48 * hemFade;
    float grain = 0.93 + 0.07 * sin(vLocal.y * 24.0 - uTime * 1.6 + vLocal.x * 7.0);

    vec3 color = mix(uTint, vec3(1.0), 0.35 + fres * 0.65);
    color += uRim * fres * 0.1;

    float alpha = uOpacity * (0.15 + fres * 0.4) * veil * grain;
    alpha *= mix(0.32, 1.0, hemFade);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.78));
  }
`;

const GHOST_HALO_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GHOST_HALO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float alpha = pow(max(0.0, 1.0 - d), 2.8) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const TRAIL_VERTEX = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (90.0 / max(1.0, -view.z));
    gl_Position = projectionMatrix * view;
    vAlpha = aAlpha;
  }
`;

const TRAIL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float alpha = pow(max(0.0, 1.0 - d), 2.2) * vAlpha * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/** Rounded head, tapered body and a four-lobed wavy hem. */
function makeGhostGeometry() {
  const SEG = 64;
  const RINGS = 56;
  const headBase = 0.18;
  const headRadius = 0.6;
  const bottom = -0.98;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= RINGS; i += 1) {
    const v = i / RINGS;
    let y: number;
    let radius: number;

    if (v < 0.58) {
      const t = v / 0.58;
      y = bottom + t * (headBase - bottom);
      // Matches the head radius at the seam so the silhouette stays smooth.
      radius = headRadius - 0.045 * Math.sin(t * Math.PI);
    } else {
      const t = (v - 0.58) / 0.42;
      const angle = t * Math.PI * 0.5;
      y = headBase + Math.sin(angle) * headRadius;
      radius = headRadius * Math.cos(angle);
    }

    for (let j = 0; j <= SEG; j += 1) {
      const phi = (j / SEG) * Math.PI * 2;
      const hem = Math.pow(Math.max(0, 1 - v / 0.3), 1.35);
      const lobe = 0.5 + 0.5 * Math.cos(phi * 5.0);
      const yHem = y - hem * (0.025 + 0.05 * lobe);
      const rHem = radius * (1 - hem * 0.03);
      positions.push(Math.cos(phi) * rHem, yHem, Math.sin(phi) * rHem);
    }
  }

  for (let i = 0; i < RINGS; i += 1) {
    for (let j = 0; j < SEG; j += 1) {
      const a = i * (SEG + 1) + j;
      const b = a + SEG + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface GhostFrame {
  x: number;
  y: number;
  z: number;
  scale: number;
  opacity: number;
  /** 0..1 scroll agitation, feeds the wobble and the trail rate */
  agitation: number;
}

const TRAIL_MAX = 96;

function Ghost({
  frame,
  uniforms,
  quality,
}: {
  frame: MutableRefObject<GhostFrame>;
  uniforms: Uniforms;
  quality: Quality;
}) {
  const group = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  const geometry = useMemo(() => makeGhostGeometry(), []);
  const dpr = useThree((state) => state.viewport.dpr);
  const trailCount =
    quality === "high" ? TRAIL_MAX : quality === "medium" ? 64 : 36;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GHOST_VERTEX,
        fragmentShader: GHOST_FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [uniforms],
  );

  const haloMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GHOST_HALO_VERTEX,
        fragmentShader: GHOST_HALO_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color("#d9f7ea") },
          uOpacity: { value: 0.16 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const trail = useMemo(() => {
    const positions = new Float32Array(TRAIL_MAX * 3);
    const alphas = new Float32Array(TRAIL_MAX);
    const sizes = new Float32Array(TRAIL_MAX);
    const velocities = new Float32Array(TRAIL_MAX * 3);
    const ages = new Float32Array(TRAIL_MAX).fill(99);
    const lives = new Float32Array(TRAIL_MAX).fill(1);

    const trailGeometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    const alphaAttribute = new THREE.BufferAttribute(alphas, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    const sizeAttribute = new THREE.BufferAttribute(sizes, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    trailGeometry.setAttribute("position", positionAttribute);
    trailGeometry.setAttribute("aAlpha", alphaAttribute);
    trailGeometry.setAttribute("aSize", sizeAttribute);

    const trailMaterial = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERTEX,
      fragmentShader: TRAIL_FRAGMENT,
      uniforms: {
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color("#e8fff5") },
        uOpacity: { value: 0.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      geometry: trailGeometry,
      material: trailMaterial,
      positions,
      alphas,
      sizes,
      velocities,
      ages,
      lives,
      positionAttribute,
      alphaAttribute,
      sizeAttribute,
      head: 0,
      emit: 0,
    };
  }, []);

  useEffect(() => {
    trail.geometry.setDrawRange(0, trailCount);
  }, [trail, trailCount]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      haloMaterial.dispose();
      trail.geometry.dispose();
      trail.material.dispose();
    };
  }, [geometry, material, haloMaterial, trail]);

  useFrame((state, delta) => {
    const node = group.current;
    if (!node) return;

    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const damp = 1 - Math.exp(-dt * 1.9);
    const current = frame.current;

    target.set(
      current.x + Math.sin(t * 0.42) * 0.34,
      current.y + Math.sin(t * 0.78) * 0.2,
      current.z + Math.cos(t * 0.36) * 0.3,
    );

    node.position.lerp(target, damp);
    node.scale.setScalar(
      THREE.MathUtils.lerp(node.scale.x, current.scale, damp),
    );

    // Always face the camera, then add a little weight shift.
    node.lookAt(state.camera.position.x, node.position.y, state.camera.position.z);
    node.rotateZ(Math.sin(t * 0.55) * 0.05);
    node.rotateX(Math.sin(t * 0.4) * 0.03);

    const blinkCycle = t % 4.6;
    const blink =
      blinkCycle < 0.16
        ? 1 - Math.sin((blinkCycle / 0.16) * Math.PI)
        : 1;
    if (eyes.current) {
      eyes.current.scale.y = Math.max(0.08, blink);
    }

    uniforms.uTime.value = t;
    uniforms.uAgitation.value = current.agitation;
    uniforms.uOpacity.value = THREE.MathUtils.lerp(
      uniforms.uOpacity.value as number,
      current.opacity,
      1 - Math.exp(-dt * 2.2),
    );

    const opacity = uniforms.uOpacity.value as number;

    if (halo.current) {
      halo.current.position.copy(node.position);
      halo.current.quaternion.copy(state.camera.quaternion);
      const size = node.scale.x * 2.9;
      halo.current.scale.set(size, size, 1);
      haloMaterial.uniforms.uOpacity.value = opacity * 0.2;
    }

    trail.material.uniforms.uPixelRatio.value = dpr;
    trail.material.uniforms.uOpacity.value = 0.14 + opacity * 0.4;

    trail.emit += (9 + current.agitation * 44 + current.scale * 3) * dt;
    while (trail.emit >= 1) {
      trail.emit -= 1;
      const index = trail.head % trailCount;
      trail.head = (trail.head + 1) % trailCount;
      const spread = 0.62 * current.scale;
      trail.positions[index * 3] =
        node.position.x + (Math.random() - 0.5) * spread;
      trail.positions[index * 3 + 1] =
        node.position.y - current.scale * 0.62 + Math.random() * 0.24;
      trail.positions[index * 3 + 2] =
        node.position.z + (Math.random() - 0.5) * spread;
      trail.velocities[index * 3] = (Math.random() - 0.5) * 0.18;
      trail.velocities[index * 3 + 1] = 0.12 + Math.random() * 0.2;
      trail.velocities[index * 3 + 2] = (Math.random() - 0.5) * 0.18;
      trail.ages[index] = 0;
      trail.lives[index] = 1 + Math.random() * 1.2;
      trail.sizes[index] = 0.9 + Math.random() * 1.4;
    }

    const drag = Math.pow(0.4, dt);
    for (let index = 0; index < trailCount; index += 1) {
      const age = trail.ages[index] + dt;
      trail.ages[index] = age;
      if (age >= trail.lives[index]) {
        trail.alphas[index] = 0;
        continue;
      }
      trail.velocities[index * 3] *= drag;
      trail.velocities[index * 3 + 1] *= drag;
      trail.velocities[index * 3 + 2] *= drag;
      trail.positions[index * 3] += trail.velocities[index * 3] * dt;
      trail.positions[index * 3 + 1] += trail.velocities[index * 3 + 1] * dt;
      trail.positions[index * 3 + 2] += trail.velocities[index * 3 + 2] * dt;
      trail.alphas[index] =
        Math.pow(1 - age / trail.lives[index], 1.7) * opacity;
    }

    trail.positionAttribute.needsUpdate = true;
    trail.alphaAttribute.needsUpdate = true;
    trail.sizeAttribute.needsUpdate = true;
  });

  return (
    <>
      <mesh ref={halo} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <primitive object={haloMaterial} attach="material" />
      </mesh>

      <points frustumCulled={false}>
        <primitive object={trail.geometry} attach="geometry" />
        <primitive object={trail.material} attach="material" />
      </points>

      <group ref={group} position={[frame.current.x, frame.current.y, frame.current.z]}>
        <mesh geometry={geometry}>
          <primitive object={material} attach="material" />
        </mesh>

        <group ref={eyes}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.185, 0.31, 0.505]}>
              <mesh scale={[0.078, 0.108, 0.045]}>
                <sphereGeometry args={[1, 20, 20]} />
                <meshBasicMaterial color="#0d1a16" />
              </mesh>
              <mesh position={[side * 0.018, 0.026, 0.038]} scale={0.021}>
                <sphereGeometry args={[1, 10, 10]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Atmosphere                                                                  */
/* -------------------------------------------------------------------------- */

function Stars({ count }: { count: number }) {
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      values[i * 3] = (Math.random() - 0.5) * 110;
      values[i * 3 + 1] = 16 + Math.random() * 30;
      values[i * 3 + 2] = -16 - Math.random() * 56;
    }
    return values;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#cfe8dc"
        size={0.085}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        fog={false}
      />
    </points>
  );
}

function Dust({ count }: { count: number }) {
  const group = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      values[i * 3] = (Math.random() - 0.5) * 48;
      values[i * 3 + 1] = Math.random() * 16 + 0.4;
      values[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    return values;
  }, [count]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.007;
  });

  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#9dc4b4"
        size={0.032}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </points>
  );
}

function PerfProbe({
  quality,
  onDrop,
}: {
  quality: Quality;
  onDrop: () => void;
}) {
  const frames = useRef(0);
  const since = useRef(0);
  const fired = useRef(false);

  useFrame((_, delta) => {
    if (fired.current || quality === "low") return;
    frames.current += 1;
    since.current += delta;
    if (since.current < 2.4) return;
    const fps = frames.current / since.current;
    if (fps < 38) {
      fired.current = true;
      onDrop();
    } else {
      frames.current = 0;
      since.current = 0;
      fired.current = true;
    }
  });

  return null;
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                       */
/* -------------------------------------------------------------------------- */

function CityScene({
  signals,
  quality,
  reduced,
}: {
  signals: MutableRefObject<ScrollSignals>;
  quality: Quality;
  reduced: boolean;
}) {
  const { camera, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const towers = useMemo(() => makeCity(quality), [quality]);

  const smooth = useRef(0);
  const reveal = useRef(7);
  const initialized = useRef(false);
  const targetLook = useRef(new THREE.Vector3(0, 6, 0));
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const ghostFrame = useRef<GhostFrame>({
    x: 5,
    y: 8.6,
    z: 4,
    scale: 1.7,
    opacity: 0.95,
    agitation: 0,
  });
  const cameraRight = useMemo(() => new THREE.Vector3(), []);
  const cameraUp = useMemo(() => new THREE.Vector3(), []);

  const towerUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 7 },
      uAnomaly: { value: 0 },
      uRewind: { value: 0 },
      uDim: { value: 0 },
      uAccentA: { value: new THREE.Color("#1f5f4b") },
      uAccentB: { value: new THREE.Color("#8fe6c2") },
      uAccentC: { value: new THREE.Color("#357f70") },
      uAnomalyColor: { value: new THREE.Color("#ff7a6b") },
      uFogColor: { value: new THREE.Color(FOG_COLOR) },
      uFogDensity: { value: 0.014 },
    }),
    [],
  );

  const groundUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uAccentA: { value: new THREE.Color("#1f5f4b") },
      uAccentB: { value: new THREE.Color("#8fe6c2") },
      uFogColor: { value: new THREE.Color(FOG_COLOR) },
      uDim: { value: 0 },
      uPitch: { value: CITY_LAYOUT.pitch },
      uStreet: { value: CITY_LAYOUT.street },
    }),
    [],
  );

  const ghostUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.95 },
      uAgitation: { value: 0 },
      uTint: { value: new THREE.Color("#eaf8f1") },
      uRim: { value: new THREE.Color("#8fe6c2") },
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const signal = signals.current;
    const target = reduced ? 0 : signal.page;
    smooth.current += (target - smooth.current) * (1 - Math.exp(-dt * 2.3));

    const key = sampleChoreography(smooth.current);
    const mouseX = reduced ? 0 : signal.mouseX;
    const mouseY = reduced ? 0 : signal.mouseY;

    const driftX = Math.sin(state.clock.elapsedTime * 0.11) * 0.4;
    const driftY = Math.cos(state.clock.elapsedTime * 0.085) * 0.14;

    cameraRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
    cameraUp.set(0, 1, 0).applyQuaternion(cam.quaternion);

    desiredPosition.set(key.x + driftX, key.y + driftY, key.z);
    desiredPosition.addScaledVector(cameraRight, mouseX * 1.15);
    desiredPosition.addScaledVector(cameraUp, mouseY * 0.6);
    desiredTarget.set(key.tx, key.ty, key.tz);
    desiredTarget.addScaledVector(cameraRight, mouseX * 0.28);

    if (!initialized.current) {
      cam.position.copy(desiredPosition);
      targetLook.current.copy(desiredTarget);
      initialized.current = true;
    } else {
      cam.position.lerp(desiredPosition, 1 - Math.exp(-dt * 2.6));
      targetLook.current.lerp(desiredTarget, 1 - Math.exp(-dt * 3.0));
    }

    cam.lookAt(targetLook.current);
    if (!reduced) cam.rotateZ(key.roll);

    const aspect = state.size.width / Math.max(1, state.size.height);
    const aspectBoost = aspect < 0.8 ? 18 : aspect < 1.2 ? 8 : 0;
    const nextFov = THREE.MathUtils.damp(cam.fov, key.fov + aspectBoost, 1.8, dt);
    if (Math.abs(nextFov - cam.fov) > 0.001) {
      cam.fov = nextFov;
      cam.updateProjectionMatrix();
    }

    if (scene.fog) {
      (scene.fog as THREE.FogExp2).density = key.fog;
    }

    const loop = reduced ? 1 : Math.min(1, Math.max(0, signal.loop));
    const revealTarget = loop <= 0.001 ? 7 : Math.min(7, 1 + loop * 6.4);
    reveal.current +=
      (revealTarget - reveal.current) * (1 - Math.exp(-dt * 2.2));
    const anomalyIn = Math.min(1, Math.max(0, (loop - 0.28) / 0.12));
    const anomalyOut = Math.min(1, Math.max(0, (loop - 0.66) / 0.14));
    const rewindIn = Math.min(1, Math.max(0, (loop - 0.64) / 0.08));
    const rewindOut = Math.min(1, Math.max(0, (loop - 0.86) / 0.1));

    towerUniforms.uTime.value = reduced ? 3.4 : state.clock.elapsedTime;
    towerUniforms.uReveal.value = reveal.current;
    towerUniforms.uAnomaly.value = anomalyIn * (1 - anomalyOut);
    towerUniforms.uRewind.value = rewindIn * (1 - rewindOut);
    towerUniforms.uDim.value = key.dim;
    (towerUniforms.uAccentA.value as THREE.Color).copy(key.colorA);
    (towerUniforms.uAccentB.value as THREE.Color).copy(key.colorB);
    (towerUniforms.uAccentC.value as THREE.Color).copy(key.colorC);
    towerUniforms.uFogDensity.value = key.fog;

    groundUniforms.uTime.value = towerUniforms.uTime.value;
    groundUniforms.uDim.value = key.dim;
    (groundUniforms.uAccentA.value as THREE.Color).copy(key.colorA);
    (groundUniforms.uAccentB.value as THREE.Color).copy(key.colorB);

    ghostUniforms.uTime.value = towerUniforms.uTime.value;
    (ghostUniforms.uRim.value as THREE.Color).copy(key.colorB);

    const velocity = Math.min(1, Math.abs(signal.velocity) / 32);
    const ghostX = key.ghostX + mouseX * 0.45;
    const ghostY = key.ghostY + mouseY * 0.3;
    const ghostZ = key.ghostZ;
    const ghostDistance = Math.hypot(
      ghostX - cam.position.x,
      ghostY - cam.position.y,
      ghostZ - cam.position.z,
    );

    ghostFrame.current.x = ghostX;
    ghostFrame.current.y = ghostY;
    ghostFrame.current.z = ghostZ;
    ghostFrame.current.scale =
      THREE.MathUtils.clamp(key.ghostScale * (ghostDistance / 17), 0.75, 1.45) *
      (1 + velocity * 0.08);
    ghostFrame.current.opacity = key.ghostOpacity;
    ghostFrame.current.agitation = reduced ? 0 : velocity;
  });

  return (
    <>
      <fogExp2 attach="fog" args={[FOG_COLOR, 0.014]} />
      <hemisphereLight args={["#a9f0d4", "#04100c", 0.5]} />
      <directionalLight position={[8, 16, 6]} intensity={0.55} color="#ddfff1" />
      <pointLight
        position={[-10, 7, 8]}
        intensity={8}
        distance={44}
        decay={2}
        color="#3fae8b"
      />
      <pointLight
        position={[9, 5, -6]}
        intensity={6}
        distance={38}
        decay={2}
        color="#8fe6c2"
      />

      <TowerField towers={towers} uniforms={towerUniforms} />
      <TowerHalos towers={towers} />
      <LightBeams towers={towers} quality={quality} />
      <BaseGlows towers={towers} />
      <Ground uniforms={groundUniforms} />
      <Stars count={quality === "high" ? 220 : quality === "medium" ? 130 : 70} />
      <Ghost frame={ghostFrame} uniforms={ghostUniforms} quality={quality} />
      <Dust count={quality === "high" ? 520 : quality === "medium" ? 280 : 120} />
    </>
  );
}

export default function GhostCanvas({
  signals,
  active,
  quality,
  reduced,
  onReady,
  onPerformanceDrop,
}: Props) {
  return (
    <Canvas
      dpr={QUALITY_DPR[quality]}
      frameloop={!active ? "never" : reduced ? "demand" : "always"}
      camera={{ position: [0, 7.1, 22.6], fov: 42, near: 0.1, far: 180 }}
      gl={{
        antialias: quality !== "low",
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReady();
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <CityScene signals={signals} quality={quality} reduced={reduced} />
      <PerfProbe quality={quality} onDrop={onPerformanceDrop} />
    </Canvas>
  );
}
