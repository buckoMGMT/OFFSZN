// Tab 3 — flagged accounts. Unflag clears the flag + throttle.
import { useState } from "react";
import { format } from "date-fns";

export default function FlaggedTab({ items, act }) {
  const [busy, setBusy] = useState(null);
  if (items.length === 0) return <p className="text-sm text-center py-10" style={{ color: 'var(--text-tertiary)' }}>No flagged accounts.</p>;

  return (
    <div className="space-y-3">
      {items.map(a => (
        <div key={a.id} className="card-base p-3">
          <div className="flex items-center gap-2 mb-1">
            {a.avatar_url && <img src={a.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />}
            <p className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.display_name}</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Reason: {a.flagged_reason || "—"}</p>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Flagged {a.flagged_at ? format(new Date(a.flagged_at), "MMM d, yyyy") : "—"}
            {a.throttle_until && ` · throttled until ${format(new Date(a.throttle_until), "MMM d")}`}
          </p>
          <div className="flex gap-2">
            <button disabled={busy === a.id}
              onClick={async () => { setBusy(a.id); await act({ action: "unflag", athleteId: a.id }); setBusy(null); }}
              className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--positive)', color: '#0A0B0D' }}>
              {busy === a.id ? "…" : "Unflag"}
            </button>
            <button className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
              Keep Flagged
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}