// Points + workout completion — ALL point awards route through the pointsGuard
// backend function (300/day cap, one door, one guard).
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export async function awardPointsSafely(athleteId, points, reason) {
  const res = await base44.functions.invoke("pointsGuard", { athleteId, points, reason });
  return res.data; // { awarded, capped, remainingToday }
}

// Marks today's workout done: DailyLog entry + capped points + SZN streak advance.
export async function completeWorkout(athlete, programTitle, durationMinutes) {
  const today = format(new Date(), "yyyy-MM-dd");
  const logs = await base44.entities.DailyLog.filter({ athlete_id: athlete.id, date: today });
  const log = logs[0];
  const firstWorkoutToday = !log?.workout_complete;

  const { awarded } = await awardPointsSafely(athlete.id, 25, `workout: ${programTitle}`);

  const note = `Workout: ${programTitle} (${durationMinutes || "--"} min)`;
  const fields = {
    workout_complete: true,
    streak_day: true,
    notes: log?.notes ? `${log.notes}\n${note}` : note,
    points_earned: (log?.points_earned || 0) + awarded,
  };
  if (log) await base44.entities.DailyLog.update(log.id, fields);
  else await base44.entities.DailyLog.create({ athlete_id: athlete.id, date: today, ...fields });

  let streak = athlete.current_streak_days || 0;
  if (firstWorkoutToday) {
    streak += 1;
    await base44.entities.Athlete.update(athlete.id, { current_streak_days: streak });
  }
  return { awarded, streak };
}