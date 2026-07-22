import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dumbbell } from "lucide-react";

const LIFTS = [
  { key: "bench_press_lbs", label: "Bench Press", unit: "lbs" },
  { key: "squat_lbs", label: "Squat", unit: "lbs" },
  { key: "deadlift_lbs", label: "Deadlift", unit: "lbs" },
  { key: "mile_time_seconds", label: "Mile Time", unit: "min", isTime: true },
  { key: "forty_yd_seconds", label: "40-Yard Dash", unit: "sec", isDecimal: true },
  { key: "vertical_jump_inches", label: "Vertical Jump", unit: "in", isDecimal: true },
];

function secondsToTime(s) {
  if (!s) return "--";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function timeToSeconds(str) {
  const parts = str.split(":");
  // Time math: no value over 59 exists — clamp minutes AND seconds to 59
  if (parts.length === 2) return Math.min(59, parseInt(parts[0]) || 0) * 60 + Math.min(59, parseInt(parts[1]) || 0);
  return Math.min(59, parseInt(str) || 0);
}

export default function StrengthMaxes({ athlete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    bench_press_lbs: athlete?.bench_press_lbs || "",
    squat_lbs: athlete?.squat_lbs || "",
    deadlift_lbs: athlete?.deadlift_lbs || "",
    mile_time_seconds: athlete?.mile_time_seconds ? secondsToTime(athlete.mile_time_seconds) : "",
    forty_yd_seconds: athlete?.forty_yd_seconds || "",
    vertical_jump_inches: athlete?.vertical_jump_inches || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const data = {
      bench_press_lbs: form.bench_press_lbs ? Number(form.bench_press_lbs) : null,
      squat_lbs: form.squat_lbs ? Number(form.squat_lbs) : null,
      deadlift_lbs: form.deadlift_lbs ? Number(form.deadlift_lbs) : null,
      mile_time_seconds: form.mile_time_seconds ? timeToSeconds(form.mile_time_seconds) : null,
      forty_yd_seconds: form.forty_yd_seconds ? Number(form.forty_yd_seconds) : null,
      vertical_jump_inches: form.vertical_jump_inches ? Number(form.vertical_jump_inches) : null,
    };
    await base44.entities.Athlete.update(athlete.id, data);
    setEditing(false);
    setSaving(false);
    if (onUpdate) onUpdate();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Dumbbell size={15} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Strength Maxes</h3>
        </div>
        <button
          onClick={() => editing ? save() : setEditing(true)}
          disabled={saving}
          className="text-xs text-primary font-medium"
        >
          {editing ? (saving ? "Saving…" : "Save") : "Edit"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {LIFTS.map(({ key, label, unit, isTime, isDecimal }) => (
          <div key={key} className="bg-secondary rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            {editing ? (
              <input
                type={isTime ? "text" : "number"}
                inputMode={isTime ? "numeric" : "decimal"}
                step={isDecimal ? "0.1" : undefined}
                placeholder={isTime ? "5:30" : isDecimal ? "0.0" : "0"}
                className="w-full bg-transparent text-lg font-bold text-foreground outline-none"
                value={form[key]}
                onChange={e => {
                  let v = e.target.value;
                  if (isTime) {
                    // Auto-format: digits only, colon before the last two (530 → 5:30).
                    // No value over 59 exists in time — minutes and seconds clamp at 59.
                    const digits = v.replace(/\D/g, "").slice(0, 4);
                    if (digits.length > 2) {
                      const mins = Math.min(59, parseInt(digits.slice(0, -2)) || 0);
                      const secs = Math.min(59, parseInt(digits.slice(-2)) || 0);
                      v = `${mins}:${String(secs).padStart(2, "0")}`;
                    } else {
                      v = digits;
                    }
                  }
                  setForm(p => ({ ...p, [key]: v }));
                }}
              />
            ) : (
              <p className="text-lg font-bold text-foreground">
                {isTime
                  ? secondsToTime(athlete?.[key])
                  : (athlete?.[key] ? `${athlete[key]}` : "--")}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">{unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}