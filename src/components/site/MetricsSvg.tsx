import { demoSession } from "@/src/data/fixture";

interface Props {
  id: string;
  healed?: boolean;
  className?: string;
  height?: number;
}

export default function MetricsSvg({
  id,
  healed = false,
  className = "",
  height = 138,
}: Props) {
  const metrics = demoSession.metrics;
  const width = 360;
  const pad = 8;
  const max = Math.max(...metrics.map((sample) => sample.mem)) * 1.06;

  const x = (index: number) =>
    pad + (index / Math.max(1, metrics.length - 1)) * (width - pad * 2);
  const y = (value: number) =>
    height - pad - (value / max) * (height - pad * 2);

  const point = (index: number) =>
    `${x(index).toFixed(2)} ${y(metrics[index].mem).toFixed(2)}`;

  const full = metrics
    .map((_, index) => `${index === 0 ? "M" : "L"} ${point(index)}`)
    .join(" ");

  const red = metrics
    .slice(0, 21)
    .map((_, index) => `${index === 0 ? "M" : "L"} ${point(index)}`)
    .join(" ");

  const green = metrics
    .slice(20)
    .map(
      (_, index) =>
        `${index === 0 ? "M" : "L"} ${point(index + 20)}`,
    )
    .join(" ");

  const area = `${full} L ${x(metrics.length - 1)} ${height - pad} L ${x(0)} ${height - pad} Z`;
  const markerX = x(16);

  return (
    <svg
      className={`metric-svg ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        healed
          ? "Memory curve: resident memory climbs from turn 4 and flattens after the rollback."
          : "Memory curve: resident memory climbs about 38 megabytes per sample after turn 4."
      }
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={healed ? "#5eead4" : "#ff7a6b"}
            stopOpacity="0.22"
          />
          <stop
            offset="100%"
            stopColor={healed ? "#5eead4" : "#ff7a6b"}
            stopOpacity="0"
          />
        </linearGradient>
      </defs>

      <g className="metric-svg__grid" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={pad}
            x2={width - pad}
            y1={pad + fraction * (height - pad * 2)}
            y2={pad + fraction * (height - pad * 2)}
          />
        ))}
      </g>

      <path
        className="metric-svg__area"
        d={area}
        fill={`url(#${id}-fill)`}
        aria-hidden="true"
      />
      {healed && (
        <path
          className="metric-svg__line metric-svg__line--healed"
          d={green}
          aria-hidden="true"
        />
      )}
      <path
        className="metric-svg__line"
        d={healed ? red : full}
        opacity={healed ? 0.55 : 1}
        aria-hidden="true"
      />
      <line
        className="metric-svg__marker"
        x1={markerX}
        x2={markerX}
        y1={pad}
        y2={height - pad}
        aria-hidden="true"
      />
      <text
        className="metric-svg__label"
        x={markerX + 5}
        y={pad + 9}
        aria-hidden="true"
      >
        t4
      </text>
      <circle
        className="metric-svg__anomaly"
        cx={markerX}
        cy={y(metrics[16].mem)}
        r="2"
        aria-hidden="true"
      />
      <text
        className="metric-svg__label"
        x={pad}
        y={height - 2}
        aria-hidden="true"
      >
        0
      </text>
      <text
        className="metric-svg__label"
        x={width - pad}
        y={height - 2}
        textAnchor="end"
        aria-hidden="true"
      >
        28 samples
      </text>
    </svg>
  );
}
