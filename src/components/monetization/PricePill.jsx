// Coach-priced treatment: surface-2 price pill + verified coach name.
// NO ribbon, NO lock — coach content is never Pass-gated.
// If an item carries both flags, the price pill wins (warning logged).
import { BadgeCheck } from "lucide-react";

export default function PricePill({ price, coachName, alsoPassLocked = false }) {
  if (alsoPassLocked) {
    console.warn(`[monetization] Item priced by coach "${coachName}" also carries a Pass-lock flag — price pill wins per three-lane rules.`);
  }
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="tabular-nums text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
      >
        {price}
      </span>
      {coachName && (
        <span className="flex items-center gap-1 font-elite text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {coachName}
          <BadgeCheck size={11} style={{ color: 'var(--accent)' }} />
        </span>
      )}
    </div>
  );
}