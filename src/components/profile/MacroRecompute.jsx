// Goals-tab recompute — uses the SAME macro engine as onboarding (§6).
// Minor floors apply on every recompute.
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { computeTargets, ageFromDob } from "@/lib/macroEngine";

export default function MacroRecompute({ athlete, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const recompute = async () => {
    setBusy(true); setMsg(null);
    const me = await base44.auth.me();
    const age = ageFromDob(me?.date_of_birth);
    const t = computeTargets({
      weightLbs: athlete.weight_lbs,
      heightInches: athlete.height_inches,
      age,
      sex: athlete.biological_sex || "unspecified",
      trainingDays: athlete.training_days_per_week ?? 4,
      goals: athlete.training_goals || [],
      isMinor: age !== null && age < 18,
    });
    if (!t) {
      setMsg("Add your weight, height, and date of birth first.");
      setBusy(false);
      return;
    }
    const { estimate, clamped, ...fields } = t;
    const updated = await base44.entities.Athlete.update(athlete.id, fields);
    onUpdate?.(updated);
    setMsg(clamped
      ? "Updated — these numbers look low. Talk to a coach, parent, or doctor before changing how you eat."
      : `Updated: ${fields.goal_calories.toLocaleString()} cal · ${fields.goal_protein_g}g protein${estimate ? " (estimate)" : ""}.`);
    setBusy(false);
  };

  return (
    <div className="rounded border p-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-border)" }}>
      <button onClick={recompute} disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest"
        style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: busy ? 0.6 : 1 }}>
        <RefreshCw size={12} /> {busy ? "Recalculating…" : "Recalculate my targets"}
      </button>
      <p className="text-xs mt-2" style={{ color: msg?.includes("low") ? "var(--warning)" : "var(--text-tertiary)" }}>
        {msg || "Recomputes calories and macros from your current weight, height, training days, and goals."}
      </p>
    </div>
  );
}