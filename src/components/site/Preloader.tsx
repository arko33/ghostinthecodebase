"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { easeOutCubic } from "./hooks";

interface Props {
  onDone: () => void;
}

const STORAGE_KEY = "ghost:preloader-seen";

export default function Preloader({ onDone }: Props) {
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage can be unavailable in private mode */
    }
    setProgress(100);
    setDone(true);
    window.setTimeout(() => onDoneRef.current(), 420);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      seen = false;
    }

    if (reduced || seen) {
      finish();
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 1350;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(Math.round(easeOutCubic(t) * 100));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };
    frame = requestAnimationFrame(tick);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  return (
    <div
      className="preloader"
      data-done={done ? "true" : "false"}
      aria-hidden={done}
      role="status"
      aria-live="polite"
      aria-label="Loading GhostInTheCodebase"
    >
      <div className="preloader__inner">
        <svg
          className="preloader__mark"
          width="58"
          height="58"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M16 3.4c-5.5 0-9 4.4-9 10.4v13.1l3.2-2.6 2.3 2.6 3.5-2.9 3.5 2.9 2.3-2.6 3.2 2.6V13.8c0-6-3.5-10.4-9-10.4Z"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <circle cx="12.7" cy="14" r="0.8" fill="currentColor" />
          <circle cx="19.3" cy="14" r="0.8" fill="currentColor" />
        </svg>
        <div className="preloader__meta">
          <span className="preloader__label">Recording the codebase</span>
          <div className="preloader__bar" aria-hidden="true">
            <span
              style={{ "--progress": progress / 100 } as CSSProperties}
            />
          </div>
          <span className="preloader__count" aria-hidden="true">
            {String(progress).padStart(3, "0")}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="preloader__skip"
        onClick={finish}
        aria-label="Skip intro"
      >
        Skip
      </button>
    </div>
  );
}
