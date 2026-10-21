"use client";

import { useRef, useState } from "react";
import type { MetricSample } from "@/src/types";

interface Props {
  metrics: MetricSample[];
  activeTurn: number;
  onHoverTurn?: (turn: number) => void;
  onSelectTurn?: (turn: number) => void;
  height?: number;
}

function smoothPath(points: Array<[number, number]>) {
  if (points.length === 0) return "";
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const mid = (x1 + x2) / 2;
    path += ` C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }
  return path;
}

export default function MetricsChart({
  metrics,
  activeTurn,
  onHoverTurn,
  onSelectTurn,
  height = 250,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const lastTurn = useRef<number | null>(null);
  const width = 560;
  const padL = 44;
  const padR = 46;
  const padT = 30;
  const padB = 30;

  const maxMem = Math.max(400, ...metrics.map((sample) => sample.mem)) * 1.02;
  const maxLat = Math.max(300, ...metrics.map((sample) => sample.latency)) * 1.08;
  const threshold = 200;

  const x = (index: number) =>
    padL +
    (index / Math.max(1, metrics.length - 1)) * (width - padL - padR);
  const yMem = (value: number) =>
    height - padB - (value / maxMem) * (height - padT - padB);
  const yLat = (value: number) =>
    height - padB - (value / maxLat) * (height - padT - padB);

  const memPoints = metrics.map(
    (sample, index) => [x(index), yMem(sample.mem)] as [number, number],
  );
  const latPoints = metrics.map(
    (sample, index) => [x(index), yLat(sample.latency)] as [number, number],
  );
  const memPath = smoothPath(memPoints);
  const latPath = smoothPath(latPoints);
  const areaPath = `${memPath} L ${x(metrics.length - 1)} ${height - padB} L ${x(0)} ${height - padB} Z`;

  const activeX = x(activeTurn * 4 + 1.5);
  const anomalyStart = x(12);
  const anomalyEnd = x(24);
  const lastIndex = Math.max(1, metrics.length - 1);

  const indexFromEvent = (clientX: number, element: SVGRectElement) => {
    const svg = element.ownerSVGElement;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const local = ((clientX - rect.left) / rect.width) * width;
    const ratio = (local - padL) / (width - padL - padR);
    return Math.max(0, Math.min(metrics.length - 1, Math.round(ratio * lastIndex)));
  };

  const updateHover = (
    event: React.PointerEvent<SVGRectElement>,
  ) => {
    const index = indexFromEvent(event.clientX, event.currentTarget);
    setHover(index);
    const turn = metrics[index]?.turn ?? 0;
    if (lastTurn.current !== turn) {
      lastTurn.current = turn;
      onHoverTurn?.(turn);
    }
  };

  const sample = hover !== null ? metrics[hover] : null;
  const tooltipWidth = 156;
  const tooltipX = hover !== null
    ? Math.min(width - tooltipWidth - 6, Math.max(6, x(hover) - tooltipWidth / 2))
    : 0;

  return (
    <div className="pg-chart">
      <div className="pg-chart__legend">
        <span>
          <i className="pg-chart__swatch pg-chart__swatch--mem" />
          rss (MB)
        </span>
        <span>
          <i className="pg-chart__swatch pg-chart__swatch--lat" />
          p95 (ms)
        </span>
        <span>
          <i className="pg-chart__swatch pg-chart__swatch--threshold" />
          threshold
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="pg-chart__svg"
        role="img"
        aria-label="Memory and p95 latency across the 28 recorded samples. The anomaly begins at turn 4."
      >
        <defs>
          <linearGradient id="pg-mem-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7a6b" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#ff7a6b" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pg-lat-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* anomaly region */}
        <rect
          x={anomalyStart}
          y={padT}
          width={Math.max(0, anomalyEnd - anomalyStart)}
          height={height - padT - padB}
          fill="rgba(255,122,107,0.06)"
        />
        <line
          x1={anomalyStart}
          x2={anomalyStart}
          y1={padT}
          y2={height - padB}
          stroke="rgba(255,122,107,0.3)"
          strokeDasharray="3 5"
        />

        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = Math.round(maxMem * fraction);
          return (
            <g key={fraction}>
              <line
                x1={padL}
                x2={width - padR}
                y1={yMem(value)}
                y2={yMem(value)}
                stroke="rgba(255,255,255,0.055)"
              />
              <text
                x={padL - 8}
                y={yMem(value) + 3}
                textAnchor="end"
                className="pg-chart__axis"
              >
                {value}
              </text>
            </g>
          );
        })}
        {[0, 0.5, 1].map((fraction) => {
          const value = Math.round(maxLat * fraction);
          return (
            <text
              key={fraction}
              x={width - padR + 8}
              y={yLat(value) + 3}
              textAnchor="start"
              className="pg-chart__axis"
            >
              {value}
            </text>
          );
        })}

        {/* threshold */}
        <line
          x1={padL}
          x2={width - padR}
          y1={yMem(threshold)}
          y2={yMem(threshold)}
          stroke="rgba(255,122,107,0.5)"
          strokeDasharray="4 5"
        />
        <text
          x={width - padR}
          y={yMem(threshold) - 6}
          textAnchor="end"
          className="pg-chart__threshold"
        >
          threshold {threshold} MB
        </text>

        {/* area + lines */}
        <path d={areaPath} fill="url(#pg-mem-fill)" aria-hidden="true" />
        <path
          d={latPath}
          fill="none"
          stroke="#67e8f9"
          strokeWidth={1.4}
          strokeOpacity={0.65}
          strokeLinecap="round"
          aria-hidden="true"
        />
        <path
          d={memPath}
          fill="none"
          stroke="#ff7a6b"
          strokeWidth={2.2}
          strokeLinecap="round"
          aria-hidden="true"
        />

        {/* active turn */}
        <line
          x1={activeX}
          x2={activeX}
          y1={padT}
          y2={height - padB}
          stroke="rgba(182,168,255,0.7)"
          strokeDasharray="3 4"
          aria-hidden="true"
        />
        <text
          x={activeX + 5}
          y={padT + 10}
          className="pg-chart__active-label"
          aria-hidden="true"
        >
          t{activeTurn + 1}
        </text>

        {/* anomaly leader */}
        <line
          x1={x(16)}
          y1={yMem(metrics[16]?.mem ?? 0)}
          x2={x(16) + 14}
          y2={padT + 18}
          stroke="rgba(255,122,107,0.55)"
          aria-hidden="true"
        />
        <text
          x={x(16) + 18}
          y={padT + 14}
          className="pg-chart__anomaly-label"
          aria-hidden="true"
        >
          +38 MB / sample
        </text>

        {/* hover crosshair */}
        {sample && hover !== null && (
          <g aria-hidden="true">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padT}
              y2={height - padB}
              stroke="rgba(237,239,245,0.35)"
            />
            <circle
              cx={x(hover)}
              cy={yMem(sample.mem)}
              r={3.2}
              fill="#ff7a6b"
              stroke="#05060a"
              strokeWidth={1.2}
            />
            <circle
              cx={x(hover)}
              cy={yLat(sample.latency)}
              r={2.6}
              fill="#67e8f9"
              stroke="#05060a"
              strokeWidth={1}
            />
            <g transform={`translate(${tooltipX}, ${padT + 4})`}>
              <rect
                width={tooltipWidth}
                height={52}
                rx={6}
                fill="rgba(11,13,20,0.96)"
                stroke="rgba(255,255,255,0.14)"
              />
              <text x={9} y={17} className="pg-chart__tip-strong">
                t{sample.turn + 1} · {sample.mem} MB
              </text>
              <text x={9} y={33} className="pg-chart__tip">
                {sample.latency} ms p95 · {sample.cpu}% cpu
              </text>
              <text x={9} y={46} className="pg-chart__tip">
                {sample.errors} errors
              </text>
            </g>
          </g>
        )}

        {/* hit area */}
        <rect
          x={padL}
          y={padT}
          width={width - padL - padR}
          height={height - padT - padB}
          fill="transparent"
          onPointerMove={updateHover}
          onPointerLeave={() => {
            setHover(null);
            lastTurn.current = null;
          }}
          onClick={(event) => {
            const index = indexFromEvent(
              event.clientX,
              event.currentTarget,
            );
            onSelectTurn?.(metrics[index]?.turn ?? 0);
          }}
          style={{ cursor: "crosshair" }}
        />
      </svg>
    </div>
  );
}
