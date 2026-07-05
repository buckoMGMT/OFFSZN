import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Droplets, Moon, Scale, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import MealCard from "@/components/tracking/MealCard";
import AddMealModal from "@/components/tracking/AddMealModal";
import DailyChallenges from "@/components/tracking/DailyChallenges";
import AppleHealthBanner from "@/components/tracking/AppleHealthBanner";
import PageLabel from "@/components/ui/PageLabel";
import StampButton from "@/components/ui/StampButton";
import PlayDiagram from "@/components/ui/PlayDiagram";
import { useMilestoneNotifier } from "@/lib/MilestoneNotifier";

/* §5 Progress rings: 8px stroke, round caps, surface-3 track, accent fill.
   Ring completion ≥100% swaps fill to --positive (the color-shift IS the reward).
   Psychology: Goal gradient — near-complete rings accelerate motivation.
   Numbers in Archivo Black tabular so they never jitter. */
function StopwatchRing({ value, max, label, size = 110 }) {
  const pct = Math.min(1, (value || 0) / (max || 1));
  const strokeWidth = size < 100 ? 6 : 8;
  const r = (size - strokeWidth * 2 - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const center = size / 2;
  // Color-shift moment: completion ≥100% → semantic green (the reward)
  const arcColor = pct >= 1 ? 'var(--positive)' : 'var(--accent)';

  return (
    <div className="flex flex-col items-center" style={{ gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          {/* Track — surface-3 */}
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={strokeWidth}
          />
          {/* Fill arc — accent, animated sweep */}
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: `stroke-dashoffset 0.6s var(--ease-out), stroke 0.3s ease` }}
          />
        </svg>
        {/* Center — Archivo Black tabular numerals */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <span
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontVariantNumeric: 'tabular-nums',
              fontSize: size < 100 ? 'var(--text-base)' : 'var(--text-xl)',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {value >= 1000 ? `${(value/1000).toFixed(1)}k` : Math.round(value)}
          </span>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.625rem',
              color: pct >= 1 ? 'var(--positive)' : 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <span
        className="eyebrow"
        style={{ fontSize: '0.625rem', letterSpacing: '0.1em' }}
      >
        {label}
      </span>
    </div>
  );
}

export default function Track() {
  const { checkMilestones } = useMilestoneNotifier();
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
    if (a) checkMilestones(a);
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
      setMeals(await base44.entities.Meal.filter({ athlete_id: a.id, date: today }));
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
      calories_consumed: totals.calories, protein_g: totals.protein, carbs_g: totals.carbs, fats_g: totals.fats,
    });
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-0)' }}>
        <div className="px-5 pt-16 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 'var(--r-sm)' }} />
        </div>
        <div className="px-5 pt-5 space-y-4">
          <div className="card-base p-5 flex items-center justify-between">
            <div className="space-y-2">
              <div className="skeleton" style={{ width: 80, height: 11 }} />
              <div className="skeleton" style={{ width: 120, height: 44 }} />
              <div className="skeleton" style={{ width: 100, height: 11 }} />
            </div>
            <div className="skeleton" style={{ width: 110, height: 110, borderRadius: '50%' }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="card-base p-3 space-y-2">
                <div className="skeleton" style={{ width: '60%', height: 10 }} />
                <div className="skeleton" style={{ width: '80%', height: 28 }} />
                <div className="skeleton" style={{ width: '100%', height: 6, borderRadius: 'var(--r-full)' }} />
              </div>
            ))}
          </div>
        </div>
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
    <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 pt-12 pb-4 border-b" style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Stats</h1>
            <p className="eyebrow" style={{ marginTop: 2 }}>{format(new Date(), "EEE, MMM d")}</p>
          </div>
          <div className="flex items-center gap-3">
            <PageLabel number={2} />
            <StampButton onClick={() => setShowAddMeal(true)}>
              <Plus size={13} /> Log Meal
            </StampButton>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <AppleHealthBanner log={log} onSync={(data) => updateLog(data)} />

        {/* Main Calorie Dashboard — progress rings */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <div style={{ maxWidth: '55%' }}>
              {/* §3: eyebrow → hero number → context. Number IS the emotional payload. */}
              <p className="eyebrow mb-1">Calories Today</p>
              <p
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 'var(--text-4xl)',
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                }}
              >
                {Math.round(cal).toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
                {remaining.toLocaleString()} left of {calGoal.toLocaleString()}
              </p>
            </div>
            <StopwatchRing value={cal} max={calGoal} label="Calories" size={110} />
          </div>

          {/* Macro rings */}
          <div className="flex justify-around pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <StopwatchRing value={log?.protein_g || 0} max={proteinGoal} label="Protein" size={80} />
            <StopwatchRing value={log?.carbs_g || 0} max={carbsGoal} label="Carbs" size={80} />
            <StopwatchRing value={log?.fats_g || 0} max={fatsGoal} label="Fats" size={80} />
          </div>
        </div>

        {/* Quick stats row — surface-1 cards, no shadows */}
        <div className="grid grid-cols-3 gap-3">
          {/* Water */}
          <div className="card-base p-3">
            <div className="flex items-center gap-1 mb-2">
              <Droplets size={12} style={{ color: 'var(--theme-ink-soft)' }} />
              <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Water</span>
            </div>
            <p className="font-anton text-2xl" style={{ color: 'var(--theme-ink)' }}>{log?.water_oz || 0}</p>
            <p className="font-elite text-[9px]" style={{ color: 'var(--theme-ink-soft)' }}>oz / 128</p>
            <div className="h-1 rounded-full my-2 overflow-hidden" style={{ background: 'var(--theme-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${waterPct}%`,               background: 'var(--accent)', transition: 'width 0.5s ease' }} />
            </div>
            <button onClick={() => updateLog({ water_oz: (log?.water_oz || 0) + 8 })}
              className="w-full py-1 rounded font-elite text-[9px] uppercase tracking-wide" style={{ background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>
              +8 oz
            </button>
          </div>

          {/* Sleep */}
          <div className="rounded border p-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center gap-1 mb-2">
              <Moon size={12} style={{ color: 'var(--theme-ink-soft)' }} />
              <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Sleep</span>
            </div>
            <p className="font-anton text-2xl" style={{ color: 'var(--theme-ink)' }}>{log?.sleep_hours || "--"}</p>
            <p className="font-elite text-[9px] mb-2" style={{ color: 'var(--theme-ink-soft)' }}>hours</p>
            <div className="flex gap-0.5">
              {["7", "8", "9"].map(h => (
                <button key={h} onClick={() => updateLog({ sleep_hours: Number(h) })}
                  className="flex-1 rounded py-1 font-elite text-[9px]"
                  style={{
                    background: log?.sleep_hours === Number(h) ? 'var(--accent)' : 'var(--theme-surface-alt)',
                    color: log?.sleep_hours === Number(h) ? '#0A0B0D' : 'var(--theme-ink-soft)',
                    border: '1px solid var(--theme-border)',
                  }}>
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Workout */}
          <div className="rounded border p-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center gap-1 mb-2">
              <CheckCircle size={12} style={{ color: log?.workout_complete ? 'var(--accent)' : 'var(--theme-ink-soft)' }} />
              <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Workout</span>
            </div>
            <button onClick={() => updateLog({ workout_complete: !log?.workout_complete })} className="w-full text-left">
              <p className="font-anton text-2xl mb-2" style={{ color: log?.workout_complete ? 'var(--accent)' : 'var(--theme-ink)' }}>
                {log?.workout_complete ? "✓" : "–"}
              </p>
              <div className="w-full py-1 rounded font-elite text-[9px] uppercase text-center" style={{
                background: log?.workout_complete ? 'var(--accent)' : 'var(--theme-surface-alt)',
                color: log?.workout_complete ? '#0A0B0D' : 'var(--theme-ink-soft)',
                border: '1px solid var(--theme-border)',
              }}>
                {log?.workout_complete ? "Done" : "Log It"}
              </div>
            </button>
          </div>
        </div>

        {/* Weight */}
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
            <span className="eyebrow">Body Weight</span>
            {athlete?.goal_weight_lbs && (
              <span className="ml-auto" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Goal: {athlete.goal_weight_lbs} lbs
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input-base flex-1"
              style={{ minHeight: 44 }}
              placeholder="0"
              value={log?.weight_lbs || ""}
              onChange={e => updateLog({ weight_lbs: Number(e.target.value) || null })}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontFamily: 'Inter, sans-serif' }}>lbs</span>
          </div>
        </div>

        <DailyChallenges log={log} athlete={athlete} />

        {/* Meals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-xl)', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Meals Logged
            </h2>
            <span className="eyebrow">{meals.length} entries</span>
          </div>
          {meals.length === 0 ? (
            /* §5 EmptyState: athlete-voice copy + action */
            <button
              onClick={() => setShowAddMeal(true)}
              className="w-full text-center py-10"
              style={{ border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)' }}
            >
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Nothing logged. Fix that.
              </p>
              <span className="btn-stamp">Log First Meal</span>
            </button>
          ) : (
            <div className="space-y-2.5">
              {meals.map(meal => <MealCard key={meal.id} meal={meal} onDelete={deleteMeal} />)}
            </div>
          )}
        </div>
      </div>

      {showAddMeal && athlete && (
        <AddMealModal onClose={() => setShowAddMeal(false)} onSaved={onMealSaved} athleteId={athlete.id} logId={log?.id} />
      )}
    </div>
  );
}