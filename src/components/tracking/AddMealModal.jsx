import { useState } from "react";
import { X, Camera, Sparkles, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const MEAL_TIMES = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];

export default function AddMealModal({ onClose, onSaved, athleteId, logId, isPremium }) {
  const [form, setForm] = useState({
    name: "", calories: "", protein_g: "", carbs_g: "", fats_g: "",
    meal_time: "lunch", scan_source: "manual", estimated_cost_usd: "",
  });
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [prompt, setPrompt] = useState("");

  const scanFood = async () => {
    if (!isPremium) return;
    setScanning(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a sports nutrition AI. Estimate macros for this food: "${prompt}". Return JSON with: name, calories (number), protein_g (number), carbs_g (number), fats_g (number), estimated_cost_usd (number, budget meal price). Be accurate for a high school athlete.`,
      response_json_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fats_g: { type: "number" },
          estimated_cost_usd: { type: "number" },
        }
      }
    });
    setForm(prev => ({ ...prev, ...result, scan_source: "ai_scan" }));
    setScanMode(false);
    setScanning(false);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-barlow font-bold text-foreground uppercase">Log Meal</h2>
          <button onClick={onClose} className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* AI Scan Toggle */}
        <button
          onClick={() => isPremium ? setScanMode(!scanMode) : null}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border mb-4 transition-all ${
            isPremium ? "border-primary/40 bg-primary/10 hover:bg-primary/20" : "border-border bg-secondary/50 opacity-60"
          }`}
        >
          {isPremium ? <Sparkles size={18} className="text-primary" /> : <Lock size={18} className="text-muted-foreground" />}
          <span className={`font-barlow font-bold uppercase text-sm tracking-wide ${isPremium ? "text-primary" : "text-muted-foreground"}`}>
            {isPremium ? "AI Food Scanner" : "AI Scanner — Premium Only"}
          </span>
        </button>

        {scanMode && isPremium && (
          <div className="mb-4 p-4 bg-primary/10 rounded-xl border border-primary/30">
            <p className="text-xs text-muted-foreground mb-2 font-barlow uppercase tracking-wide">Describe your meal or food</p>
            <input
              className="w-full bg-secondary rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none mb-3"
              placeholder="e.g. Grilled chicken breast with rice..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <button
              onClick={scanFood}
              disabled={scanning || !prompt.trim()}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-barlow font-bold uppercase text-sm tracking-wide disabled:opacity-50"
            >
              {scanning ? "Analyzing..." : "Scan & Fill Macros"}
            </button>
          </div>
        )}

        <div className="space-y-3">
          <input
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Meal name *"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <select
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
            value={form.meal_time}
            onChange={e => setForm(p => ({ ...p, meal_time: e.target.value }))}
          >
            {MEAL_TIMES.map(t => (
              <option key={t} value={t}>{t.replace("_", " ").toUpperCase()}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Calories *" type="number" value={form.calories}
              onChange={e => setForm(p => ({ ...p, calories: e.target.value }))} />
            <input className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Protein (g)" type="number" value={form.protein_g}
              onChange={e => setForm(p => ({ ...p, protein_g: e.target.value }))} />
            <input className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Carbs (g)" type="number" value={form.carbs_g}
              onChange={e => setForm(p => ({ ...p, carbs_g: e.target.value }))} />
            <input className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Fats (g)" type="number" value={form.fats_g}
              onChange={e => setForm(p => ({ ...p, fats_g: e.target.value }))} />
          </div>
          <input
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Estimated cost ($)"
            type="number"
            value={form.estimated_cost_usd}
            onChange={e => setForm(p => ({ ...p, estimated_cost_usd: e.target.value }))}
          />
        </div>

        <button
          onClick={save}
          disabled={saving || !form.name || !form.calories}
          className="w-full mt-6 gradient-gold text-primary-foreground py-4 rounded-2xl font-barlow font-bold uppercase text-lg tracking-widest gold-glow disabled:opacity-50 transition-all"
        >
          {saving ? "Saving..." : "Log Meal"}
        </button>
      </div>
    </div>
  );
}