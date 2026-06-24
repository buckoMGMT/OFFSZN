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

// Stopwatch-face macro ring — steel bezel, red fill arc, Special Elite numerals
function StopwatchRing({ value, max, label, size = 110 }) {
  const pct = Math.min(1, (value || 0) / (max || 1));
  const r = (size - 14) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Steel bezel */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle cx={center} cy={center} r={center - 2} fill="none" stroke="#9BA3AC" strokeWidth="3" />
          <circle cx={center} cy={center} r={center - 6} fill="#EDEEF0" />
          {/* Tick marks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
            const x1 = center + (center - 9) * Math.cos(angle);
            const y1 = center + (center - 9) * Math.sin(angle);
            const x2 = center + (center - 14) * Math.cos(angle);
            const y2 = center + (center - 14) * Math.sin(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9BA3AC" strokeWidth="1.5" />;
          })}
          {/* Track */}
          <circle cx={center} cy={center} r={r} fill="none" stroke="#DCDEE1" strokeWidth="7" />
          {/* Fill arc — red */}
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke="#D7263D"
            strokeWidth="7"
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        {/* Center numerals */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <span className="font-elite" style={{ fontSize: size < 100 ? 15 : 19, color: '#15151A', lineHeight: 1 }}>
            {value >= 1000 ? `${(value/1000).toFixed(1)}k` : Math.round(value)}
          </span>
          <span className="font-elite" style={{ fontSize: 8, color: '#9BA3AC', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{label}</span>
    </div>
  );
}

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

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: '#EDEEF0' }}>
      <PlayDiagram size={150} />
      <p className="font-elite text-xs mt-4" style={{ color: '#5A5D63' }}>Loading stats…</p>
    </div>
  );

  const calGoal = athlete?.goal_calories || 2500;
  const proteinGoal = athlete?.goal_protein_g || 150;
  const carbsGoal = athlete?.goal_carbs_g || 300;
  const fatsGoal = athlete?.goal_fats_g || 80;
  const cal = log?.calories_consumed || 0;
  const remaining = Math.max(0, calGoal - cal);
  const waterPct = Math.min(100, ((log?.water_oz || 0) / 128) * 100);

  return (
    <div className="min-h-screen" style={{ background: '#EDEEF0', color: '#15151A' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-12 pb-4 border-b" style={{ background: '#EDEEF0', borderColor: '#9BA3AC' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-anton text-3xl uppercase" style={{ color: '#15151A' }}>Stats</h1>
            <p className="font-elite text-[10px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{format(new Date(), "EEE, MMM d")}</p>
          </div>
          <div className="flex items-center gap-3">
            <PageLabel number={2} />
            <StampButton onClick={() => setShowAddMeal(true)}>
              <Plus size={13} /> Log Meal
            </StampButton>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <AppleHealthBanner log={log} onSync={(data) => updateLog(data)} />

        {/* Main Calorie Dashboard — stopwatch rings */}
        <div className="rounded border p-5" style={{ background: '#DCDEE1', borderColor: '#9BA3AC', boxShadow: '1px 2px 6px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>Calories Today</p>
              <p className="font-anton text-4xl" style={{ color: '#15151A' }}>{Math.round(cal).toLocaleString()}</p>
              <p className="font-elite text-[10px]" style={{ color: '#5A5D63' }}>{remaining.toLocaleString()} remaining of {calGoal.toLocaleString()}</p>
            </div>
            <StopwatchRing value={cal} max={calGoal} label="Calories" size={110} />
          </div>

          {/* Macro rings */}
          <div className="flex justify-around pt-3 border-t" style={{ borderColor: '#9BA3AC' }}>
            <StopwatchRing value={log?.protein_g || 0} max={proteinGoal} label="Protein" size={80} />
            <StopwatchRing value={log?.carbs_g || 0} max={carbsGoal} label="Carbs" size={80} />
            <StopwatchRing value={log?.fats_g || 0} max={fatsGoal} label="Fats" size={80} />
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Water */}
          <div className="rounded border p-3" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
            <div className="flex items-center gap-1 mb-2">
              <Droplets size={12} style={{ color: '#5E646B' }} />
              <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>Water</span>
            </div>
            <p className="font-anton text-2xl" style={{ color: '#15151A' }}>{log?.water_oz || 0}</p>
            <p className="font-elite text-[9px]" style={{ color: '#5A5D63' }}>oz / 128</p>
            <div className="h-1 rounded-full my-2 overflow-hidden" style={{ background: '#9BA3AC44' }}>
              <div className="h-full rounded-full" style={{ width: `${waterPct}%`, background: '#D7263D', transition: 'width 0.5s ease' }} />
            </div>
            <button onClick={() => updateLog({ water_oz: (log?.water_oz || 0) + 8 })}
              className="w-full py-1 rounded font-elite text-[9px] uppercase tracking-wide" style={{ background: '#EDEEF0', border: '1px solid #9BA3AC', color: '#5A5D63' }}>
              +8 oz
            </button>
          </div>

          {/* Sleep */}
          <div className="rounded border p-3" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
            <div className="flex items-center gap-1 mb-2">
              <Moon size={12} style={{ color: '#5E646B' }} />
              <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>Sleep</span>
            </div>
            <p className="font-anton text-2xl" style={{ color: '#15151A' }}>{log?.sleep_hours || "--"}</p>
            <p className="font-elite text-[9px] mb-2" style={{ color: '#5A5D63' }}>hours</p>
            <div className="flex gap-0.5">
              {["7", "8", "9"].map(h => (
                <button key={h} onClick={() => updateLog({ sleep_hours: Number(h) })}
                  className="flex-1 rounded py-1 font-elite text-[9px]"
                  style={{
                    background: log?.sleep_hours === Number(h) ? '#D7263D' : '#EDEEF0',
                    color: log?.sleep_hours === Number(h) ? '#fff' : '#5A5D63',
                    border: '1px solid #9BA3AC',
                  }}>
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Workout */}
          <div className="rounded border p-3" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
            <div className="flex items-center gap-1 mb-2">
              <CheckCircle size={12} style={{ color: log?.workout_complete ? '#D7263D' : '#5E646B' }} />
              <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>Workout</span>
            </div>
            <button onClick={() => updateLog({ workout_complete: !log?.workout_complete })} className="w-full text-left">
              <p className="font-anton text-2xl mb-2" style={{ color: log?.workout_complete ? '#D7263D' : '#15151A' }}>
                {log?.workout_complete ? "✓" : "–"}
              </p>
              <div className="w-full py-1 rounded font-elite text-[9px] uppercase text-center" style={{
                background: log?.workout_complete ? '#D7263D' : '#EDEEF0',
                color: log?.workout_complete ? '#fff' : '#5A5D63',
                border: '1px solid #9BA3AC',
              }}>
                {log?.workout_complete ? "Done" : "Log It"}
              </div>
            </button>
          </div>
        </div>

        {/* Weight */}
        <div className="rounded border p-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
          <div className="flex items-center gap-2 mb-3">
            <Scale size={13} style={{ color: '#5E646B' }} />
            <span className="font-elite text-xs uppercase tracking-widest" style={{ color: '#15151A' }}>Body Weight</span>
            {athlete?.goal_weight_lbs && (
              <span className="ml-auto font-elite text-[9px]" style={{ color: '#5A5D63' }}>Goal: {athlete.goal_weight_lbs} lbs</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="flex-1 rounded px-4 py-2.5 font-elite text-base outline-none"
              style={{ background: '#EDEEF0', border: '1px solid #9BA3AC', color: '#15151A' }}
              placeholder="0"
              value={log?.weight_lbs || ""}
              onChange={e => updateLog({ weight_lbs: Number(e.target.value) || null })}
            />
            <span className="font-elite text-sm" style={{ color: '#5A5D63' }}>lbs</span>
          </div>
        </div>

        <DailyChallenges log={log} athlete={athlete} />

        {/* Meals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-anton text-xl uppercase" style={{ color: '#15151A' }}>Meals Logged</h2>
            <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{meals.length} entries</span>
          </div>
          {meals.length === 0 ? (
            <button onClick={() => setShowAddMeal(true)}
              className="w-full border-2 border-dashed rounded py-10 text-center" style={{ borderColor: '#9BA3AC' }}>
              <p className="font-work text-sm mb-2" style={{ color: '#5A5D63' }}>Nothing logged yet.</p>
              <span className="btn-stamp" style={{ display: 'inline-flex' }}>Log First Meal</span>
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