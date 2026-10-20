"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import {
  Box,
  CloudFog,
  Flame,
  Layers,
  Loader,
  MousePointerClick,
  Sparkles,
  Users,
} from "lucide-react";
import type { Snapshot } from "@/src/types";

// WebGL must run in the browser only.
const GhostCity = dynamic(() => import("./GhostCity"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#070a10]">
      <span className="inline-flex items-center gap-2 text-[11px] text-dim">
        <Loader className="h-3.5 w-3.5 animate-spin" />
        Building the city…
      </span>
    </div>
  ),
});

// Keeps a WebGL failure from blanking the whole panel.
class CityBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="grid h-full w-full place-items-center bg-[#070a10] p-4 text-center">
          <span className="text-[11px] text-dim">
            3D view unavailable in this browser. The timeline still works.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Props {
  snapshot: Snapshot;
  hotFile?: string;
  onSelectFile?: (path: string) => void;
}

const LEGEND = [
  { icon: Sparkles, label: "AI-written", className: "text-ai" },
  { icon: Users, label: "human", className: "text-human" },
  { icon: Flame, label: "regression", className: "text-danger" },
  { icon: CloudFog, label: "unreviewed", className: "text-dim" },
];

export default function CityPanel({ snapshot, hotFile, onSelectFile }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const aiFiles = snapshot.files.filter((f) => f.owner === "ai").length;
  const unreviewed = snapshot.files.filter((f) => f.unreviewed).length;
  const focus = hovered ?? hotFile;

  return (
    <section className="panel relative h-full min-h-[380px] overflow-hidden p-0">
      <div className="absolute inset-0">
        <CityBoundary>
          <GhostCity
            snapshot={snapshot}
            hotFile={hotFile}
            onSelect={onSelectFile}
            onHover={setHovered}
          />
        </CityBoundary>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-ink/95 via-ink/50 to-transparent p-3">
        <div className="min-w-0">
          <h2 className="section-title text-[#e6edf3]">
            <Layers className="h-3.5 w-3.5 text-accent" />
            GhostInTheCodebase
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="chip border-line bg-elev/80 text-dim">
              <Box className="h-2.5 w-2.5" />
              {snapshot.files.length} files
            </span>
            <span className="chip border-ai/30 bg-ai/10 text-ai">{aiFiles} ai</span>
            <span className="chip border-line bg-elev/80 text-dim">{unreviewed} unreviewed</span>
          </div>
        </div>
        <span className="chip shrink-0 border-accent/30 bg-accent/10 text-accent">3D</span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-ink/95 via-ink/60 to-transparent p-3 pt-12">
        {focus && (
          <div
            className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] ${
              hovered
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            <Flame className={`h-3 w-3 shrink-0 ${hovered ? "" : "animate-pulseGlow"}`} />
            <span className="truncate">{focus}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-dim">
            {LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <item.icon className={`h-3 w-3 ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>
          <span className="hidden items-center gap-1 text-[10px] text-dim/70 sm:inline-flex">
            <MousePointerClick className="h-3 w-3" />
            drag to orbit · click a tower
          </span>
        </div>
      </div>
    </section>
  );
}
