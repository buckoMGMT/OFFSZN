import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Droplets, Moon, Scale, CheckCircle, Circle } from "lucide-react";
import { format } from "date-fns";
import StatRing from "@/components/ui/StatRing";
import MacroBar from "@/components/tracking/MacroBar";
import MealCard from "@/components/tracking/MealCard";
import AddMealModal from "@/components/tracking/AddMealModal";
import DailyChallenges from "@/components/tracking/DailyChallenges";

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
          athlete_id: a.id,
          date: today,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-barlow font-bold text-foreground uppercase">Daily Track</h1>
            <p className="text-xs text-muted-foreground font-barlow uppercase tracking-widest">{format(new Date(), "EEEE, MMMM d")}</p>
          </div>
          <button
            onClick={() => setShowAddMeal(true)}
            className="flex items-center gap-2 gradient-gold text-primary-foreground px-4 py-2.5 rounded-xl font-barlow font-bold uppercase text-sm gold-glow"
          >
            <Plus size={16} />
            Log Meal
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Calorie Ring + Macros */}
        <div className="gradient-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-6 mb-5">
            <StatRing value={log?.calories_consumed || 0} max={calGoal} label="Calories" size={96} />
            <div className="flex-1">
              <p className="text-3xl font-barlow font-bold text-foreground">
                {Math.round(log?.calories_consumed || 0)}
                <span className="text-lg text-muted-foreground font-normal">/{calGoal}</span>
              </p>
              <p className="text-xs text-muted-foreground font-barlow uppercase tracking-wide mt-0.5">Calories today</p>
              <p className="text-sm text-primary font-barlow font-bold mt-1">
                {Math.max(0, calGoal - (log?.calories_consumed || 0))} remaining
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <MacroBar label="Protein" consumed={log?.protein_g || 0} goal={proteinGoal} color="protein" />
            <MacroBar label="Carbs" consumed={log?.carbs_g || 0} goal={carbsGoal} color="carbs" />
            <MacroBar label="Fats" consumed={log?.fats_g || 0} goal={fatsGoal} color="fats" />
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Water */}
          <div className="gradient-card border border-border rounded-2xl p-4">
            <Droplets size={20} className="text-blue-400 mb-2" />
            <p className="text-2xl font-barlow font-bold text-foreground">{log?.water_oz || 0}</p>
            <p className="text-[10px] text-muted-foreground font-barlow uppercase tracking-wide">oz water</p>
            <div className="flex gap-1 mt-2">
              <button onClick={() => updateLog({ water_oz: (log?.water_oz || 0) + 8 })}
                className="flex-1 bg-blue-500/20 text-blue-400 rounded-lg py-1 text-xs font-barlow font-bold">+8oz</button>
            </div>
          </div>

          {/* Sleep */}
          <div className="gradient-card border border-border rounded-2xl p-4">
            <Moon size={20} className="text-purple-400 mb-2" />
            <p className="text-2xl font-barlow font-bold text-foreground">{log?.sleep_hours || "--"}</p>
            <p className="text-[10px] text-muted-foreground font-barlow uppercase tracking-wide">hrs sleep</p>
            <div className="flex gap-1 mt-2">
              {["6", "7", "8", "9"].map(h => (
                <button
                  key={h}
                  onClick={() => updateLog({ sleep_hours: Number(h) })}
                  className={`flex-1 rounded-lg py-1 text-[10px] font-barlow font-bold transition-colors ${
                    log?.sleep_hours === Number(h) ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Workout */}
          <div className="gradient-card border border-border rounded-2xl p-4">
            <button onClick={() => updateLog({ workout_complete: !log?.workout_complete })} className="w-full h-full flex flex-col items-start">
              {log?.workout_complete
                ? <CheckCircle size={20} className="text-green-400 mb-2" />
                : <Circle size={20} className="text-muted-foreground mb-2" />
              }
              <p className="text-2xl font-barlow font-bold text-foreground">
                {log?.workout_complete ? "Done" : "No"}
              </p>
              <p className="text-[10px] text-muted-foreground font-barlow uppercase tracking-wide">workout</p>
            </button>
          </div>
        </div>

        {/* Weight Log */}
        <div className="gradient-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={18} className="text-primary" />
              <span className="text-sm font-barlow font-bold text-foreground uppercase">Today's Weight</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <input
              type="number"
              className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-foreground text-sm outline-none"
              placeholder="Enter lbs..."
              value={log?.weight_lbs || ""}
              onChange={e => updateLog({ weight_lbs: Number(e.target.value) || null })}
            />
            <span className="text-sm text-muted-foreground font-barlow">lbs</span>
            {athlete?.goal_weight_lbs && (
              <span className="text-xs text-primary font-barlow font-bold">Goal: {athlete.goal_weight_lbs}</span>
            )}
          </div>
        </div>

        <DailyChallenges log={log} athlete={athlete} />

        {/* Meals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-barlow font-bold text-foreground uppercase">Meals Logged</h2>
            <span className="text-xs text-muted-foreground">{meals.length} items</span>
          </div>
          {meals.length === 0 ? (
            <div className="gradient-card border border-dashed border-border rounded-2xl p-8 text-center">
              <p className="text-muted-foreground text-sm">No meals logged yet today.</p>
              <p className="text-muted-foreground text-xs mt-1">Tap "Log Meal" to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-2">
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
          isPremium={athlete.subscription_tier === "premium"}
        />
      )}
    </div>
  );
}