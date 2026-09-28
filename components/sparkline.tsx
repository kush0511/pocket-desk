type Series = { values: number[]; color: string; width?: number; opacity?: number; dashed?: boolean };

export function Sparkline({
  series,
  className,
  fill,
}: {
  series: Series[];
  className?: string;
  fill?: string;
}) {
  const all = series.flatMap((s) => s.values);
  if (all.length < 2) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const W = 100;
  const H = 40;
  const toPoints = (values: number[]) =>
    values.map((v, i) => [(i / (values.length - 1)) * W, H - ((v - min) / span) * (H - 4) - 2]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      {series.map((s, idx) => {
        const pts = toPoints(s.values);
        const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
        return (
          <g key={idx}>
            {fill && idx === 0 && (
              <path d={`${d} L${W},${H} L0,${H} Z`} fill={fill} stroke="none" />
            )}
            <path
              d={d}
              fill="none"
              stroke={s.color}
              strokeOpacity={s.opacity ?? 1}
              strokeWidth={s.width ?? 1.6}
              strokeDasharray={s.dashed ? "3 3" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
