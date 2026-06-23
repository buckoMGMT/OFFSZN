import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Droplets, Moon, Scale, CheckCircle, Circle, Zap } from "lucide-react";
import { format } from "date-fns";
import StatRing from "@/components/ui/StatRing";
import MacroBar from "@/components/tracking/MacroBar";
import MealCard from "@/components/tracking/MealCard";
import AddMealModal from "@/components/tracking/AddMealModal";
import DailyChallenges from "@/components/tracking/DailyChallenges";
import AppleHealthBanner from "@/components/tracking/AppleHealthBanner";

export default function Track() {
  const [athlete, setAthlete] = useState(null);
  const [log, setLog] = useState(null);
  const [meals, setMeals] = useState([]);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(async () => {
    const athletes = await base44.entities.Athlete.list("-created_date", 1);
    const a = athletes[0] || null;
    setAthlete(a);

    if (a) {
      const logs = await base44.entities.DailyLog.filter({ athlete_id: a.id, date: today });
      let todayLog = logs[0];
      if (!todayLog) {
        todayLog = await base44.entities.DailyLog.create({
          athlete_id: a.id, date: today,
          calories_consumed: 0, protein_g: 0, carbs_g: 0, fats_g: 0,
          water_oz: 0, workout_complete: false,
        });
      }
      setLog(todayLog);
      const todayMeals = await base44.entities.Meal.filter({ athlete_id: a.id, date: today });
      setMeals(todayMeals);
    }
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const updateLog = async (fields) => {
    if (!log) return;
    const updated = await base44.entities.DailyLog.update(log.id, fields);
    setLog(updated);
  };

  const deleteMeal = async (mealId) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal || !log) return;
    await base44.entities.Meal.delete(mealId);
    await base44.entities.DailyLog.update(log.id, {
      calories_consumed: Math.max(0, (log.calories_consumed || 0) - meal.calories),
      protein_g: Math.max(0, (log.protein_g || 0) - (meal.protein_g || 0)),
      carbs_g: Math.max(0, (log.carbs_g || 0) - (meal.carbs_g || 0)),
      fats_g: Math.max(0, (log.fats_g || 0) - (meal.fats_g || 0)),
    });
    load();
  };

  const onMealSaved = async () => {
    const todayMeals = await base44.entities.Meal.filter({ athlete_id: athlete.id, date: today });
    const totals = todayMeals.reduce((acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein: acc.protein + (m.protein_g || 0),
      carbs: acc.carbs + (m.carbs_g || 0),
      fats: acc.fats + (m.fats_g || 0),
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
    await base44.entities.DailyLog.update(log.id, {
      calories_consumed: totals.calories,
      protein_g: totals.protein,
      carbs_g: totals.carbs,
      fats_g: totals.fats,
    });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const calGoal = athlete?.goal_calories || 2500;
  const proteinGoal = athlete?.goal_protein_g || 150;
  const carbsGoal = athlete?.goal_carbs_g || 300;
  const fatsGoal = athlete?.goal_fats_g || 80;
  const cal = log?.calories_consumed || 0;
  const remaining = Math.max(0, calGoal - cal);
  const waterPct = Math.min(100, ((log?.water_oz || 0) / 128) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-barlow font-bold text-foreground uppercase tracking-wide">Stats</h1>
            <p className="text-[11px] text-muted-foreground font-mono">{format(new Date(), "EEE, MMM d")}</p>
          </div>
          <button
            onClick={() => setShowAddMeal(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-barlow font-bold uppercase tracking-wide green-glow transition-all active:scale-95"
          >
            <Plus size={15} /> Log Meal
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <AppleHealthBanner log={log} onSync={(data) => updateLog(data)} />

        {/* Main Calorie Dashboard */}
        <div className="bg-card border border-border rounded-2xl p-5 elevation-1">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-barlow uppercase tracking-widest text-muted-foreground mb-1">Calories Today</p>
              <p className="text-4xl font-mono font-bold text-foreground tabular-nums leading-none">
                {Math.round(cal).toLocaleString()}
              </p>
              <p className="text-[11px] font-mono text-muted-foreground mt-1 tabular-nums">
                {remaining.toLocaleString()} remaining of {calGoal.toLocaleString()}
              </p>
            </div>
            <StatRing
              value={cal}
              max={calGoal}
              size={96}
              color="hsl(145,100%,39%)"
            />
          </div>
          <div className="space-y-3.5">
            <MacroBar label="Protein" consumed={log?.protein_g || 0} goal={proteinGoal} color="protein" />
            <MacroBar label="Carbs" consumed={log?.carbs_g || 0} goal={carbsGoal} color="carbs" />
            <MacroBar label="Fats" consumed={log?.fats_g || 0} goal={fatsGoal} color="fats" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Water */}
          <div className="bg-card border border-border rounded-2xl p-3.5 elevation-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Droplets size={13} className="text-blue-400" />
              <span className="text-[9px] font-barlow uppercase tracking-widest text-muted-foreground">Hydration</span>
            </div>
            <p className="text-2xl font-mono font-bold text-foreground tabular-nums leading-none">{log?.water_oz || 0}</p>
            <p className="text-[9px] font-mono text-muted-foreground mb-2.5">oz / 128</p>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${waterPct}%` }} />
            </div>
            <button
              onClick={() => updateLog({ water_oz: (log?.water_oz || 0) + 8 })}
              className="w-full bg-secondary text-muted-foreground rounded-lg py-1.5 text-[10px] font-barlow font-bold uppercase tracking-wide hover:text-foreground transition-colors"
            >
              +8 oz
            </button>
          </div>

          {/* Sleep */}
          <div className="bg-card border border-border rounded-2xl p-3.5 elevation-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Moon size={13} className="text-purple-400" />
              <span className="text-[9px] font-barlow uppercase tracking-widest text-muted-foreground">Sleep</span>
            </div>
            <p className="text-2xl font-mono font-bold text-foreground tabular-nums leading-none">{log?.sleep_hours || "--"}</p>
            <p className="text-[9px] font-mono text-muted-foreground mb-2.5">hours</p>
            <div className="flex gap-0.5">
              {["7", "8", "9"].map(h => (
                <button key={h}
                  onClick={() => updateLog({ sleep_hours: Number(h) })}
                  className={`flex-1 rounded-md py-1 text-[9px] font-mono font-semibold transition-colors ${
                    log?.sleep_hours === Number(h)
                      ? "bg-purple-500 text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}>{h}h</button>
              ))}
            </div>
          </div>

          {/* Workout */}
          <div className="bg-card border border-border rounded-2xl p-3.5 elevation-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={13} className={log?.workout_complete ? "text-primary" : "text-muted-foreground"} />
              <span className="text-[9px] font-barlow uppercase tracking-widest text-muted-foreground">Workout</span>
            </div>
            <button
              onClick={() => updateLog({ workout_complete: !log?.workout_complete })}
              className="w-full flex flex-col items-start"
            >
              <p className="text-2xl font-mono font-bold leading-none mb-2.5">
                {log?.workout_complete
                  ? <span className="text-primary">✓</span>
                  : <span className="text-muted-foreground">–</span>
                }
              </p>
              <div className={`w-full py-1.5 rounded-lg text-[10px] font-barlow font-bold uppercase tracking-wide text-center transition-all ${
                log?.workout_complete
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {log?.workout_complete ? "Done" : "Log It"}
              </div>
            </button>
          </div>
        </div>

        {/* Weight */}
        <div className="bg-card border border-border rounded-2xl p-4 elevation-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Scale size={14} className="text-muted-foreground" />
              <span className="text-sm font-barlow font-bold uppercase tracking-wide text-foreground">Body Weight</span>
            </div>
            {athlete?.goal_weight_lbs && (
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                Goal: {athlete.goal_weight_lbs} lbs
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground font-mono text-base font-semibold outline-none focus:border-primary/40 transition-colors tabular-nums"
              placeholder="0"
              value={log?.weight_lbs || ""}
              onChange={e => updateLog({ weight_lbs: Number(e.target.value) || null })}
            />
            <span className="text-sm font-mono text-muted-foreground">lbs</span>
          </div>
        </div>

        <DailyChallenges log={log} athlete={athlete} />

        {/* Meals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-barlow font-bold uppercase tracking-wide text-foreground">Meals</h2>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{meals.length} logged</span>
          </div>
          {meals.length === 0 ? (
            <button
              onClick={() => setShowAddMeal(true)}
              className="w-full border border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/40 transition-colors"
            >
              <p className="text-muted-foreground text-sm">No meals logged yet.</p>
              <p className="text-primary text-xs font-barlow font-bold uppercase tracking-wide mt-1">Tap to Log Meal →</p>
            </button>
          ) : (
            <div className="space-y-2.5">
              {meals.map(meal => (
                <MealCard key={meal.id} meal={meal} onDelete={deleteMeal} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddMeal && athlete && (
        <AddMealModal
          onClose={() => setShowAddMeal(false)}
          onSaved={onMealSaved}
          athleteId={athlete.id}
          logId={log?.id}
        />
      )}
    </div>
  );
}