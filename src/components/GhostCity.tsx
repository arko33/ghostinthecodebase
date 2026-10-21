"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MutableRefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Session, Snapshot } from "@/src/types";
import { buildPlaygroundCity, findTower, type PlaygroundTower } from "./playground/city";

interface Props {
  session: Session;
  snapshot: Snapshot;
  activeTurn: number;
  hotFile?: string;
  selectedFile: string | null;
  onSelectFile: (path: string | null) => void;
  preset: "overview" | "blame";
  rolledBack: boolean;
  reduced: boolean;
}

// Stable instance capacity: the mesh is never rebuilt when the visible turn
// changes, so instance matrices can never be lost on a hover/selection update.
const MAX_TOWERS = 128;

const TOWER_VERTEX = /* glsl */ `
  attribute float aHealth;
  attribute float aFlag;
  attribute float aOwner;
  attribute float aSeed;
  attribute float aIndex;

  varying float vHealth;
  varying float vFlag;
  varying float vOwner;
  varying float vSeed;
  varying float vIndex;
  varying float vFogDepth;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying vec3 vLocal;

  void main() {
    vHealth = aHealth;
    vFlag = aFlag;
    vOwner = aOwner;
    vSeed = aSeed;
    vIndex = aIndex;
    vLocal = position;

    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
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
  uniform float uSelected;
  uniform float uHover;
  uniform float uRolledBack;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying float vHealth;
  varying float vFlag;
  varying float vOwner;
  varying float vSeed;
  varying float vIndex;
  varying float vFogDepth;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  varying vec3 vLocal;

  void main() {
    float fresnel = pow(
      1.0 - clamp(abs(dot(normalize(vNormalW), normalize(vViewDir))), 0.0, 1.0),
      2.0
    );

    float vertical = clamp(vLocal.y, 0.0, 1.0);
    vec3 healthy = vec3(0.36, 0.92, 0.83);
    vec3 sick = vec3(1.0, 0.48, 0.42);
    vec3 health = mix(sick, healthy, mix(vHealth, 1.0, uRolledBack));

    vec3 rim = mix(vec3(0.4, 0.91, 1.0), vec3(0.62, 0.54, 1.0), vOwner);
    vec3 base = mix(vec3(0.035, 0.04, 0.065), health * 0.22, smoothstep(0.0, 1.0, vertical));

    float cellX = fract((vWorld.x + vWorld.z) * 0.72 + vSeed * 19.0);
    float cellY = fract(vWorld.y * 1.45 + vSeed * 11.0);
    float window = step(0.58, cellX) * step(0.48, cellY);
    float flicker = 0.55 + 0.45 * sin(uTime * (0.7 + vSeed * 2.0) + vSeed * 23.0);
    base += window * rim * (0.24 + 0.45 * flicker) * (0.35 + 0.65 * vertical);

    float shimmer = vSeed > 0.78 ? 0.08 * sin(uTime * 2.2 + vSeed * 40.0) : 0.0;
    base += max(0.0, shimmer);

    float pulse = 0.5 + 0.5 * sin(uTime * 3.2);
    float flag = vFlag * (1.0 - uRolledBack);
    vec3 coral = vec3(1.0, 0.48, 0.42) * (0.7 + 0.3 * pulse);
    base = mix(base, coral, clamp(flag * (0.45 + uAnomaly * 0.45), 0.0, 0.92));

    float selected = step(abs(vIndex - uSelected), 0.5);
    float hovered = step(abs(vIndex - uHover), 0.5);
    base += selected * vec3(0.36, 0.9, 1.0) * 0.22;
    base += hovered * vec3(0.7, 0.65, 1.0) * 0.1;

    vec3 color = base + fresnel * rim * (1.0 + 0.55 * vertical);
    color += fresnel * 0.16;
    color += selected * rim * fresnel * 1.4;

    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
  }
`;

function useTowers(
  session: Session,
  snapshot: Snapshot,
  activeTurn: number,
) {
  return useMemo(
    () => buildPlaygroundCity(session, snapshot, activeTurn),
    [session, snapshot, activeTurn],
  );
}

function TowerField({
  towers,
  selectedPath,
  hovered,
  onHover,
  onSelect,
  rolledBack,
  anomaly,
}: {
  towers: PlaygroundTower[];
  selectedPath: string | null;
  hovered: PlaygroundTower | null;
  onHover: (tower: PlaygroundTower | null) => void;
  onSelect: (tower: PlaygroundTower) => void;
  rolledBack: boolean;
  anomaly: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const hoveredIndex = hovered
    ? towers.findIndex((tower) => tower === hovered)
    : -1;
  const selectedIndex = selectedPath
    ? towers.findIndex((tower) => tower.path === selectedPath)
    : -1;

  const uniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uTime: { value: 0 },
      uAnomaly: { value: 0 },
      uSelected: { value: -1 },
      uHover: { value: -1 },
      uRolledBack: { value: 0 },
      uFogColor: { value: new THREE.Color("#05060a") },
      uFogDensity: { value: 0.012 },
    }),
    [],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);

    const attribute = () =>
      new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_TOWERS),
        1,
      );

    geo.setAttribute("aHealth", attribute());
    geo.setAttribute("aFlag", attribute());
    geo.setAttribute("aOwner", attribute());
    geo.setAttribute("aSeed", attribute());
    geo.setAttribute("aIndex", attribute());
    return geo;
  }, []);

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
    const node = mesh.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const health = geometry.getAttribute("aHealth") as THREE.InstancedBufferAttribute;
    const flags = geometry.getAttribute("aFlag") as THREE.InstancedBufferAttribute;
    const owners = geometry.getAttribute("aOwner") as THREE.InstancedBufferAttribute;
    const seeds = geometry.getAttribute("aSeed") as THREE.InstancedBufferAttribute;
    const indices = geometry.getAttribute("aIndex") as THREE.InstancedBufferAttribute;

    towers.forEach((tower, index) => {
      position.set(tower.x, 0, tower.z);
      scale.set(tower.width, tower.height, tower.depth);
      matrix.compose(position, quaternion, scale);
      node.setMatrixAt(index, matrix);
      health.setX(index, tower.health);
      flags.setX(index, tower.flag);
      owners.setX(index, tower.owner === "ai" ? 1 : 0);
      seeds.setX(index, tower.seed);
      indices.setX(index, index);
    });

    node.count = towers.length;
    node.instanceMatrix.needsUpdate = true;
    health.needsUpdate = true;
    flags.needsUpdate = true;
    owners.needsUpdate = true;
    seeds.needsUpdate = true;
    indices.needsUpdate = true;
    node.computeBoundingSphere();
  }, [geometry, towers]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uSelected.value = selectedIndex;
    uniforms.uHover.value = hoveredIndex;
    uniforms.uAnomaly.value = anomaly ? 1 : 0;
    uniforms.uRolledBack.value = rolledBack ? 1 : 0;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX_TOWERS]}
      frustumCulled={false}
      onPointerMove={(event) => {
        event.stopPropagation();
        const tower = towers[event.instanceId ?? -1];
        if (tower) onHover(tower);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(event) => {
        event.stopPropagation();
        const tower = towers[event.instanceId ?? -1];
        if (tower) onSelect(tower);
      }}
    />
  );
}

function FutureField({ towers }: { towers: PlaygroundTower[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    return geo;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#8b7cff",
        wireframe: true,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    towers.forEach((tower, index) => {
      position.set(tower.x, 0, tower.z);
      scale.set(tower.width, tower.height, tower.depth);
      matrix.compose(position, quaternion, scale);
      node.setMatrixAt(index, matrix);
    });
    node.count = towers.length;
    node.instanceMatrix.needsUpdate = true;
    node.computeBoundingSphere();
  }, [geometry, towers]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (towers.length === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX_TOWERS]}
      frustumCulled={false}
    />
  );
}

function Afterimage({
  tower,
  active,
}: {
  tower: PlaygroundTower | null;
  active: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    if (!active || !tower) return;
    setVisible(true);
    if (material.current) material.current.opacity = 0.48;
    const timer = window.setTimeout(() => setVisible(false), 1600);
    return () => window.clearTimeout(timer);
  }, [active, tower]);

  useFrame((_, delta) => {
    if (material.current && visible) {
      material.current.opacity = Math.max(
        0,
        material.current.opacity - delta * 0.3,
      );
    }
  });

  if (!visible || !tower) return null;

  return (
    <mesh position={[tower.x, tower.height / 2, tower.z]}>
      <boxGeometry args={[tower.width, tower.height, tower.depth]} />
      <meshBasicMaterial
        ref={material}
        color="#67e8f9"
        wireframe
        transparent
        opacity={0.48}
        depthWrite={false}
      />
    </mesh>
  );
}

function Ghost({
  tower,
  showBeam,
}: {
  tower: PlaygroundTower | null;
  showBeam: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current || !tower) return;
    group.current.position.x = tower.x + Math.sin(state.clock.elapsedTime * 0.55) * 0.25;
    group.current.position.y =
      tower.height + 1.8 + Math.cos(state.clock.elapsedTime * 0.7) * 0.12;
    group.current.position.z = tower.z + Math.cos(state.clock.elapsedTime * 0.45) * 0.2;
    group.current.rotation.y += 0.002;
  });

  if (!tower) return null;

  return (
    <>
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[0.85, 4]} />
          <meshBasicMaterial
            color="#b6a8ff"
            transparent
            opacity={0.32}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={0.58}>
          <icosahedronGeometry args={[0.85, 2]} />
          <meshBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={1.7}>
          <sphereGeometry args={[0.85, 20, 20]} />
          <meshBasicMaterial
            color="#8b7cff"
            transparent
            opacity={0.035}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <pointLight
          color="#8b7cff"
          intensity={5}
          distance={12}
          decay={2}
        />
      </group>
      {showBeam && (
        <Line
          points={[
            [tower.x, tower.height + 0.9, tower.z],
            [tower.x, tower.height + 2.6, tower.z],
          ]}
          color="#ff7a6b"
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      )}
    </>
  );
}

function CameraRig({
  towers,
  focusTower,
  preset,
  activeTurn,
  reduced,
}: {
  towers: PlaygroundTower[];
  focusTower: PlaygroundTower | null;
  preset: "overview" | "blame";
  activeTurn: number;
  reduced: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const desired = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  const animating = useRef(false);

  // The autopsy panel overlays the right edge of the stage, so bias the lens
  // left to keep the city optically centred in the uncovered area. Using the
  // film offset (rather than moving the target) keeps orbiting around the
  // true city centre.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (typeof cam.filmOffset !== "number") return;
    const overlay = size.width >= 900 ? Math.min(392, size.width * 0.36) : 0;
    const fraction = overlay / 2 / Math.max(1, size.width);
    cam.filmOffset =
      fraction * 2 * cam.filmGauge * Math.tan((cam.fov * Math.PI) / 360);
    cam.updateProjectionMatrix();
  }, [camera, size.width]);

  const framing = useMemo(() => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let maxY = 1;
    towers.forEach((tower) => {
      minX = Math.min(minX, tower.x - tower.width / 2);
      maxX = Math.max(maxX, tower.x + tower.width / 2);
      minZ = Math.min(minZ, tower.z - tower.depth / 2);
      maxZ = Math.max(maxZ, tower.z + tower.depth / 2);
      maxY = Math.max(maxY, tower.height);
    });
    return {
      center: new THREE.Vector3(
        (minX + maxX) / 2,
        maxY * 0.45,
        (minZ + maxZ) / 2,
      ),
      extent: Math.max(maxX - minX, maxZ - minZ, maxY * 1.4),
      maxY,
    };
  }, [towers]);

  const targets = useMemo(() => {
    const aspect = Math.max(0.6, size.width / Math.max(1, size.height));
    const vertical = framing.extent / (2 * Math.tan((38 * Math.PI) / 360));
    const distance = vertical * Math.max(1.15, 1.5 / aspect);
    const direction = new THREE.Vector3(0.68, 0.52, 1).normalize();

    const overview = {
      position: framing.center
        .clone()
        .add(direction.clone().multiplyScalar(distance)),
      target: framing.center.clone(),
    };

    const focus = focusTower
      ? {
          position: new THREE.Vector3(
            focusTower.x + 9,
            focusTower.height + 5,
            focusTower.z + 12,
          ),
          target: new THREE.Vector3(
            focusTower.x,
            focusTower.height * 0.55,
            focusTower.z,
          ),
        }
      : overview;

    return { overview, focus };
  }, [focusTower, framing, size.height, size.width]);

  useEffect(() => {
    const next = preset === "blame" ? targets.focus : targets.overview;
    if (reduced) {
      camera.position.copy(next.position);
      controls.current?.target.copy(next.target);
      controls.current?.update();
      return;
    }
    desired.current = next;
    animating.current = true;
  }, [activeTurn, camera, preset, reduced, targets]);

  useFrame((_, delta) => {
    const node = controls.current;
    if (!node) return;
    if (desired.current) {
      const ease = 1 - Math.exp(-delta * 4.5);
      camera.position.lerp(desired.current.position, ease);
      node.target.lerp(desired.current.target, ease);
      node.update();
      if (camera.position.distanceTo(desired.current.position) < 0.06) {
        desired.current = null;
        animating.current = false;
      }
    }
    node.autoRotate = !reduced && !animating.current;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      enablePan={false}
      minDistance={8}
      maxDistance={90}
      maxPolarAngle={Math.PI / 2.05}
      autoRotate={false}
      autoRotateSpeed={0.35}
      target={[framing.center.x, framing.center.y, framing.center.z]}
      onStart={() => {
        desired.current = null;
        animating.current = false;
      }}
    />
  );
}

const GROUND_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 view = viewMatrix * world;
    vWorld = world.xyz;
    vFogDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const GROUND_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFlag;
  uniform float uRolledBack;
  uniform vec3 uHot;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec2 p = vWorld.xz;
    float dist = length(p);

    vec2 minorCoord = p / 3.0;
    vec2 minorDeriv = fwidth(minorCoord);
    vec2 minorGrid = abs(fract(minorCoord - 0.5) - 0.5) / max(minorDeriv, vec2(0.0001));
    float minor = 1.0 - min(min(minorGrid.x, minorGrid.y), 1.0);

    vec2 majorCoord = p / 15.0;
    vec2 majorDeriv = fwidth(majorCoord);
    vec2 majorGrid = abs(fract(majorCoord - 0.5) - 0.5) / max(majorDeriv, vec2(0.0001));
    float major = 1.0 - min(min(majorGrid.x, majorGrid.y), 1.0);

    float fade = 1.0 - smoothstep(24.0, 110.0, dist);

    // Soft block fill keeps the floor from reading as empty black.
    vec2 cell = floor(p / 3.0);
    float blockTone = mod(cell.x + cell.y, 2.0) * 0.5 + 0.5;
    float fill = (0.55 + 0.45 * blockTone) * 0.035;

    float sweep = 0.5 + 0.5 * sin(dist * 0.14 - uTime * 0.5);
    vec3 gridColor = mix(vec3(0.46, 0.5, 0.64), vec3(0.66, 0.6, 1.0), major);
    float lines = minor * 0.12 + major * 0.44;
    vec3 color = gridColor * (fill + lines * (0.65 + 0.35 * sweep));

    float haze = exp(-dist * dist / 1800.0);
    color += vec3(0.18, 0.2, 0.4) * haze * 0.6;

    float hot = exp(-dot(p - uHot.xz, p - uHot.xz) * 0.06) * uFlag * (1.0 - uRolledBack);
    color += vec3(1.0, 0.42, 0.36) * hot * 0.4;

    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth * 0.35);
    color = mix(color, uFogColor, clamp(fog, 0.0, 0.9));

    float alpha = fade * (0.16 + fill * 4.0 + lines * 1.6 + haze * 0.5 + hot * 0.45);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

function Ground({
  hotTower,
  flagged,
  rolledBack,
}: {
  hotTower: PlaygroundTower | null;
  flagged: boolean;
  rolledBack: boolean;
}) {
  const uniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      uTime: { value: 0 },
      uFlag: { value: 0 },
      uRolledBack: { value: 0 },
      uHot: { value: new THREE.Vector3(0, 0, 0) },
      uFogColor: { value: new THREE.Color("#05060a") },
      uFogDensity: { value: 0.006 },
    }),
    [],
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uFlag.value = flagged ? 1 : 0;
    uniforms.uRolledBack.value = rolledBack ? 1 : 0;
    if (hotTower) uniforms.uHot.value.set(hotTower.x, 0, hotTower.z);
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} renderOrder={-1}>
      <circleGeometry args={[90, 96]} />
      <shaderMaterial
        vertexShader={GROUND_VERTEX}
        fragmentShader={GROUND_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function Dust({ count }: { count: number }) {
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      values[i * 3] = (Math.random() - 0.5) * 52;
      values[i * 3 + 1] = 1 + Math.random() * 18;
      values[i * 3 + 2] = (Math.random() - 0.5) * 52;
    }
    return values;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#9aa3b8"
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}

function Scene({
  session,
  snapshot,
  activeTurn,
  selectedFile,
  onSelectFile,
  preset,
  rolledBack,
  reduced,
  onHoverChange,
}: {
  session: Session;
  snapshot: Snapshot;
  activeTurn: number;
  selectedFile: string | null;
  onSelectFile: (path: string | null) => void;
  preset: "overview" | "blame";
  rolledBack: boolean;
  reduced: boolean;
  onHoverChange: (hovered: boolean) => void;
}) {
  const towers = useTowers(session, snapshot, activeTurn);
  const [hovered, setHovered] = useState<PlaygroundTower | null>(null);
  const currentTowers = useMemo(
    () => towers.filter((tower) => tower.turn <= activeTurn + 1),
    [towers, activeTurn],
  );
  const futureTowers = useMemo(
    () => towers.filter((tower) => tower.turn > activeTurn + 1),
    [towers, activeTurn],
  );
  const activeFile =
    selectedFile ??
    session.turns[activeTurn]?.changedFiles[0] ??
    "src/store/invoices.ts";
  const focusTower =
    findTower(towers, activeFile) ??
    findTower(towers, "src/store/invoices.ts") ??
    towers[0] ??
    null;
  const blamedTower = findTower(towers, "src/store/invoices.ts");
  const anomaly = activeTurn >= 3 && activeTurn < 6;

  useEffect(() => {
    onHoverChange(Boolean(hovered));
  }, [hovered, onHoverChange]);

  return (
    <>
      <fogExp2 attach="fog" args={["#05060a", 0.011]} />
      <ambientLight intensity={0.3} />
      <pointLight
        position={[0, 18, 10]}
        intensity={20}
        distance={60}
        decay={2}
        color="#cbd5ff"
      />
      <pointLight
        position={[-18, 8, -10]}
        intensity={12}
        distance={50}
        decay={2}
        color="#8b7cff"
      />

      <TowerField
        towers={currentTowers}
        selectedPath={selectedFile}
        hovered={hovered}
        onHover={setHovered}
        onSelect={(tower) => {
          if (tower.path) onSelectFile(tower.path);
        }}
        rolledBack={rolledBack}
        anomaly={anomaly}
      />
      <FutureField towers={futureTowers} />
      <Afterimage tower={blamedTower} active={rolledBack} />
      <Ghost
        tower={focusTower}
        showBeam={preset === "blame" || anomaly}
      />

      <Ground
        hotTower={blamedTower}
        flagged={anomaly}
        rolledBack={rolledBack}
      />
      <Dust count={180} />
      <CameraRig
        towers={towers}
        focusTower={focusTower}
        preset={preset}
        activeTurn={activeTurn}
        reduced={reduced}
      />

      {hovered && (
        <Html
          position={[
            hovered.x,
            hovered.height + (hovered.path ? 1.2 : 0.8),
            hovered.z,
          ]}
          center
          distanceFactor={18}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="pg-city-tip">
            <span className="pg-city-tip__path">
              {hovered.path ?? "district block"}
            </span>
            <span className="pg-city-tip__meta">
              {hovered.path
                ? `turn ${hovered.turn} · ${hovered.owner === "ai" ? "AI" : "human"}`
                : "ambient module"}
            </span>
            {hovered.flag ? (
              <span className="pg-city-tip__delta">+38 MB / sample</span>
            ) : null}
          </div>
        </Html>
      )}
    </>
  );
}

export default function GhostCity({
  session,
  snapshot,
  activeTurn,
  selectedFile,
  onSelectFile,
  preset,
  rolledBack,
  reduced,
}: Props) {
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div className="pg-city" data-hovered={hovered ? "true" : "false"}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [22, 18, 32], fov: 38, near: 0.1, far: 220 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Scene
          session={session}
          snapshot={snapshot}
          activeTurn={activeTurn}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          preset={preset}
          rolledBack={rolledBack}
          reduced={reduced}
          onHoverChange={setHovered}
        />
      </Canvas>
      <div className="pg-city__hint">
        Drag to orbit · click a tower to inspect
      </div>
    </div>
  );
}
