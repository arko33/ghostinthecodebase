"use client";

import { useState } from "react";
import {
  Check,
  CircleCheckBig,
  Clock,
  Copy,
  Microscope,
  ShieldAlert,
  WandSparkles,
} from "lucide-react";
import type { Anomaly, Autopsy } from "@/src/types";

interface Props {
  autopsy: Autopsy;
  anomaly?: Anomaly;
}

export default function AutopsyCard({ autopsy, anomaly }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(autopsy.fixPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-danger/30 bg-danger/[0.06] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md border border-danger/40 bg-danger/10 text-danger">
          <Microscope className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-danger">
          Autopsy
        </span>
        {anomaly && (
          <span className="chip border-danger/40 bg-danger/10 text-danger">
            <ShieldAlert className="h-2.5 w-2.5" />
            {anomaly.kind} · {anomaly.severity}
          </span>
        )}
        <span
          className={`chip ml-auto ${
            autopsy.healed
              ? "border-ok/40 bg-ok/10 text-ok"
              : "border-ai/40 bg-ai/10 text-ai"
          }`}
        >
          {autopsy.healed ? (
            <>
              <CircleCheckBig className="h-2.5 w-2.5" /> healed
            </>
          ) : (
            <>
              <Clock className="h-2.5 w-2.5" /> pending
            </>
          )}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-[#dfe7f1]">
        <span className="font-semibold text-danger">Root cause: </span>
        {autopsy.rootCause}
      </p>

      <div className="mt-2.5 rounded-md border border-line bg-glow/80">
        <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-dim">
            <WandSparkles className="h-3 w-3 text-accent" />
            Heal prompt
          </span>
          <button
            type="button"
            onClick={copyPrompt}
            className="inline-flex items-center gap-1 rounded border border-line bg-elev px-1.5 py-0.5 text-[10px] text-dim transition-colors hover:border-accent/40 hover:text-accent"
          >
            {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
            {copied ? "copied" : "copy"}
          </button>
        </div>
        <code className="block whitespace-pre-wrap break-words px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-[#c9d4e2]">
          {autopsy.fixPrompt}
        </code>
      </div>
    </div>
  );
}
