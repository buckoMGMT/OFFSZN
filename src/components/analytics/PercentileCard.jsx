// Athletic percentile mapping — lifts & mile vs NCAA-style benchmarks.
import { BENCHMARKS, percentileFor } from "@/lib/statEngine";

export default function PercentileCard({ athlete }) {
  const rows = Object.entries(BENCHMARKS)
    .map(([key, b]) => ({ key, label: b.label, pct: percentileFor(key, athlete[key]) }))
    .filter(r => r.pct !== null);

  return (
    <div className="card-base p-4">
      <p className="eyebrow mb-3">Percentile vs NCAA-Style Benchmarks{athlete.position ? ` — ${athlete.position}` : ""}</p>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Add your maxes in the Strength section to see where you rank.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                <span className="tabular-nums text-xs font-semibold" style={{ color: r.pct >= 75 ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {r.pct}th percentile
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 75 ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}