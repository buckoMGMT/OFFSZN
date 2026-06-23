export default function StatRing({ value, max, label, size = 100, color = "hsl(145,100%,39%)" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const strokeWidth = 7;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const displayValue = value >= 10000
    ? `${(value / 1000).toFixed(1)}k`
    : Math.round(value);

  const fontSize = size >= 100 ? 22 : size >= 80 ? 17 : 14;
  const subSize = size >= 80 ? 9 : 8;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="hsla(211,38%,22%,1)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-700"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold text-foreground leading-none tabular-nums"
            style={{ fontSize }}
          >
            {displayValue}
          </span>
          <span
            className="font-mono text-muted-foreground tabular-nums"
            style={{ fontSize: subSize }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-barlow">
          {label}
        </span>
      )}
    </div>
  );
}