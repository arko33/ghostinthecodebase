"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type MutableRefObject,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import type { Quality } from "./cityChoreography";
import type { ScrollSignals } from "./scroll";

const GhostCanvas = dynamic(() => import("./GhostCanvas"), { ssr: false });

interface Props {
  signals: MutableRefObject<ScrollSignals>;
  active: boolean;
  reduced: boolean;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    const lose = context.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function detectQuality(): Quality {
  const mobile = window.matchMedia("(max-width: 820px)").matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

  if (mobile) {
    return cores >= 6 && memory >= 4 ? "medium" : "low";
  }
  if (memory <= 4 || cores <= 4) return "low";
  if (cores >= 8 && memory >= 8) return "high";
  return "medium";
}

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const SKYLINE = Array.from({ length: 26 }, (_, index) =>
  26 + Math.abs(Math.sin(index * 1.73)) * 58,
);

function StaticCity({ hidden }: { hidden: boolean }) {
  return (
    <div className="scene-poster" data-hidden={hidden ? "true" : "false"}>
      <div className="scene-poster__glow" />
      <div className="scene-poster__skyline" aria-hidden="true">
        {SKYLINE.map((height, index) => (
          <i
            key={index}
            className="scene-poster__tower"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="scene-poster__grid" aria-hidden="true" />
    </div>
  );
}

export default function SceneLayer({ signals, active, reduced }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [quality, setQuality] = useState<Quality>("medium");
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setSupported(supportsWebGL());
    setQuality(detectQuality());
  }, []);

  // The canvas is mounted inside a fixed layer after a dynamic import. Force a
  // resize pass so the renderer measures the viewport instead of its 300x150
  // default before the first frame.
  useEffect(() => {
    if (!supported) return;
    const reveal = window.setTimeout(() => setReady(true), 1400);
    return () => window.clearTimeout(reveal);
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    const kick = () => window.dispatchEvent(new Event("resize"));
    const timers = [60, 320, 900].map((delay) =>
      window.setTimeout(kick, delay),
    );
    window.addEventListener("load", kick);
    document.fonts?.ready.then(kick).catch(() => undefined);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("load", kick);
    };
  }, [supported, quality]);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div className="scene-layer" aria-hidden="true">
      <StaticCity hidden={ready} />
      {supported && (
        <SceneBoundary>
          <GhostCanvas
            signals={signals}
            active={active && visible}
            quality={quality}
            reduced={reduced}
            onReady={() => setReady(true)}
            onPerformanceDrop={() =>
              setQuality((current) =>
                current === "high" ? "medium" : "low",
              )
            }
          />
        </SceneBoundary>
      )}
    </div>
  );
}
