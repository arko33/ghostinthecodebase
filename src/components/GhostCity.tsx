"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { FileNode, Snapshot } from "@/src/types";

interface Props {
  snapshot: Snapshot;
  /** file path implicated by the active anomaly (red pulse). */
  hotFile?: string;
  onSelect?: (path: string) => void;
  onHover?: (path: string | null) => void;
}

const AI = "#f5a623";
const HUMAN = "#4aa8ff";
const HOT = "#ff4d4f";
const ACCENT = "#a371f7";

interface Placed {
  path: string;
  x: number;
  z: number;
  w: number;
  h: number;
  color: string;
  foggy: boolean;
}

// Files are laid out as a district grid so a small snapshot still reads as a
// composed scene instead of a lonely row of boxes.
function layout(files: FileNode[]) {
  const n = Math.max(1, files.length);
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = n <= 4 ? 7 : 5.5;
  const w = n <= 3 ? 3.4 : 2.8;

  const placed: Placed[] = files.map((f, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = (c - (cols - 1) / 2) * gap;
    const z = (r - (rows - 1) / 2) * gap;
    const h = Math.min(12, Math.max(3.4, f.loc / 5));
    return {
      path: f.path,
      x,
      z,
      w,
      h,
      color: f.owner === "ai" ? AI : HUMAN,
      foggy: !!f.unreviewed,
    };
  });

  const radius = Math.max(9, (Math.max(cols, rows) * gap) / 2 + 6);
  return { placed, radius };
}

function Building({
  p,
  hot,
  onHover,
  onSelect,
}: {
  p: Placed;
  hot: boolean;
  onHover: (path: string | null) => void;
  onSelect?: (path: string) => void;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current && hot) {
      mat.current.emissiveIntensity =
        0.55 + 0.45 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4));
    }
  });

  return (
    <group position={[p.x, 0, p.z]}>
      <mesh
        position={[0, p.h / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(p.path);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(p.path);
        }}
      >
        <boxGeometry args={[p.w, p.h, p.w]} />
        <meshStandardMaterial
          ref={mat}
          color={p.color}
          roughness={0.32}
          metalness={0.3}
          transparent={p.foggy}
          opacity={p.foggy ? 0.18 : 0.95}
          emissive={hot ? HOT : p.color}
          emissiveIntensity={hot ? 0.8 : p.foggy ? 0 : 0.18}
        />
      </mesh>

      {/* roof light strip */}
      <mesh position={[0, p.h + 0.08, 0]}>
        <boxGeometry args={[p.w * 0.62, 0.16, p.w * 0.62]} />
        <meshBasicMaterial
          color={hot ? HOT : p.color}
          transparent
          opacity={p.foggy ? 0.25 : 0.95}
        />
      </mesh>

      {/* red beacon beam on the implicated file */}
      {hot && (
        <mesh position={[0, p.h / 2 + 3, 0]}>
          <cylinderGeometry args={[0.05, 0.05, p.h + 6, 8]} />
          <meshBasicMaterial color={HOT} transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

function Rig({ radius }: { radius: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(radius * 0.55, radius * 0.7, radius * 1.0);
    camera.lookAt(0, 3, 0);
  }, [camera, radius]);
  return null;
}

function Scene({ snapshot, hotFile, onSelect, onHover }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { placed, radius } = layout(snapshot.files);
  const byPath = new Map(placed.map((p) => [p.path, p]));

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  function handleHover(path: string | null) {
    setHovered(path);
    onHover?.(path);
  }

  return (
    <>
      <color attach="background" args={["#070a10"]} />
      <fog attach="fog" args={["#070a10", radius * 2.6, radius * 5.4]} />

      <hemisphereLight args={["#9db7ff", "#0a0e14", 0.6]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[12, 20, 10]} intensity={1.5} />
      <directionalLight position={[-12, 8, -10]} intensity={0.6} color={ACCENT} />

      <Rig radius={radius} />

      {/* plaza floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[radius, 72]} />
        <meshStandardMaterial color="#0a0f18" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* concentric rings so the floor does not read as dead space */}
      {[0.42, 0.7, 0.97].map((k, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[radius * k - 0.07, radius * k, 72]} />
          <meshBasicMaterial
            color={i === 1 ? ACCENT : "#1d2b40"}
            transparent
            opacity={i === 1 ? 0.28 : 0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      <gridHelper args={[radius * 2, 24, "#182334", "#101827"]} position={[0, 0, 0]} />

      {placed.map((p) => (
        <Building
          key={p.path}
          p={p}
          hot={p.path === hotFile}
          onHover={handleHover}
          onSelect={onSelect}
        />
      ))}

      {/* import edges as gentle arcs */}
      {snapshot.imports.map(([from, to], i) => {
        const a = byPath.get(from);
        const b = byPath.get(to);
        if (!a || !b) return null;
        const mid: [number, number, number] = [
          (a.x + b.x) / 2,
          Math.max(a.h, b.h) + 3,
          (a.z + b.z) / 2,
        ];
        return (
          <Line
            key={i}
            points={[
              [a.x, a.h + 0.2, a.z],
              mid,
              [b.x, b.h + 0.2, b.z],
            ]}
            color={ACCENT}
            lineWidth={1.5}
            transparent
            opacity={0.6}
          />
        );
      })}

      <OrbitControls
        target={[0, 3, 0]}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.55}
        maxPolarAngle={1.4}
        minDistance={radius * 0.8}
        maxDistance={radius * 3.2}
      />
    </>
  );
}

export default function GhostCity(props: Props) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 45, position: [14, 12, 18], near: 0.1, far: 400 }}>
      <Scene {...props} />
    </Canvas>
  );
}
