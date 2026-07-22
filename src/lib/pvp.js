// 1v1 challenge scoring — same lazy-resolution model as team challenges
// (src/lib/challenges.js) but athlete-vs-athlete on personal total_points.
import { base44 } from "@/api/base44Client";

async function athletePoints(athleteId) {
  const a = await base44.entities.Athlete.filter({ id: athleteId }, "-created_date", 1).then(l => l[0]);
  return a?.total_points || 0;
}

// Create an active 1v1, snapshotting both baselines. Throws "active_exists"
// if these two already have a live challenge in either direction.
export async function createPvpChallenge(me, opponent, durationDays) {
  const [a, b] = await Promise.all([
    base44.entities.PlayerChallenge.filter({ challenger_athlete_id: me.id, opponent_athlete_id: opponent.id, status: "active" }),
    base44.entities.PlayerChallenge.filter({ challenger_athlete_id: opponent.id, opponent_athlete_id: me.id, status: "active" }),
  ]);
  if (a.length || b.length) throw new Error("active_exists");

  const start = new Date();
  const end = new Date(start.getTime() + durationDays * 86400000);
  return base44.entities.PlayerChallenge.create({
    challenger_athlete_id: me.id,
    challenger_name: me.display_name,
    opponent_athlete_id: opponent.id,
    opponent_name: opponent.display_name,
    metric: "points",
    duration_days: durationDays,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    challenger_baseline: me.total_points || 0,
    opponent_baseline: opponent.total_points || 0,
    status: "active",
  });
}

// Live scores = current total_points minus baseline, floored at 0.
export async function livePvpScores(ch) {
  const [cNow, oNow] = await Promise.all([
    athletePoints(ch.challenger_athlete_id),
    athletePoints(ch.opponent_athlete_id),
  ]);
  return {
    challenger: Math.max(0, cNow - (ch.challenger_baseline || 0)),
    opponent: Math.max(0, oNow - (ch.opponent_baseline || 0)),
  };
}

// Freeze final scores + winner once the window closes. Idempotent.
export async function resolvePvpIfEnded(ch) {
  if (ch.status !== "active") return ch;
  if (new Date(ch.end_date) > new Date()) return ch;

  // Re-read so two clients don't both resolve.
  const fresh = await base44.entities.PlayerChallenge.filter({ id: ch.id }, "-created_date", 1).then(l => l[0]);
  if (!fresh || fresh.status !== "active") return fresh || ch;

  const { challenger, opponent } = await livePvpScores(ch);
  const winnerId =
    challenger === opponent ? null
    : challenger > opponent ? ch.challenger_athlete_id
    : ch.opponent_athlete_id;

  return base44.entities.PlayerChallenge.update(ch.id, {
    status: "completed",
    challenger_score: challenger,
    opponent_score: opponent,
    winner_athlete_id: winnerId || undefined,
  });
}