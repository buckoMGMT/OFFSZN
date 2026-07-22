// 1v1 challenge client — create/resolve run SERVER-SIDE via the pvpChallenge
// function (PlayerChallenge writes are RLS-blocked for clients). Only live
// score reads happen here.
import { base44 } from "@/api/base44Client";

async function athletePoints(athleteId) {
  const a = await base44.entities.Athlete.filter({ id: athleteId }, "-created_date", 1).then(l => l[0]);
  return a?.total_points || 0;
}

// Create an active 1v1. Throws "active_exists" if these two already have a
// live challenge in either direction (mapped from the server's 409).
export async function createPvpChallenge(me, opponent, durationDays) {
  try {
    const res = await base44.functions.invoke("pvpChallenge", {
      action: "create",
      opponentAthleteId: opponent.id,
      durationDays,
    });
    return res.data?.challenge;
  } catch (e) {
    throw new Error(e?.response?.data?.error || "create_failed");
  }
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

// Ask the server to freeze final scores + winner once the window closes.
// Server is idempotent — safe if two clients race.
export async function resolvePvpIfEnded(ch) {
  if (ch.status !== "active") return ch;
  if (new Date(ch.end_date) > new Date()) return ch;
  try {
    const res = await base44.functions.invoke("pvpChallenge", { action: "resolve", challengeId: ch.id });
    return res.data?.challenge || ch;
  } catch {
    return ch;
  }
}