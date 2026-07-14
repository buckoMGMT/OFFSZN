// Tab 2 — user reports + coach reports. Critical pins to top with red border.
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

const REASON_LABELS = {
  inappropriate_sexual: "Inappropriate or sexual content", harassment: "Harassment or bullying",
  violence: "Violence or dangerous behavior", spam_scam: "Spam or scam",
  minor_safety: "Safety concern involving a minor", under_13: "User under 13",
  inappropriate_behavior: "Inappropriate behavior", scam_or_fraud: "Scam or fraud",
  impersonation: "Impersonation", other: "Other",
};

const ACTIONS = [
  ["dismiss", "Dismiss"],
  ["remove_content", "Remove content"],
  ["flag_account", "Flag account"],
  ["escalate", "Escalate"],
];

export default function ReportsTab({ items, act }) {
  const [busy, setBusy] = useState(null);
  const run = async (payload) => { setBusy(payload.id); await act(payload); setBusy(null); };

  if (items.length === 0) return <p className="text-sm text-center py-10" style={{ color: 'var(--text-tertiary)' }}>No open reports.</p>;

  const ordinal = (n) => `${n}${["th","st","nd","rd"][((n%100)-20)%10] || ["th","st","nd","rd"][n%100] || "th"}`;

  return (
    <div className="space-y-3">
      {items.map(r => (
        <div key={r.id} className="card-base p-3"
          style={r.severity === "critical" ? { borderLeft: '3px solid var(--negative)' } : {}}>
          <div className="flex items-center gap-2 mb-1">
            {r.severity === "critical" && (
              <span className="font-elite text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{ background: 'var(--negative)', color: '#fff' }}>Critical</span>
            )}
            <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {REASON_LABELS[r.reason] || r.reason}
            </p>
            <span className="font-elite text-[8px] uppercase tracking-widest ml-auto" style={{ color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(new Date(r.created_date), { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            Target: <span style={{ color: 'var(--text-primary)' }}>{r.target_name}</span> ({r.target_type})
            {r.prior_count > 1 && (
              <span style={{ color: 'var(--warning)' }}> · {ordinal(r.prior_count)} report on this user</span>
            )}
          </p>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Reported by {r.reporter_name}</p>
          {r.note && <p className="text-xs italic mb-2 px-2 py-1.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>"{r.note}"</p>}
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map(([d, l]) => (
              <button key={d} disabled={busy === r.id}
                onClick={() => run({ action: "reportAction", kind: r.kind, id: r.id, decision: d })}
                className="px-2.5 py-1.5 rounded font-elite text-[9px] uppercase tracking-wide"
                style={d === "dismiss"
                  ? { background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }
                  : { background: 'var(--surface-2)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
                {busy === r.id ? "…" : l}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}