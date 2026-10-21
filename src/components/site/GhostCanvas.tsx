"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  sampleChoreography,
  type Quality,
} from "./cityChoreography";
import { makeCity, type Tower } from "./cityData";
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

const FOG_COLOR = "#05060a";

const TOWER_VERTEX = /* glsl */ `
  uniform float uReveal;
  attribute float aSeed;
  attribute float aHealth;
  attribute float aTurn;
  attribute float aFlag;

  varying float vSeed;
  varying float vHealth;
  varying float vFlag;
  varying float vFogDepth;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    vSeed = aSeed;
    vHealth = aHealth;
    vFlag = aFlag;

    float rise = smoothstep(aTurn - 0.95, aTurn + 0.12, uReveal);
    vec3 p = position;
    p.y *= mix(0.001, 1.0, rise);

    vec4 instancePosition = instanceMatrix * vec4(p, 1.0);
    vec4 world = modelMatrix * instancePosition;
    vec4 view = viewMatrix * world;

    vWorld = world.xyz;
    vFogDepth = -view.z;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);

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
  uniform vec3 uAnomalyColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying float vSeed;
  varying float vHealth;
  varying float vFlag;
  varying float vFogDepth;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying vec3 vLocal;

  void main() {
    float fresnel = pow(
      1.0 - clamp(abs(dot(normalize(vNormalW), normalize(vViewDir))), 0.0, 1.0),
      2.2
    );

    float vertical = clamp(vLocal.y, 0.0, 1.0);
    vec3 base = mix(vec3(0.055, 0.065, 0.1), uAccentA * 0.46, smoothstep(0.0, 1.0, vertical));

    float cellX = fract((vWorld.x + vWorld.z) * 0.62 + vSeed * 17.0);
    float cellY = fract(vWorld.y * 1.35 + vSeed * 9.0);
    float window = step(0.56, cellX) * step(0.46, cellY);
    float flicker = 0.55 + 0.45 * sin(uTime * (0.6 + vSeed * 2.2) + vSeed * 31.0);
    vec3 windowColor = mix(uAccentA, uAccentB, step(0.5, fract(vSeed * 9.0)));
    base += window * windowColor * (0.42 + 0.7 * flicker) * (0.45 + 0.55 * vertical);
    base += windowColor * pow(vertical, 3.2) * 0.12;

    base += 0.04 * sin((vWorld.y - uTime * 0.55) * 9.0);

    float edgeX = smoothstep(0.46, 0.5, abs(vLocal.x));
    float edgeZ = smoothstep(0.46, 0.5, abs(vLocal.z));
    base += (edgeX + edgeZ) * 0.018;

    float pulse = 0.5 + 0.5 * sin(uTime * 3.4);
    vec3 hot = uAnomalyColor * (0.65 + 0.35 * pulse);
    float flagGlow = vFlag * (0.32 + 0.16 * sin(uTime * 2.1));
    base = mix(base, hot, clamp(uAnomaly * vFlag * 0.86 + flagGlow, 0.0, 0.9));
    base += uAnomalyColor * vFlag * fresnel * 0.35;

    float rewindBand = smoothstep(0.82, 1.0, sin(vWorld.y * 2.6 - uTime * 7.5)) * uRewind;
    base = mix(base, vec3(0.55, 0.92, 1.0), rewindBand * 0.48);

    vec3 color = base + fresnel * mix(uAccentB, uAccentA, vHealth) * (1.05 + 0.6 * vertical);
    color += fresnel * 0.18;

    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));
    color *= 1.0 - uDim * 0.56;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function TowerField({
  towers,
  uniforms,
}: {
  towers: ReturnType<typeof makeCity>;
  uniforms: Uniforms;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    geo.translate(0, 0.5, 0);

    const count = towers.length;
    const seeds = new Float32Array(count);
    const health = new Float32Array(count);
    const turns = new Float32Array(count);
    const flags = new Float32Array(count);

    towers.forEach((tower: Tower, index: number) => {
      seeds[index] = tower.seed;
      health[index] = tower.health;
      turns[index] = tower.turn;
      flags[index] = tower.flag;
    });

    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute("aHealth", new THREE.InstancedBufferAttribute(health, 1));
    geo.setAttribute("aTurn", new THREE.InstancedBufferAttribute(turns, 1));
    geo.setAttribute("aFlag", new THREE.InstancedBufferAttribute(flags, 1));
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
      position.set(tower.x, 0, tower.z);
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
  uniform vec3 uAccent;
  uniform vec3 uFogColor;
  uniform float uDim;
  varying vec3 vWorld;

  void main() {
    vec2 p = vWorld.xz;

    vec2 cell = fract(p * 0.5);
    vec2 edge = min(cell, 1.0 - cell);
    float line = 1.0 - smoothstep(0.0, 0.035, min(edge.x, edge.y));

    float distanceToCenter = length(p);
    float fade = 1.0 - smoothstep(16.0, 58.0, distanceToCenter);
    float radial = exp(-distanceToCenter * 0.075);

    vec3 color = uFogColor;
    color += uAccent * line * 0.16 * fade;
    color += uAccent * radial * 0.075;

    float pool = exp(-length(p - vec2(2.15, 0.35)) * 1.7) * 0.22;
    pool += exp(-length(p - vec2(-4.6, 5.4)) * 1.4) * 0.08;
    color += uAccent * pool * (0.8 + 0.2 * sin(uTime * 0.7));

    float alpha = (line * 0.28 + radial * 0.11 + pool * 0.5) * fade;
    color *= 1.0 - uDim * 0.5;
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
      <planeGeometry args={[150, 150, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

const GHOST_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying float vNoise;

  void main() {
    vec3 p = position;
    float noise =
      sin(p.x * 2.2 + uTime * 0.7) * 0.5 +
      sin(p.y * 3.1 - uTime * 0.55) * 0.3 +
      sin(p.z * 2.7 + uTime * 0.42) * 0.25;

    p += normal * noise * 0.11;
    vNoise = noise;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GHOST_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uAccentA;
  uniform vec3 uAccentB;
  uniform float uOpacity;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying float vNoise;

  void main() {
    float fresnel = pow(
      1.0 - clamp(abs(dot(normalize(vNormalW), normalize(vViewDir))), 0.0, 1.0),
      1.55
    );
    float scan = 0.5 + 0.5 * sin((vWorld.y + uTime * 0.55) * 6.2);
    vec3 color = mix(uAccentA, uAccentB, scan) * (0.55 + fresnel * 0.9);

    float alpha = (0.12 + fresnel * 0.82) * uOpacity;
    alpha *= 0.8 + 0.2 * sin(uTime * 1.6 + vWorld.y);
    alpha += smoothstep(0.58, 1.0, sin(vWorld.y * 2.8 - uTime * 2.0)) * 0.1 * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

const TRAIL_COUNT = 30;

function Ghost({
  ghostPosition,
  ghostScale,
  uniforms,
}: {
  ghostPosition: MutableRefObject<THREE.Vector3>;
  ghostScale: MutableRefObject<number>;
  uniforms: Uniforms;
}) {
  const group = useRef<THREE.Group>(null);
  const trailGeometry = useRef<THREE.BufferGeometry>(null);
  const trailPositions = useMemo(
    () => new Float32Array(TRAIL_COUNT * 3),
    [],
  );
  const initialized = useRef(false);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GHOST_VERTEX,
        fragmentShader: GHOST_FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    const groupNode = group.current;
    if (!groupNode) return;
    const damp = 1 - Math.exp(-delta * 2.6);
    groupNode.position.lerp(ghostPosition.current, damp);
    const scale = THREE.MathUtils.lerp(
      groupNode.scale.x,
      ghostScale.current,
      damp,
    );
    groupNode.scale.setScalar(scale);

    groupNode.rotation.y = state.clock.elapsedTime * 0.12;
    groupNode.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;

    if (trailGeometry.current) {
      if (!initialized.current) {
        for (let i = 0; i < TRAIL_COUNT; i += 1) {
          trailPositions[i * 3] = groupNode.position.x;
          trailPositions[i * 3 + 1] = groupNode.position.y;
          trailPositions[i * 3 + 2] = groupNode.position.z;
        }
        initialized.current = true;
      } else {
        for (let i = TRAIL_COUNT - 1; i > 0; i -= 1) {
          trailPositions[i * 3] = trailPositions[(i - 1) * 3];
          trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
          trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
        }
        trailPositions[0] = groupNode.position.x;
        trailPositions[1] = groupNode.position.y;
        trailPositions[2] = groupNode.position.z;
      }
      const attribute = trailGeometry.current.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      attribute.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[1, 5]} />
          <primitive object={material} attach="material" />
        </mesh>
        <mesh scale={0.62}>
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0.11}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={1.55}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color="#8b7cff"
            transparent
            opacity={0.045}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      <points>
        <bufferGeometry ref={trailGeometry}>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#8b7cff"
          size={0.055}
          sizeAttenuation
          transparent
          opacity={0.34}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

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
    float alpha = pow(max(0.0, 1.0 - d), 2.6) * 0.36;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function TowerHalos({ towers }: { towers: ReturnType<typeof makeCity> }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(towers.length * 3);
    const sizes = new Float32Array(towers.length);
    const colors = new Float32Array(towers.length * 3);
    const violet = new THREE.Color("#8b7cff");
    const cyan = new THREE.Color("#67e8f9");
    const coral = new THREE.Color("#ff7a6b");

    towers.forEach((tower, index) => {
      positions[index * 3] = tower.x;
      positions[index * 3 + 1] = tower.height + 0.08;
      positions[index * 3 + 2] = tower.z;
      sizes[index] = tower.flag ? 4.4 : 2.2 + tower.seed * 1.8;
      const color = tower.flag
        ? coral
        : tower.seed > 0.5
          ? violet
          : cyan;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [towers]);

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

  return (
    <points>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </points>
  );
}

function Stars({ count }: { count: number }) {
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      values[i * 3] = (Math.random() - 0.5) * 90;
      values[i * 3 + 1] = 13 + Math.random() * 26;
      values[i * 3 + 2] = -12 - Math.random() * 48;
    }
    return values;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#cbd5ff"
        size={0.09}
        sizeAttenuation
        transparent
        opacity={0.7}
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
      values[i * 3] = (Math.random() - 0.5) * 44;
      values[i * 3 + 1] = Math.random() * 18 + 0.4;
      values[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return values;
  }, [count]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.008;
  });

  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#9aa3b8"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.48}
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
  const towers = useMemo(() => makeCity(quality), [quality]);
  const smooth = useRef(0);
  const targetLook = useRef(new THREE.Vector3(0, 5, 0));
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const ghostPosition = useRef(new THREE.Vector3(4.8, 6.4, -1.5));
  const ghostScale = useRef(1);
  const ghostTarget = useMemo(() => new THREE.Vector3(), []);

  const towerUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 7 },
      uAnomaly: { value: 0 },
      uRewind: { value: 0 },
      uDim: { value: 0 },
      uAccentA: { value: new THREE.Color("#8b7cff") },
      uAccentB: { value: new THREE.Color("#67e8f9") },
      uAnomalyColor: { value: new THREE.Color("#ff7a6b") },
      uFogColor: { value: new THREE.Color(FOG_COLOR) },
      uFogDensity: { value: 0.024 },
    }),
    [],
  );

  const groundUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color("#8b7cff") },
      uFogColor: { value: new THREE.Color(FOG_COLOR) },
      uDim: { value: 0 },
    }),
    [],
  );

  const ghostUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uAccentA: { value: new THREE.Color("#8b7cff") },
      uAccentB: { value: new THREE.Color("#67e8f9") },
      uOpacity: { value: 0.82 },
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const signal = signals.current;
    const target = reduced ? 0 : signal.page;
    smooth.current += (target - smooth.current) * (1 - Math.exp(-dt * 2.1));

    const key = sampleChoreography(smooth.current);
    const mouseX = reduced ? 0 : signal.mouseX;
    const mouseY = reduced ? 0 : signal.mouseY;
    const mouseEase = 1 - Math.exp(-dt * 2.4);

    const driftX = Math.sin(state.clock.elapsedTime * 0.12) * 0.42;
    const driftY = Math.cos(state.clock.elapsedTime * 0.09) * 0.16;
    desiredPosition.set(
      key.x + mouseX * 2.6 + driftX,
      key.y + mouseY * 1.15 + driftY,
      key.z,
    );
    desiredTarget.set(key.tx + driftX * 0.2, key.ty + driftY * 0.2, key.tz);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-dt * 2.8));
    targetLook.current.lerp(desiredTarget, 1 - Math.exp(-dt * 3.2));
    camera.lookAt(targetLook.current);

    const density = key.fog;
    if (scene.fog) {
      (scene.fog as THREE.FogExp2).density = density;
    }

    const loop = reduced ? 1 : Math.min(1, Math.max(0, signal.loop));
    const reveal = loop <= 0.001 ? 7 : Math.min(7, 1 + loop * 6.4);
    const anomalyIn = Math.min(
      1,
      Math.max(0, (loop - 0.28) / 0.12),
    );
    const anomalyOut = Math.min(
      1,
      Math.max(0, (loop - 0.66) / 0.14),
    );
    const rewindIn = Math.min(1, Math.max(0, (loop - 0.64) / 0.08));
    const rewindOut = Math.min(1, Math.max(0, (loop - 0.86) / 0.1));

    towerUniforms.uTime.value = reduced ? 3.4 : state.clock.elapsedTime;
    towerUniforms.uReveal.value = reveal;
    towerUniforms.uAnomaly.value = anomalyIn * (1 - anomalyOut);
    towerUniforms.uRewind.value = rewindIn * (1 - rewindOut);
    towerUniforms.uDim.value = key.dim;
    (towerUniforms.uAccentA.value as THREE.Color).copy(key.colorA);
    (towerUniforms.uAccentB.value as THREE.Color).copy(key.colorB);
    towerUniforms.uFogDensity.value = density;

    groundUniforms.uTime.value = towerUniforms.uTime.value;
    groundUniforms.uDim.value = key.dim;
    (groundUniforms.uAccent.value as THREE.Color).copy(key.colorA);

    ghostUniforms.uTime.value = towerUniforms.uTime.value;
    ghostUniforms.uOpacity.value = key.ghostOpacity;
    (ghostUniforms.uAccentA.value as THREE.Color).copy(key.colorA);
    (ghostUniforms.uAccentB.value as THREE.Color).copy(key.colorB);

    const velocity = Math.min(1, Math.abs(signal.velocity) / 28);
    ghostTarget.set(
      key.ghostX + Math.sin(state.clock.elapsedTime * 0.42) * 0.35 + mouseX * 0.45,
      key.ghostY + Math.cos(state.clock.elapsedTime * 0.36) * 0.18 + mouseY * 0.3,
      key.ghostZ,
    );
    ghostPosition.current.lerp(ghostTarget, mouseEase);
    ghostScale.current = key.ghostScale * (1 + velocity * 0.12);
  });

  return (
    <>
      <fogExp2 attach="fog" args={[FOG_COLOR, 0.024]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[6, 14, 8]}
        intensity={0.55}
        color="#cbd5ff"
      />
      <pointLight
        position={[-10, 7, 8]}
        intensity={12}
        distance={42}
        decay={2}
        color="#8b7cff"
      />
      <pointLight
        position={[9, 4, -5]}
        intensity={9}
        distance={38}
        decay={2}
        color="#67e8f9"
      />

      <TowerField towers={towers} uniforms={towerUniforms} />
      <TowerHalos towers={towers} />
      <Stars count={quality === "high" ? 280 : quality === "medium" ? 160 : 80} />
      <Ground uniforms={groundUniforms} />
      <Ghost
        ghostPosition={ghostPosition}
        ghostScale={ghostScale}
        uniforms={ghostUniforms}
      />
      <Dust count={quality === "high" ? 620 : quality === "medium" ? 320 : 140} />
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
      camera={{ position: [0, 8.6, 25], fov: 42, near: 0.1, far: 150 }}
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
