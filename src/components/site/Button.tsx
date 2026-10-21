"use client";

import Link from "next/link";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useRef } from "react";
import { useReducedMotion } from "./hooks";

interface Props {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: ReactNode;
  ariaLabel?: string;
  onClick?: () => void;
}

export default function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  icon,
  ariaLabel,
  onClick,
}: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduced = useReducedMotion();
  const external = /^https?:\/\//.test(href);
  const classes = [
    "btn",
    `btn--${variant}`,
    size !== "md" ? `btn--${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (reduced || event.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    el.style.setProperty("--mx", `${(x * 0.09).toFixed(2)}px`);
    el.style.setProperty("--my", `${(y * 0.14).toFixed(2)}px`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "0px");
    el.style.setProperty("--my", "0px");
  };

  const content = (
    <span className="btn__inner">
      {children}
      {icon}
    </span>
  );

  const style = { "--press": 1 } as CSSProperties;

  if (external) {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={classes}
        aria-label={ariaLabel}
        style={style}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      ref={ref}
      href={href}
      className={classes}
      aria-label={ariaLabel}
      style={style}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={onClick}
    >
      {content}
    </Link>
  );
}
