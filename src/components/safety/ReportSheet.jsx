// Shared report sheet — used on posts, comments, drills, and profiles.
// Routing, escalation, and rate limiting all happen server-side (submitReport).
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Flag, ShieldCheck } from "lucide-react";
import { validate, reportNoteSchema } from "@/lib/validators";

const REASONS = [
  ["inappropriate_sexual", "Inappropriate or sexual content"],
  ["harassment", "Harassment or bullying"],
  ["violence", "Violence or dangerous behavior"],
  ["spam_scam", "Spam or scam"],
  ["minor_safety", "Safety concern involving a minor"],
  ["under_13", "This user is under 13"],
  ["other", "Other"],
];

export default function ReportSheet({ open, onClose, targetType, targetId, targetName, commentIndex }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const close = () => { setReason(null); setNote(""); setError(null); setDone(false); onClose?.(); };

  const submit = async () => {
    if (!reason) { setError("Pick a reason"); return; }
    const r = validate(reportNoteSchema, note);
    if (r.error) { setError(r.error); return; }
    setError(null); setSubmitting(true);
    try {
      await base44.functions.invoke("submitReport", {
        targetType, targetId, reason, note: r.value || undefined,
        ...(commentIndex != null ? { commentIndex } : {}),
      });
      setDone(true);
    } catch (e) {
      setError(e.response?.data?.error || "Couldn't send the report. Try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={close}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-5 animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>

        {done ? (
          <div className="text-center py-8">
            <ShieldCheck size={32} className="mx-auto mb-3" style={{ color: 'var(--positive)' }} />
            <h2 className="font-anton text-lg uppercase mb-1" style={{ color: 'var(--text-primary)' }}>Reported.</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>We review every one.</p>
            <button onClick={close} className="btn-secondary w-full">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="font-anton text-base uppercase" style={{ color: 'var(--text-primary)' }}>
                  Report{targetName ? ` ${targetName}` : ""}
                </h2>
              </div>
              <button onClick={close} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
                <X size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {REASONS.map(([v, l]) => (
                <button key={v} onClick={() => { setReason(v); setError(null); }}
                  className="w-full text-left px-4 py-3 rounded font-work text-sm"
                  style={reason === v
                    ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }
                    : { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  {l}
                </button>
              ))}
            </div>

            <textarea
              className="input-base resize-none mb-1"
              style={{ height: 72, padding: '10px 14px', minHeight: 'auto', fontSize: 'var(--text-sm)' }}
              placeholder="Anything else we should know? (optional)"
              maxLength={500}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <p className="text-[10px] text-right mb-2" style={{ color: 'var(--text-tertiary)' }}>{note.length}/500</p>

            {error && <p className="text-sm mb-3" style={{ color: 'var(--negative)' }}>{error}</p>}

            <button onClick={submit} disabled={submitting} className="btn-primary w-full">
              {submitting ? "Sending…" : "Submit Report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}