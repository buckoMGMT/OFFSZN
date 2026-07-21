// Team challenge scoring — point-based, computed from data that already exists.
// A team's live score = (sum of its members' total_points now) − (baseline at start).
// No cron needed: we resolve lazily whenever a challenge is read past its end.
import { base44 } from "@/api/base44Client";

// Sum current total_points across every member of a clan.
export async function sumTeamPoints(clanId) {
  const members = await base44.entities.Athlete.filter({ clan_id: clanId }, "-total_points", 200);
  return members.reduce((s, m) => s + (m.total_points || 0), 0);
}

// Create an active challenge between two teams, snapshotting each baseline.
export async function createChallenge(myClan, opponent, durationDays) {
  const [challengerBaseline, opponentBaseline] = await Promise.all([
    sumTeamPoints(myClan.id),
    sumTeamPoints(opponent.id),
  ]);
  const start = new Date();
  const end = new Date(start.getTime() + durationDays * 86400000);
  return base44.entities.ClanChallenge.create({
    challenger_clan_id: myClan.id,
    challenger_clan_name: myClan.name,
    opponent_clan_id: opponent.id,
    opponent_clan_name: opponent.name,
    metric: "team_points",
    duration_days: durationDays,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    challenger_baseline: challengerBaseline,
    opponent_baseline: opponentBaseline,
    status: "active",
  });
}

// Live scores for an active challenge (current team total minus baseline, floored at 0).
export async function liveScores(challenge) {
  const [cNow, oNow] = await Promise.all([
    sumTeamPoints(challenge.challenger_clan_id),
    sumTeamPoints(challenge.opponent_clan_id),
  ]);
  return {
    challenger: Math.max(0, cNow - (challenge.challenger_baseline || 0)),
    opponent: Math.max(0, oNow - (challenge.opponent_baseline || 0)),
  };
}

// Freeze final scores + winner + team W/L once the window has closed.
// Idempotent: only writes when still active and past end_date.
export async function resolveIfEnded(challenge) {
  if (challenge.status !== "active") return challenge;
  if (new Date(challenge.end_date) > new Date()) return challenge;

  // Re-read right before writing so two clients loading at once don't both
  // resolve (and double-count the W/L on each team).
  const fresh = await base44.entities.ClanChallenge.filter({ id: challenge.id }, "-created_date", 1).then(l => l[0]);
  if (!fresh || fresh.status !== "active") return fresh || challenge;

  const { challenger, opponent } = await liveScores(challenge);
  const winnerId =
    challenger === opponent ? null
    : challenger > opponent ? challenge.challenger_clan_id
    : challenge.opponent_clan_id;

  const updated = await base44.entities.ClanChallenge.update(challenge.id, {
    status: "completed",
    challenger_score: challenger,
    opponent_score: opponent,
    winner_clan_id: winnerId || undefined,
  });

  // Record the W/L on each team (skip on a tie).
  if (winnerId) {
    const loserId = winnerId === challenge.challenger_clan_id ? challenge.opponent_clan_id : challenge.challenger_clan_id;
    const [winner, loser] = await Promise.all([
      base44.entities.Clan.filter({ id: winnerId }, "-created_date", 1).then(l => l[0]),
      base44.entities.Clan.filter({ id: loserId }, "-created_date", 1).then(l => l[0]),
    ]);
    await Promise.all([
      winner && base44.entities.Clan.update(winner.id, { wins: (winner.wins || 0) + 1 }),
      loser && base44.entities.Clan.update(loser.id, { losses: (loser.losses || 0) + 1 }),
    ].filter(Boolean));
  }
  return updated;
}