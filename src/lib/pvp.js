// 1v1 challenge client — every write runs SERVER-SIDE via the pvpChallenge
// function (PlayerChallenge writes are RLS-blocked). Offer → accept flow:
// create makes a 'pending' offer (24h TTL); the window + baselines are
// snapshotted only when the opponent accepts.
import { base44 } from "@/api/base44Client";

const OFFER_TTL_MS = 24 * 3600000;

async function athletePoints(athleteId) {
  const a = await base44.entities.Athlete.filter({ id: athleteId }, "-created_date", 1).then(l => l[0]);
  return a?.total_points || 0;
}

// Send a challenge OFFER. Throws "active_exists" when a live/pending challenge
// already exists between these two (mapped from the server's 409).
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

// Opponent accepts or declines a pending offer.
export async function respondPvp(challengeId, accept) {
  const res = await base44.functions.invoke("pvpChallenge", {
    action: accept ? "accept" : "decline",
    challengeId,
  });
  return res.data?.challenge;
}

export function pendingExpiresAt(ch) {
  return new Date(new Date(ch.created_date).getTime() + OFFER_TTL_MS);
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

// Ask the server to settle a challenge that needs it: expired pendings get
// marked 'expired', ended actives get frozen scores + a winner. Idempotent.
export async function resolvePvpIfEnded(ch) {
  const stalePending = ch.status === "pending" && pendingExpiresAt(ch) <= new Date();
  const endedActive = ch.status === "active" && ch.end_date && new Date(ch.end_date) <= new Date();
  if (!stalePending && !endedActive) return ch;
  try {
    const res = await base44.functions.invoke("pvpChallenge", { action: "resolve", challengeId: ch.id });
    return res.data?.challenge || ch;
  } catch {
    return ch;
  }
}