import { useState } from "react";
import { X, Zap, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import useSheetBack from "@/lib/useSheetBack";

const MEAL_TIMES = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];

const QUICK_FOODS = [
  { name: "Grilled Chicken Breast", calories: 165, protein_g: 31, carbs_g: 0, fats_g: 3.6 },
  { name: "White Rice (1 cup)", calories: 206, protein_g: 4, carbs_g: 45, fats_g: 0.4 },
  { name: "Eggs (2 large)", calories: 143, protein_g: 13, carbs_g: 1, fats_g: 10 },
  { name: "Protein Shake", calories: 160, protein_g: 30, carbs_g: 8, fats_g: 2 },
  { name: "Oatmeal (1 cup)", calories: 166, protein_g: 6, carbs_g: 28, fats_g: 4 },
  { name: "Banana", calories: 89, protein_g: 1, carbs_g: 23, fats_g: 0.3 },
  { name: "Greek Yogurt (6oz)", calories: 100, protein_g: 17, carbs_g: 6, fats_g: 0.7 },
  { name: "Peanut Butter (2 tbsp)", calories: 188, protein_g: 8, carbs_g: 6, fats_g: 16 },
  { name: "Sweet Potato", calories: 103, protein_g: 2, carbs_g: 24, fats_g: 0.1 },
  { name: "Almonds (1 oz)", calories: 164, protein_g: 6, carbs_g: 6, fats_g: 14 },
  { name: "Salmon (4 oz)", calories: 208, protein_g: 29, carbs_g: 0, fats_g: 10 },
  { name: "Whole Milk (1 cup)", calories: 149, protein_g: 8, carbs_g: 12, fats_g: 8 },
  { name: "Ground Beef 80/20 (4oz)", calories: 287, protein_g: 19, carbs_g: 0, fats_g: 23 },
  { name: "Bread (2 slices)", calories: 160, protein_g: 6, carbs_g: 30, fats_g: 2 },
];

export default function AddMealModal({ onClose, onSaved, athleteId, logId }) {
  const [form, setForm] = useState({
    name: "", calories: "", protein_g: "", carbs_g: "", fats_g: "",
    meal_time: "lunch", scan_source: "manual", estimated_cost_usd: "",
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  // Dock hides while this sheet owns the screen; back gesture closes the sheet
  useSheetBack(true, onClose);

  const filtered = search.length > 0
    ? QUICK_FOODS.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : QUICK_FOODS;

  const quickFill = (food) => {
    setForm(p => ({
      ...p,
      name: food.name,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fats_g: food.fats_g,
    }));
    setSearch("");
  };

  const save = async () => {
    if (!form.name || !form.calories) return;
    setSaving(true);
    await base44.entities.Meal.create({
      ...form,
      athlete_id: athleteId,
      daily_log_id: logId,
      calories: Number(form.calories),
      protein_g: Number(form.protein_g) || 0,
      carbs_g: Number(form.carbs_g) || 0,
      fats_g: Number(form.fats_g) || 0,
      estimated_cost_usd: Number(form.estimated_cost_usd) || 0,
      date: format(new Date(), "yyyy-MM-dd"),
    });
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border animate-slide-up flex flex-col" style={{ height: '92dvh' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-2xl font-barlow font-bold text-foreground uppercase tracking-wide">Log Meal</h2>
          <button onClick={onClose} className="p-2 rounded-xl bg-secondary text-muted-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">

        {/* Quick Search */}
        <div className="mb-4">
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-4 py-3 mb-3">
            <Search size={14} className="text-muted-foreground flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Search common athlete foods…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {filtered.slice(0, 8).map(food => (
              <button
                key={food.name}
                onClick={() => quickFill(food)}
                className="flex-shrink-0 flex flex-col items-start px-3 py-2 bg-secondary border border-border rounded-xl text-left hover:border-primary/50 transition-all"
              >
                <span className="text-xs font-medium text-foreground whitespace-nowrap">{food.name}</span>
                <span className="text-[10px] font-mono text-primary tabular-nums">{food.calories} kcal · {food.protein_g}g P</span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-barlow uppercase tracking-widest text-muted-foreground">Or Enter Manually</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <input
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
            placeholder="Meal name *"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          {/* Meal-time chips — matches the app's chip language instead of a raw <select> */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {MEAL_TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(p => ({ ...p, meal_time: t }))}
                className="flex-shrink-0 px-3 py-2 rounded-full font-elite text-[10px] uppercase tracking-widest transition-all"
                style={{
                  background: form.meal_time === t ? 'var(--accent-subtle)' : 'var(--surface-2)',
                  border: form.meal_time === t ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  color: form.meal_time === t ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {t.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* Macro Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Calories", field: "calories", unit: "kcal" },
              { label: "Protein", field: "protein_g", unit: "g" },
              { label: "Carbs", field: "carbs_g", unit: "g" },
              { label: "Fats", field: "fats_g", unit: "g" },
            ].map(({ label, field, unit }) => (
              <div key={field} className="bg-secondary border border-border rounded-xl px-3 py-2.5">
                <span className="text-[9px] font-barlow uppercase tracking-widest text-muted-foreground block mb-1">{label}</span>
                <div className="flex items-baseline gap-1">
                  <input
                    className="flex-1 bg-transparent text-base font-mono font-semibold text-foreground outline-none w-full tabular-nums"
                    placeholder="0"
                    type="number"
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  />
                  <span className="text-[10px] text-muted-foreground font-mono">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        </div>
        {/* Sticky confirm — always visible, never scrolled out of reach */}
        <div className="flex-shrink-0 px-6 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', background: 'var(--surface-1)' }}>
          <button
            onClick={save}
            disabled={saving || !form.name || !form.calories}
            className="btn-primary w-full"
          >
            {saving ? "Logging…" : "Log Meal"}
          </button>
        </div>
      </div>
    </div>
  );
}