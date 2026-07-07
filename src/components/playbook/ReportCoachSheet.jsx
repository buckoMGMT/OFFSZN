// Safety reporting flow — files a CoachReport for trust-and-safety review.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";

const REASONS = [
  { id: "minor_safety", label: "Safety concern involving a minor" },
  { id: "inappropriate_behavior", label: "Inappropriate behavior or messages" },
  { id: "scam_or_fraud", label: "Scam, fraud, or payment issue" },
  { id: "impersonation", label: "Fake or impersonated account" },
  { id: "other", label: "Something else" },
];

export default function ReportCoachSheet({ open, onClose, coach }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!open || !coach) return null;

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    const me = (await base44.entities.Athlete.list("-created_date", 1))[0];
    await base44.entities.CoachReport.create({
      reporter_athlete_id: me?.id || "unknown",
      coach_athlete_id: coach.id,
      coach_name: coach.display_name,
      reason,
      details: details.trim(),
    });
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up p-5"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} style={{ color: 'var(--negative)' }} />
            <h2 className="font-anton text-sm uppercase" style={{ color: 'var(--text-primary)' }}>Report {coach.display_name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: 'var(--positive)' }} />
            <p className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Report submitted</p>
            <p className="font-work text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Our trust &amp; safety team reviews every report. Reports involving minors are prioritized.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {REASONS.map(r => (
                <button key={r.id} onClick={() => setReason(r.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg font-work text-sm"
                  style={reason === r.id
                    ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }
                    : { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  {r.label}
                </button>
              ))}
            </div>
            <textarea className="input-base resize-none mb-4" style={{ height: 80, paddingTop: 10 }}
              placeholder="Add details (optional but helpful)"
              value={details} onChange={e => setDetails(e.target.value)} />
            <button onClick={submit} disabled={!reason || submitting}
              className="w-full py-3 rounded font-elite text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--negative)', color: '#fff', opacity: !reason || submitting ? 0.5 : 1 }}>
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}