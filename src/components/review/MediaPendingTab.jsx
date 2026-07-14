// Tab 1 — pending media, oldest first. Approve or Reject with a reason category.
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

const REJECT_REASONS = ["Inappropriate content", "Safety concern", "Spam", "Off-topic", "Community guidelines"];

export default function MediaPendingTab({ items, act }) {
  const [rejecting, setRejecting] = useState(null); // item id
  const [busy, setBusy] = useState(null);

  const run = async (payload) => { setBusy(payload.id); await act(payload); setBusy(null); setRejecting(null); };

  if (items.length === 0) return <p className="text-sm text-center py-10" style={{ color: 'var(--text-tertiary)' }}>No media waiting for review.</p>;

  return (
    <div className="space-y-3">
      {items.map(m => (
        <div key={m.id} className="card-base overflow-hidden">
          {m.media_url && <img src={m.media_url} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              {m.author_avatar && <img src={m.author_avatar} alt="" className="w-6 h-6 rounded-full object-cover" />}
              <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{m.author_name}</p>
              {m.is_minor && (
                <span className="font-elite text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--warning)', border: '1px solid var(--warning)' }}>Minor</span>
              )}
              <span className="font-elite text-[8px] uppercase tracking-widest ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                {m.kind} · {formatDistanceToNow(new Date(m.created_date), { addSuffix: true })}
              </span>
            </div>
            {m.text && <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{m.text}</p>}

            {rejecting === m.id ? (
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASONS.map(r => (
                  <button key={r} disabled={busy === m.id}
                    onClick={() => run({ action: "rejectMedia", kind: m.kind, id: m.id, reason: r })}
                    className="px-2.5 py-1.5 rounded font-elite text-[9px] uppercase tracking-wide"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
                    {r}
                  </button>
                ))}
                <button onClick={() => setRejecting(null)} className="px-2.5 py-1.5 font-elite text-[9px] uppercase" style={{ color: 'var(--text-tertiary)' }}>Cancel</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={busy === m.id}
                  onClick={() => run({ action: "approveMedia", kind: m.kind, id: m.id })}
                  className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
                  style={{ background: 'var(--positive)', color: '#0A0B0D' }}>
                  {busy === m.id ? "…" : "Approve"}
                </button>
                <button onClick={() => setRejecting(m.id)}
                  className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}