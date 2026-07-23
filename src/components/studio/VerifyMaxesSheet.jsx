// Coach-side max verification — pick the lifts you've personally seen this
// subscriber hit. The verifyMaxes function enforces everything server-side
// (verified coach + active paid subscription).
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, ShieldCheck, Check } from "lucide-react";
import useSheetBack from "@/lib/useSheetBack";
import { hapticSuccess } from "@/lib/native";

const FIELDS = [
  { key: "bench_press_lbs", label: "Bench Press", fmt: v => `${v} lbs` },
  { key: "squat_lbs", label: "Squat", fmt: v => `${v} lbs` },
  { key: "deadlift_lbs", label: "Deadlift", fmt: v => `${v} lbs` },
  { key: "mile_time_seconds", label: "Mile Time", fmt: v => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}` },
  { key: "forty_yd_seconds", label: "40-Yard Dash", fmt: v => `${v}s` },
  { key: "vertical_jump_inches", label: "Vertical Jump", fmt: v => `${v}"` },
];

export default function VerifyMaxesSheet({ open, onClose, subscriber }) {
  const [target, setTarget] = useState(null);
  const [selected, setSelected] = useState([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  useSheetBack(open, onClose);

  useEffect(() => {
    if (!open || !subscriber) return;
    setTarget(null); setSelected([]); setMessage("");
    base44.entities.Athlete.filter({ id: subscriber.athlete_id }, "-created_date", 1)
      .then(l => setTarget(l[0] || null))
      .catch(() => setTarget(null));
  }, [open, subscriber?.athlete_id]);

  const submit = async () => {
    setWorking(true);
    setMessage("");
    try {
      const res = await base44.functions.invoke("verifyMaxes", { athleteId: subscriber.athlete_id, fields: selected });
      const n = (res.data?.verified || []).length;
      if (n > 0) hapticSuccess();
      setMessage(n > 0 ? `Verified ${n} max${n === 1 ? "" : "es"} — the shield is live on their card.` : "Nothing to verify — those fields have no logged values.");
      setSelected([]);
    } catch (e) {
      setMessage(e?.response?.data?.message || "Couldn't verify right now — try again.");
    } finally {
      setWorking(false);
    }
  };

  if (!open || !subscriber) return null;
  const available = target ? FIELDS.filter(f => typeof target[f.key] === "number" && target[f.key] > 0) : [];

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up p-5 max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-anton text-lg uppercase" style={{ color: 'var(--text-primary)' }}>Verify Maxes</h2>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <p className="font-work text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          {subscriber.display_name} — check only the numbers you've personally watched them hit. Your name backs every shield.
        </p>

        {!target ? (
          <div className="space-y-2 mb-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--r-md)' }} />)}
          </div>
        ) : available.length === 0 ? (
          <p className="font-work text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            They haven't logged any maxes yet — nothing to verify.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {available.map(f => {
              const on = selected.includes(f.key);
              return (
                <button key={f.key} onClick={() => setSelected(prev => on ? prev.filter(k => k !== f.key) : [...prev, f.key])}
                  className="w-full flex items-center justify-between rounded border px-4 py-3 text-left"
                  style={{ background: on ? 'var(--accent-subtle)' : 'var(--surface-1)', borderColor: on ? 'var(--accent)' : 'var(--border-subtle)' }}>
                  <div>
                    <p className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
                    <p className="tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>{f.fmt(target[f.key])}</p>
                  </div>
                  {on
                    ? <Check size={16} style={{ color: 'var(--accent)' }} />
                    : <ShieldCheck size={15} style={{ color: 'var(--text-tertiary)' }} />}
                </button>
              );
            })}
          </div>
        )}

        {message && <p className="text-xs text-center mb-3" style={{ color: 'var(--text-secondary)' }}>{message}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={working || selected.length === 0}>
          <ShieldCheck size={14} /> {working ? "Verifying…" : `Verify ${selected.length || ""} Selected`}
        </button>
      </div>
    </div>
  );
}