export default function StatRing({ value, max, label, color = "#F5C518", size = 80 }) {
  const pct = Math.min((value / max) * 100, 100);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="hsla(240,6%,16%,1)" strokeWidth={6}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-barlow font-bold text-foreground">
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-barlow">{label}</span>
    </div>
  );
}