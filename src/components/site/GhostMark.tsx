interface Props {
  size?: number;
  className?: string;
  animated?: boolean;
  variant?: "outline" | "filled" | "glow";
  title?: string;
}

/**
 * The brand ghost. Custom vector only, never a library icon. The outline stays
 * crisp from 16px to 256px; the filled and glow variants are for large moments.
 */
export default function GhostMark({
  size = 26,
  className = "",
  animated,
  variant = "outline",
  title,
}: Props) {
  const classes = [
    "ghost-mark",
    variant !== "outline" ? `ghost-mark--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={classes}
      data-animated={animated ? "true" : undefined}
    >
      {title && <title>{title}</title>}
      <path
        d="M16 3.35c-5.5 0-9 4.4-9 10.4v13.15l3.2-2.6 2.3 2.6 3.5-2.95 3.5 2.95 2.3-2.6 3.2 2.6V13.75c0-6-3.5-10.4-9-10.4Z"
        stroke="currentColor"
        strokeWidth={variant === "outline" ? 1.35 : 1.1}
        strokeLinejoin="round"
        fill={variant === "filled" ? "currentColor" : "none"}
      />
      <circle
        cx="12.7"
        cy="14"
        r="1.05"
        fill={variant === "filled" ? "#05060a" : "currentColor"}
      />
      <circle
        cx="19.3"
        cy="14"
        r="1.05"
        fill={variant === "filled" ? "#05060a" : "currentColor"}
      />
      <path
        d="M13.6 18.7c.7.7 1.5 1 2.4 1s1.7-.3 2.4-1"
        stroke={variant === "filled" ? "#05060a" : "currentColor"}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity={variant === "filled" ? 0.55 : 0.45}
      />
    </svg>
  );
}
