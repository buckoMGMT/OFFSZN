// Tab 4 — user feedback, filterable by category, new → reviewed → done.
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

const CATEGORIES = ["all", "bug", "idea", "confusing", "other"];
const NEXT = { new: "reviewed", reviewed: "done", done: "new" };

export default function FeedbackTab({ items, act }) {
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState(null);
  const filtered = cat === "all" ? items : items.filter(f => (f.category || "other") === cat);

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className="px-2.5 py-1 rounded font-elite text-[9px] uppercase tracking-widest"
            style={cat === c
              ? { background: 'var(--accent)', color: 'var(--on-accent)' }
              : { background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            {c}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <p className="text-sm text-center py-10" style={{ color: 'var(--text-tertiary)' }}>No feedback here.</p>
        : (
          <div className="space-y-2">
            {filtered.map(f => (
              <div key={f.id} className="card-base p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-elite text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    {f.category || "other"}
                  </span>
                  <span className="font-elite text-[8px] uppercase tracking-widest ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                    {formatDistanceToNow(new Date(f.created_date), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{f.message}</p>
                <button disabled={busy === f.id}
                  onClick={async () => { setBusy(f.id); await act({ action: "feedbackStatus", id: f.id, status: NEXT[f.status || "new"] }); setBusy(null); }}
                  className="px-2.5 py-1 rounded font-elite text-[9px] uppercase tracking-widest"
                  style={f.status === "done"
                    ? { color: 'var(--positive)', border: '1px solid var(--positive)' }
                    : f.status === "reviewed"
                      ? { color: 'var(--warning)', border: '1px solid var(--warning)' }
                      : { color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                  {f.status || "new"} → {NEXT[f.status || "new"]}
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}