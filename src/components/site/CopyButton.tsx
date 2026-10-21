"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  label?: string;
  className?: string;
}

export default function CopyButton({
  value,
  label = "Copy",
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`copy-btn ${className}`}
        data-copied={copied ? "true" : "false"}
        onClick={copy}
        aria-label={copied ? "Copied to clipboard" : label}
      >
        {copied ? (
          <Check size={14} weight="light" aria-hidden="true" />
        ) : (
          <Copy size={14} weight="light" aria-hidden="true" />
        )}
        {copied ? "Copied" : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
