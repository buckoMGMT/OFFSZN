// Stat engine for All-SZN advanced analytics.
// Benchmarks are NCAA-style generic HS athlete thresholds: [p25, p50, p75, p90].
export const BENCHMARKS = {
  bench_press_lbs: { label: "Bench Press", steps: [95, 135, 185, 225], lowerIsBetter: false },
  squat_lbs: { label: "Squat", steps: [135, 185, 245, 315], lowerIsBetter: false },
  deadlift_lbs: { label: "Deadlift", steps: [155, 225, 295, 365], lowerIsBetter: false },
  mile_time_seconds: { label: "Mile Time", steps: [540, 480, 420, 360], lowerIsBetter: true },
};

export function percentileFor(statKey, value) {
  const b = BENCHMARKS[statKey];
  if (!b || value == null) return null;
  const pcts = [25, 50, 75, 90];
  const better = (v, step) => (b.lowerIsBetter ? v <= step : v >= step);
  let pct = 10;
  for (let i = 0; i < b.steps.length; i++) {
    if (better(value, b.steps[i])) pct = pcts[i] + (i === 3 ? 5 : 0);
  }
  return Math.min(pct, 99);
}

const QUALITY = { poor: 0.4, fair: 0.6, good: 0.8, excellent: 1 };

// Readiness-to-Train: sleep duration (50%) + sleep quality (30%) + recovery load (20%).
export function readinessScore(logs) {
  if (!logs || logs.length === 0) return null;
  const recent = logs.slice(0, 3);
  const sleepAvg = recent.reduce((s, l) => s + Math.min((l.sleep_hours || 6.5) / 8, 1), 0) / recent.length;
  const qualityAvg = recent.reduce((s, l) => s + (QUALITY[l.sleep_quality] ?? 0.7), 0) / recent.length;
  const workoutDays = recent.filter(l => l.workout_complete).length;
  const loadScore = workoutDays >= 3 ? 0.7 : 1; // 3 straight training days → nudge toward recovery
  return Math.round((sleepAvg * 0.5 + qualityAvg * 0.3 + loadScore * 0.2) * 100);
}

// Linear trend over dated points; projects value at +monthsAhead months.
export function projectTrend(points, monthsAhead = 6) {
  if (!points || points.length < 2) return null;
  const xs = points.map(p => new Date(p.date).getTime());
  const ys = points.map(p => p.value);
  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - xMean) * (ys[i] - yMean); den += (xs[i] - xMean) ** 2; }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  const futureX = Date.now() + monthsAhead * 30 * 24 * 3600 * 1000;
  return { projectedValue: Math.round((slope * futureX + intercept) * 10) / 10, futureDate: new Date(futureX) };
}