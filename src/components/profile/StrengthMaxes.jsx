import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dumbbell } from "lucide-react";

const LIFTS = [
  { key: "bench_press_lbs", label: "Bench Press", unit: "lbs" },
  { key: "squat_lbs", label: "Squat", unit: "lbs" },
  { key: "deadlift_lbs", label: "Deadlift", unit: "lbs" },
  { key: "mile_time_seconds", label: "Mile Time", unit: "min", isTime: true },
];

function secondsToTime(s) {
  if (!s) return "--";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function timeToSeconds(str) {
  const parts = str.split(":");
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return parseInt(str) || 0;
}

export default function StrengthMaxes({ athlete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    bench_press_lbs: athlete?.bench_press_lbs || "",
    squat_lbs: athlete?.squat_lbs || "",
    deadlift_lbs: athlete?.deadlift_lbs || "",
    mile_time_seconds: athlete?.mile_time_seconds ? secondsToTime(athlete.mile_time_seconds) : "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const data = {
      bench_press_lbs: form.bench_press_lbs ? Number(form.bench_press_lbs) : null,
      squat_lbs: form.squat_lbs ? Number(form.squat_lbs) : null,
      deadlift_lbs: form.deadlift_lbs ? Number(form.deadlift_lbs) : null,
      mile_time_seconds: form.mile_time_seconds ? timeToSeconds(form.mile_time_seconds) : null,
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
        {LIFTS.map(({ key, label, unit, isTime }) => (
          <div key={key} className="bg-secondary rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            {editing ? (
              <input
                type={isTime ? "text" : "number"}
                placeholder={isTime ? "5:30" : "0"}
                className="w-full bg-transparent text-lg font-bold text-foreground outline-none"
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
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