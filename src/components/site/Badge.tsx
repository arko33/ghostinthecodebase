import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  tone?: "default" | "violet" | "coral";
  dot?: boolean;
  className?: string;
}

export default function Badge({
  children,
  tone = "default",
  dot = true,
  className = "",
}: Props) {
  return (
    <span
      className={`badge${tone !== "default" ? ` badge--${tone}` : ""} ${className}`}
    >
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
