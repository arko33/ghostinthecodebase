import type { Session, Snapshot } from "@/src/types";

export interface PlaygroundTower {
  path: string | null;
  label: string;
  loc: number;
  owner: "ai" | "human";
  unreviewed: boolean;
  turn: number;
  health: number;
  flag: number;
  seed: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

const KNOWN_FILES = [
  "app/api/invoices/route.ts",
  "app/api/invoices/[id]/route.ts",
  "app/api/health/route.ts",
  "app/api/autopsy/route.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/playground/page.tsx",
  "src/store/invoices.ts",
  "src/types.ts",
  "src/autopsy/engine.ts",
  "src/collector/opencode.ts",
  "src/runner/metrics.ts",
  "src/data/fixture.ts",
  "src/components/GhostCity.tsx",
  "src/components/Dashboard.tsx",
  "src/components/AIPanel.tsx",
  "src/components/CodeDiff.tsx",
  "src/components/MetricsChart.tsx",
  "src/components/site/LandingPage.tsx",
  "src/components/site/GhostCanvas.tsx",
  "app/globals.css",
  "next.config.mjs",
  "package.json",
  "tsconfig.json",
  "README.md",
  "PRD_CONCEPT.md",
];

function hash(value: string) {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return (out >>> 0) / 4294967296;
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

export function buildPlaygroundCity(
  session: Session,
  snapshot: Snapshot,
  activeTurn: number,
): PlaygroundTower[] {
  const random = mulberry32(0x706c6179);
  const firstSeen = new Map<string, number>();

  session.turns.forEach((turn) => {
    turn.changedFiles.forEach((path) => {
      if (!firstSeen.has(path)) firstSeen.set(path, turn.index + 1);
    });
  });

  const snapshotFiles = new Map(snapshot.files.map((file) => [file.path, file]));
  const spacing = 3.05;
  const cols = 10;
  const rows = 8;

  // Demo fixture keeps its curated layout. Live recordings build the city from
  // the files the recording actually touched — deterministically placed per
  // path hash so the skyline is stable between live refreshes.
  const isLive = session.agent.startsWith("ghost-live");
  const blamedTurnId = session.autopsies[0]?.blamedTurnId ?? session.anomalies[0]?.turnId ?? null;
  const blamedTurn = session.turns.find((turn) => turn.id === blamedTurnId) ?? null;
  const hotFiles = new Set(blamedTurn?.changedFiles ?? []);
  const healed =
    !isLive && activeTurn < 5 ? false : isLive ? !!session.autopsies[0]?.healed : true;

  const realFiles = isLive
    ? [...snapshotFiles.values()].filter((file) => file.path)
    : [];

  const determinist = (path: string): [number, number] => {
    const col = Math.floor(hash(path) * cols);
    const row = Math.floor(hash(`${path}·z`) * rows);
    return [
      (col - (cols - 1) / 2) * spacing,
      (row - (rows - 1) / 2) * spacing,
    ];
  };

  const files: Array<{ path: string; label: string; loc: number; owner: "ai" | "human"; unreviewed: boolean; turn: number; seed: number }> = realFiles.length
    ? realFiles.map((file) => ({
        path: file.path,
        label: file.path,
        loc: file.loc,
        owner: file.owner,
        unreviewed: !!file.unreviewed,
        turn: firstSeen.get(file.path) ?? 1,
        seed: hash(file.path),
      }))
    : isLive
      // live recording without churn data (e.g. not a git repo): no towers —
      // never fill the user's city with the demo's files.
      ? []
      : (KNOWN_FILES.map((path) => {
    const snap = snapshotFiles.get(path);
    const seed = hash(path);
    return {
      path,
      label: path,
      loc: snap?.loc ?? 18 + Math.round(seed * 80),
      owner: snap?.owner ?? (seed > 0.34 ? "ai" : "human"),
      unreviewed: snap?.unreviewed ?? false,
      turn: firstSeen.get(path) ?? 1,
      seed,
    };
  }) as Array<{
    path: string;
    label: string;
    loc: number;
    owner: "ai" | "human";
    unreviewed: boolean;
    turn: number;
    seed: number;
  }>);

  const forced: Record<string, [number, number]> = {
    "src/store/invoices.ts": [2.2, 0.4],
    "app/api/invoices/route.ts": [-2.8, -1.6],
    "app/api/invoices/[id]/route.ts": [-0.2, -2.6],
    "app/playground/page.tsx": [4.8, -2.2],
    "src/components/GhostCity.tsx": [-4.6, 2.4],
  };

  files.sort((a, b) => {
    if (forced[a.path] && !forced[b.path]) return -1;
    if (!forced[a.path] && forced[b.path]) return 1;
    return a.path.localeCompare(b.path);
  });

  const towers: PlaygroundTower[] = [];
  const occupied: Array<[number, number]> = [];

  const place = (
    path: string | null,
    label: string,
    loc: number,
    owner: "ai" | "human",
    unreviewed: boolean,
    turn: number,
    seed: number,
    x: number,
    z: number,
    flag = 0,
  ) => {
    const height = Math.max(1.6, Math.min(12, loc / 7 + 2.2));
    const hot = path !== null && hotFiles.has(path);
    towers.push({
      path,
      label,
      loc,
      owner,
      unreviewed,
      turn,
      health: hot
        ? isLive
          ? healed
            ? 0.95
            : 0.06
          : activeTurn >= 3 && activeTurn < 6
            ? healed
              ? 0.95
              : 0.06
            : 0.86
        : 0.62 + seed * 0.38,
      flag,
      seed,
      x,
      z,
      width: 0.8 + (seed % 0.3) * 0.9,
      depth: 0.8 + ((seed * 7) % 0.3) * 0.9,
      height,
    });
  };

  files.forEach((file) => {
    const spot = forced[file.path];
    let x: number;
    let z: number;
    if (spot && !isLive) {
      [x, z] = spot;
    } else if (isLive) {
      [x, z] = determinist(file.path);
    } else {
      let guard = 0;
      do {
        const col = Math.floor(random() * cols);
        const row = Math.floor(random() * rows);
        x = (col - (cols - 1) / 2) * spacing + (random() - 0.5) * 0.8;
        z = (row - (rows - 1) / 2) * spacing + (random() - 0.5) * 0.8;
        guard += 1;
      } while (
        guard < 40 &&
        occupied.some(
          ([ox, oz]) => Math.hypot(ox - x, oz - z) < spacing * 0.78,
        )
      );
    }
    occupied.push([x, z]);
    const flag =
      hotFiles.has(file.path) && !healed && (!isLive || !!blamedTurn) ? 1 : 0;
    place(
      file.path,
      file.path,
      file.loc,
      file.owner,
      file.unreviewed,
      file.turn,
      file.seed,
      x,
      z,
      flag,
    );
  });

  // Ambient district blocks keep the demo city legible without inventing file
  // facts. Live recordings never get filler: their skyline is exactly the set
  // of files the session actually touched — zero files = an honest empty city.
  if (!isLive) {
  const ambientCount = 44;
  for (let i = 0; i < ambientCount; i += 1) {
    let guard = 0;
    let x = 0;
    let z = 0;
    do {
      const col = Math.floor(random() * (cols + 2));
      const row = Math.floor(random() * (rows + 1));
      x = (col - (cols + 1) / 2) * spacing + (random() - 0.5) * 1.1;
      z = (row - rows / 2) * spacing + (random() - 0.5) * 1.1;
      guard += 1;
    } while (
      guard < 50 &&
      occupied.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < spacing * 0.72)
    );
    occupied.push([x, z]);
    const seed = random();
    place(
      null,
      "district block",
      16 + Math.round(seed * 68),
      seed > 0.45 ? "ai" : "human",
      seed > 0.82,
      1,
      seed,
      x,
      z,
    );
  }
  }

  return towers;
}

export function findTower(
  towers: PlaygroundTower[],
  path: string | null | undefined,
) {
  if (!path) return null;
  return towers.find((tower) => tower.path === path) ?? null;
}
