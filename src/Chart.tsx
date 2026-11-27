import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { formatValue, type Observation } from "../shared/model";

export function Spark({
  points,
  positive,
}: {
  points: Observation[];
  positive: boolean;
}) {
  if (points.length < 2) return <span className="muted">—</span>;
  const values = points.map((p) => p.value),
    min = Math.min(...values),
    max = Math.max(...values);
  const path = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i / (values.length - 1)) * 86).toFixed(1)},${(24 - ((v - min) / (max - min || 1)) * 20).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      className={`spark ${positive ? "up" : "down"}`}
      viewBox="0 0 90 28"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
export function HistoryChart({
  points,
  precision,
  unit,
}: {
  points: Observation[];
  precision: number;
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, entry.contentRect.width)),
    );
    resize.observe(element);
    return () => resize.disconnect();
  }, [points.length]);
  if (!points.length)
    return (
      <div className="chart-empty">
        <span>暂无这段时间的历史数据</span>
        <small>选择更长的时间范围，或等待数据采集。</small>
      </div>
    );
  const values = points.map((p) => p.value),
    low = Math.min(...values),
    high = Math.max(...values);
  const pad = (high - low || Math.abs(high) * 0.02 || 1) * 0.15;
  const min = low - pad,
    max = high + pad;
  const w = width,
    h = 225,
    left = 8,
    right = 88,
    top = 12,
    bottom = 30;
  const x = (i: number) =>
    left +
    (points.length === 1 ? 0.5 : i / (points.length - 1)) * (w - left - right);
  const y = (v: number) => top + ((max - v) / (max - min)) * (h - top - bottom);
  const path = points
    .map(
      (p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`,
    )
    .join(" ");
  const current = Math.max(
    0,
    Math.min(hover ?? points.length - 1, points.length - 1),
  );
  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  return (
    <div className="history-chart" ref={container}>
      <div className="chart-readout">
        <span>{points[current].date}</span>
        <strong>
          {formatValue(points[current].value, precision)} <small>{unit}</small>
        </strong>
        <span>{hover == null ? "收盘 / 发布值" : "历史观测"}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${points[0].date} 至 ${points.at(-1)!.date} 的历史趋势，共 ${points.length} 条记录`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const fraction =
            (((event.clientX - bounds.left) / bounds.width) * w - left) /
            (w - left - right);
          setHover(
            Math.max(
              0,
              Math.min(
                points.length - 1,
                Math.round(fraction * (points.length - 1)),
              ),
            ),
          );
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".14" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={w - right + 8}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--rule)"
              strokeDasharray="3 5"
            />
            <text x={w - right + 18} y={y(value) + 4} className="chart-axis">
              {formatValue(value, precision > 2 ? 3 : 1)}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path
            d={`${path} L${x(points.length - 1)},${h - bottom} L${x(0)},${h - bottom} Z`}
            fill={`url(#${id})`}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line
          x1={x(current)}
          x2={x(current)}
          y1={top}
          y2={h - bottom}
          stroke="var(--muted)"
          strokeDasharray="3 4"
          opacity={hover == null ? 0 : 0.6}
        />
        <circle
          cx={x(current)}
          cy={y(points[current].value)}
          r="3.5"
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth="2"
        />
        <text x={left} y={h - 5} className="chart-axis">
          {points[0].date.slice(2)}
        </text>
        {points.length > 1 && (
          <text x={w - right} y={h - 5} textAnchor="end" className="chart-axis">
            {points.at(-1)!.date.slice(2)}
          </text>
        )}
      </svg>
      <input
        className="chart-slider"
        style={{
          // A range thumb travels inside its own width. Extend each end by
          // half the thumb so its center shares the SVG plot's x coordinates.
          "--plot-left": `${left}px`,
          "--plot-right": `${right}px`,
        } as CSSProperties}
        type="range"
        min={0}
        max={Math.max(points.length - 1, 1)}
        step={points.length === 1 ? 0.5 : 1}
        value={points.length === 1 ? 0.5 : current}
        disabled={points.length === 1}
        onChange={(e) => setHover(Number(e.target.value))}
        aria-label="选择历史观测日期"
        aria-valuetext={`${points[current].date}，${points[current].value} ${unit}`}
      />
    </div>
  );
}
