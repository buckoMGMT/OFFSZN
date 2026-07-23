// §2 — Manual "Log a workout" with zero program/integration. Type + duration +
// optional notes → DailyLog (workout_complete) + capped points via completeWorkout.
import { useState } from "react";
import { X } from "lucide-react";
import useSheetBack from "@/lib/useSheetBack";
import { completeWorkout } from "@/lib/points";

const TYPES = ["Lift", "Conditioning", "Skills", "Practice", "Speed / Agility", "Recovery", "Other"];

export default function ManualWorkoutModal({ open, onClose, athlete, onSaved }) {
  useSheetBack(open, onClose);
  const [type, setType] = useState("Lift");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const save = async () => {
    if (!athlete || saving) return;
    setSaving(true);
    const title = notes.trim() ? `${type} — ${notes.trim()}` : type;
    const r = await completeWorkout(athlete, title, Number(duration) || null);
    setSaving(false);
    onSaved?.(r);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-strong)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>Log a Workout</h2>
          <button onClick={onClose} className="p-2 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <p className="eyebrow mb-2">Type</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)}
              className="px-3 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={type === t
                ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }
                : { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {t}
            </button>
          ))}
        </div>

        <p className="eyebrow mb-2">Duration (minutes)</p>
        <input type="number" inputMode="numeric" className="input-base mb-4" placeholder="e.g. 45"
          value={duration} onChange={e => setDuration(e.target.value)} />

        <p className="eyebrow mb-2">Notes (optional)</p>
        <textarea className="input-base resize-none mb-5" style={{ height: 72, padding: '12px 16px', minHeight: 'auto' }}
          maxLength={280} placeholder="What'd you hit?" value={notes} onChange={e => setNotes(e.target.value)} />

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "Logging…" : "Log It · +25 pts"}
        </button>
      </div>
    </div>
  );
}