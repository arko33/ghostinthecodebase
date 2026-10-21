"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "./hooks";

const COMMANDS = [
  "curl -fsSL https://raw.githubusercontent.com/arko33/ghostinthecodebase/main/packages/ghost/install.sh | bash",
  "curl -o .opencode/plugins/ghost.ts https://raw.githubusercontent.com/arko33/ghostinthecodebase/main/packages/opencode-plugin/index.ts",
  "ghost watch --repo . --app-url http://localhost:3000",
  "ghost status",
];

interface Props {
  id?: string;
}

export default function Terminal({ id }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px -18% 0px", 0.2);
  const reduced = useReducedMotion();
  const [lines, setLines] = useState<string[]>(["", "", ""]);
  const [lineIndex, setLineIndex] = useState(0);
  const [allCopied, setAllCopied] = useState(false);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;

    if (reduced) {
      setLines(COMMANDS);
      setLineIndex(COMMANDS.length);
      return;
    }

    let cancelled = false;
    const typeLine = (index: number) => {
      if (cancelled || index >= COMMANDS.length) {
        setLineIndex(COMMANDS.length);
        return;
      }
      const command = COMMANDS[index];
      let char = 0;
      setLineIndex(index);
      const step = () => {
        if (cancelled) return;
        char += 1;
        setLines((current) => {
          const next = [...current];
          next[index] = command.slice(0, char);
          return next;
        });
        if (char < command.length) {
          timers.current.push(setTimeout(step, 13 + Math.random() * 22));
        } else {
          timers.current.push(
            setTimeout(() => typeLine(index + 1), index === 0 ? 320 : 420),
          );
        }
      };
      step();
    };

    timers.current.push(setTimeout(() => typeLine(0), 180));
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [inView, reduced]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(COMMANDS.join("\n"));
      setAllCopied(true);
      window.setTimeout(() => setAllCopied(false), 1800);
    } catch {
      setAllCopied(false);
    }
  };

  const copyLine = async (index: number) => {
    try {
      await navigator.clipboard.writeText(COMMANDS[index]);
      setCopiedLine(index);
      window.setTimeout(() => setCopiedLine(null), 1600);
    } catch {
      setCopiedLine(null);
    }
  };

  const complete = lineIndex >= COMMANDS.length;

  return (
    <div ref={ref} className="terminal glass" id={id}>
      <div className="terminal__bar">
        <span>
          <span className="terminal__lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          ghost — ~/ghostinthecodebase
        </span>
        <span>zsh</span>
      </div>
      <div className="terminal__body">
        {COMMANDS.map((command, index) => (
          <div className="terminal__line" key={command}>
            <span className="terminal__prompt" aria-hidden="true">
              $
            </span>
            <span className="terminal__cmd">
              {lines[index]}
              {lineIndex === index && !complete && (
                <span className="terminal__caret" aria-hidden="true" />
              )}
            </span>
            {lines[index] === command && (
              <button
                type="button"
                className="copy-btn"
                style={{
                  height: 22,
                  padding: "0 6px",
                  marginLeft: "auto",
                  flex: "none",
                }}
                onClick={() => copyLine(index)}
                aria-label={`Copy command ${index + 1}`}
              >
                {copiedLine === index ? (
                  <Check size={14} weight="light" aria-hidden="true" />
                ) : (
                  <Copy size={14} weight="light" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        ))}
        {complete && (
          <div className="terminal__output" aria-live="polite">
            recording <b>7 turns</b> · 28 samples · anomaly at <b>t4</b> ·
            shadow commits clean
          </div>
        )}
      </div>
      <div className="terminal__foot">
        <span>No agent SDK. No lock-in. Ctrl+C to stop.</span>
        <button
          type="button"
          className="copy-btn"
          data-copied={allCopied ? "true" : "false"}
          onClick={copyAll}
          aria-label="Copy all quickstart commands"
        >
          {allCopied ? (
            <Check size={14} weight="light" aria-hidden="true" />
          ) : (
            <Copy size={14} weight="light" aria-hidden="true" />
          )}
          {allCopied ? "Copied" : "Copy all"}
        </button>
      </div>
    </div>
  );
}
