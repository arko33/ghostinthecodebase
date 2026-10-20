"use client";

import { useId } from "react";
import { Cpu, MemoryStick } from "lucide-react";
import type { MetricSample } from "@/src/types";

interface Props {
  metrics: MetricSample[];
  activeTurn: number;
}

// Lightweight SVG line chart of memory + cpu across the timeline, with a
// vertical marker at the currently-scrubbed turn. No chart dependency needed.
export default function MetricsChart({ metrics, activeTurn }: Props) {
  const uid = useId().replace(/:/g, "");
  const W = 560;
  const H = 170;
  const pad = 26;
  const maxMem = Math.max(120, ...metrics.map((m) => m.mem));
  const maxCpu = 100;

  const x = (i: number) =>
    pad + (i / Math.max(1, metrics.length - 1)) * (W - pad * 2);
  const yMem = (v: number) => H - pad - (v / maxMem) * (H - pad * 2);
  const yCpu = (v: number) => H - pad - (v / maxCpu) * (H - pad * 2);

  const memPath = metrics
    .map((m, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yMem(m.mem).toFixed(1)}`)
    .join(" ");
  const cpuPath = metrics
    .map((m, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yCpu(m.cpu).toFixed(1)}`)
    .join(" ");

  const startIdx = Math.min(metrics.length - 1, activeTurn * 4);
  const endIdx = Math.min(metrics.length - 1, startIdx + 3);
  const markerX = (x(startIdx) + x(endIdx)) / 2;
  const sample = metrics[startIdx];

  const memArea = `${memPath} L ${x(metrics.length - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-dim">
          <MemoryStick className="h-3.5 w-3.5 text-danger" />
          mem
          <span className="font-mono tabular-nums text-[#e6edf3]">{sample?.mem ?? 0} MB</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-dim">
          <Cpu className="h-3.5 w-3.5 text-ai" />
          cpu
          <span className="font-mono tabular-nums text-[#e6edf3]">{sample?.cpu ?? 0}%</span>
        </span>
        <span className="ml-auto font-mono text-[10px] text-dim/60">
          p95 {sample?.latency ?? 0}ms · {sample?.errors ?? 0} err
        </span>
      </div>

      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Memory and CPU across the session timeline">
        <defs>
          <linearGradient id={`memfill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d4f" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ff4d4f" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const gy = pad + t * (H - pad * 2);
          return (
            <line
              key={t}
              x1={pad}
              x2={W - pad}
              y1={gy}
              y2={gy}
              stroke="#1f2937"
              strokeWidth={1}
              strokeDasharray={t === 1 ? "0" : "3 5"}
            />
          );
        })}

        <path d={memArea} fill={`url(#memfill-${uid})`} />
        <path d={memPath} fill="none" stroke="#ff4d4f" strokeWidth={1.8} strokeLinejoin="round" />
        <path d={cpuPath} fill="none" stroke="#f5a623" strokeWidth={1.8} strokeLinejoin="round" />

        <line
          x1={markerX}
          y1={pad - 6}
          x2={markerX}
          y2={H - pad}
          stroke="#a371f7"
          strokeWidth={1.2}
          strokeDasharray="4 3"
        />
        <circle cx={markerX} cy={pad - 6} r={3} fill="#a371f7" />

        <text x={pad} y={pad - 10} fill="#8b98a9" fontSize={9} fontFamily="monospace">
          {maxMem} MB
        </text>
        <text x={W - pad} y={H - 8} textAnchor="end" fill="#8b98a9" fontSize={9} fontFamily="monospace">
          turn {activeTurn + 1} →
        </text>
      </svg>
    </div>
  );
}
