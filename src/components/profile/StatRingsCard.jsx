// Two customizable progress rings on the Stats tab.
// The athlete picks which two metrics show via the gear → sheet.
// Every option maps to REAL data already on the athlete/today's log —
// no invented fields, no dead options. Choices persist in localStorage.
import { useState } from "react";
import { Settings as SettingsIcon, X, Check } from "lucide-react";
import StatRing from "@/components/ui/StatRing";
import useSheetBack from "@/lib/useSheetBack";

// All ring options. Each computes {value, max, label} from live data.
// `available(ctx)` hides options the athlete has no data/goal for yet.
const RING_OPTIONS = [
  {
    id: "today_calories",
    label: "Today's Calories",
    available: (c) => c.goalCals > 0,
    compute: (c) => ({ value: c.eaten, max: c.goalCals, label: "Today's Calories" }),
  },
  {
    id: "today_protein",
    label: "Today's Protein",
    available: (c) => c.goalProtein > 0,
    compute: (c) => ({ value: c.proteinEaten, max: c.goalProtein, label: "Today's Protein" }),
  },
  {
    id: "today_water",
    label: "Today's Water",
    available: (c) => c.waterGoal > 0,
    compute: (c) => ({ value: c.waterOz, max: c.waterGoal, label: "Today's Water" }),
  },
  {
    id: "goal_weight",
    label: "Goal Weight",
    // Minor-safety: goal weight never shows for minors or coaches.
    available: (c) => c.showGoalWeight,
    compute: (c) => ({ value: c.goalWeightPct, max: 100, label: "Goal Weight" }),
  },
  {
    id: "szn_streak",
    label: "SZN Streak",
    available: () => true,
    compute: (c) => ({ value: c.streak, max: 30, label: "SZN Streak" }),
  },
  {
    id: "next_tier",
    label: "To Next Tier",
    available: () => true,
    compute: (c) => ({ value: c.points % 1000, max: 1000, label: "To Next Tier" }),
  },
];

function defaultsFor(ctx) {
  const first = ctx.goalCals > 0 ? "today_calories" : "szn_streak";
  const second = ctx.showGoalWeight ? "goal_weight" : "next_tier";
  return [first, second];
}

export default function StatRingsCard({ athlete, todayLog, startWeight, isMinorUser, isCoach }) {
  const ctx = {
    goalCals: athlete.goal_calories || 0,
    eaten: todayLog?.calories_consumed || 0,
    goalProtein: athlete.goal_protein_g || 0,
    proteinEaten: todayLog?.protein_g || 0,
    waterGoal: athlete.water_goal_oz || 0,
    waterOz: todayLog?.water_oz || 0,
    streak: athlete.current_streak_days || 0,
    points: athlete.total_points || 0,
    showGoalWeight: !isCoach && !isMinorUser && athlete.goal_weight_lbs > 0
      && athlete.weight_lbs > 0 && startWeight != null,
    goalWeightPct: (() => {
      if (isCoach || isMinorUser || !(athlete.goal_weight_lbs > 0) || startWeight == null) return 0;
      const total = Math.abs(athlete.goal_weight_lbs - startWeight);
      const done = Math.abs(athlete.weight_lbs - startWeight);
      return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    })(),
  };

  const options = RING_OPTIONS.filter((o) => o.available(ctx));
  const optionIds = options.map((o) => o.id);

  const [picks, setPicks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pb_stat_rings") || "null");
      if (Array.isArray(saved) && saved.length === 2 && saved.every((id) => optionIds.includes(id))) return saved;
    } catch { /* fall through */ }
    return defaultsFor(ctx);
  });
  const [showPicker, setShowPicker] = useState(false);
  useSheetBack(showPicker, () => setShowPicker(false));

  const savePicks = (next) => {
    setPicks(next);
    localStorage.setItem("pb_stat_rings", JSON.stringify(next));
  };

  // Toggle a metric: keep exactly two selected (replace the oldest when a third is tapped).
  const toggle = (id) => {
    if (picks.includes(id)) {
      if (picks.length <= 1) return; // never drop below one
      savePicks(picks.filter((p) => p !== id));
    } else {
      const next = picks.length >= 2 ? [picks[1], id] : [...picks, id];
      savePicks(next);
    }
  };

  const rings = picks
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean)
    .map((o) => o.compute(ctx));

  return (
    <div className="card-base p-4 relative">
      <button
        onClick={() => setShowPicker(true)}
        aria-label="Customize rings"
        className="absolute top-2 right-2 p-2 rounded-full"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
      >
        <SettingsIcon size={13} style={{ color: "var(--text-secondary)" }} />
      </button>

      <div className="flex items-center justify-around">
        {rings.map((r, i) => (
          <StatRing key={i} value={r.value} max={r.max} label={r.label} size={88} />
        ))}
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowPicker(false)}>
          <div
            className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up max-h-[70vh] overflow-y-auto p-5"
            style={{ background: "var(--surface-0)", borderColor: "var(--border-subtle)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-anton text-lg uppercase" style={{ color: "var(--text-primary)" }}>Your Rings</h2>
              <button onClick={() => setShowPicker(false)} className="p-1.5 rounded" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                <X size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
            <p className="font-work text-xs mb-4" style={{ color: "var(--text-secondary)" }}>Pick the two you want to track up top.</p>
            <div className="space-y-2">
              {options.map((o) => {
                const on = picks.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(o.id)}
                    className="w-full flex items-center justify-between rounded border p-3 text-left"
                    style={{ background: "var(--surface-1)", borderColor: on ? "var(--accent)" : "var(--border-subtle)" }}
                  >
                    <span className="font-elite text-xs uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>{o.label}</span>
                    {on && <Check size={16} style={{ color: "var(--accent)" }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}