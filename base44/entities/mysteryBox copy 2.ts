// base44/functions/mysteryBox.ts — FIXED VERSION
//
// Fixes vs. the broken deployed version:
//  1. points_balance -> total_points (points_balance does not exist on Athlete;
//     every open failed "insufficient_points" and points were never deducted)
//  2. filter({ user_id }) -> filter({ created_by }) (Athlete has no user_id
//     field; Base44 auto-stamps created_by with the creating user's email —
//     if your app links Athlete<->User some other way, change ATHLETE_LOOKUP)
//  3. Silver/gold boxes had POSITIVE expected value (silver EV 552.75 on a
//     500 cost, gold EV 2510 on 2000) — an infinite point printer. New tiers
//     carry a ~7.5% house edge, validated at module load so a future edit
//     can't silently recreate the exploit.
//  4. Redemption record now matches the Redemption schema (reward_type
//     "mystery_box", no phantom fields, reward_item_id optional).
//  5. Daily open cap (5/day) enforced via persisted Redemption records —
//     the in-memory cooldown alone doesn't survive across serverless
//     instances, so it was defeatable by parallel requests.

import { createClientFromRequest } from "@base44/sdk/server";

// How we find the caller's Athlete record. Base44 auto-adds created_by
// (user email) to every record. If your Athlete rows aren't created by the
// athlete's own account, change this ONE constant.
const ATHLETE_LOOKUP = (user: { email: string }) => ({ created_by: user.email });

const DAILY_OPEN_CAP = 5;

const BOX_TIERS: Record<string, { costPoints: number; rewards: { tier: string; weight: number; pointRange: [number, number] }[] }> = {
  bronze: {
    costPoints: 100,
    rewards: [
      { tier: "common",   weight: 0.70, pointRange: [50, 90] },
      { tier: "uncommon", weight: 0.25, pointRange: [100, 150] },
      { tier: "rare",     weight: 0.05, pointRange: [200, 300] },
    ],
  },
  silver: {
    costPoints: 500,
    rewards: [
      { tier: "common",   weight: 0.55, pointRange: [250, 380] },
      { tier: "uncommon", weight: 0.30, pointRange: [420, 600] },
      { tier: "rare",     weight: 0.12, pointRange: [650, 950] },
      { tier: "epic",     weight: 0.03, pointRange: [1100, 1600] },
    ],
  },
  gold: {
    costPoints: 2000,
    rewards: [
      { tier: "common",    weight: 0.45, pointRange: [900, 1400] },
      { tier: "uncommon",  weight: 0.30, pointRange: [1500, 2100] },
      { tier: "rare",      weight: 0.18, pointRange: [2300, 3000] },
      { tier: "epic",      weight: 0.06, pointRange: [3400, 4600] },
      { tier: "legendary", weight: 0.01, pointRange: [6500, 9000] },
    ],
  },
};

// Load-time validation: weights sum to 1.0 AND expected value < cost.
// The second check is the anti-printer guarantee — deploy fails loudly if
// any tier's average payout meets or exceeds its price.
for (const [name, box] of Object.entries(BOX_TIERS)) {
  const wsum = box.rewards.reduce((a, r) => a + r.weight, 0);
  if (Math.abs(wsum - 1.0) > 1e-9) throw new Error(`${name}: weights sum ${wsum}, must be 1.0`);
  const ev = box.rewards.reduce((a, r) => a + r.weight * (r.pointRange[0] + r.pointRange[1]) / 2, 0);
  if (ev >= box.costPoints) throw new Error(`${name}: EV ${ev} >= cost ${box.costPoints} — point printer, refusing to load`);
}

function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

function rollReward(boxTier: string) {
  const box = BOX_TIERS[boxTier];
  const roll = secureRandom();
  let cumulative = 0;
  for (const reward of box.rewards) {
    cumulative += reward.weight;
    if (roll <= cumulative) {
      const [min, max] = reward.pointRange;
      return { tier: reward.tier, points: min + Math.floor(secureRandom() * (max - min + 1)) };
    }
  }
  const last = box.rewards[box.rewards.length - 1];
  return { tier: last.tier, points: last.pointRange[0] };
}

export default async function handler(req: Request): Promise<Response> {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return json({ error: "unauthorized" }, 401);

  let boxTier: string;
  try { ({ boxTier } = await req.json()); } catch { return json({ error: "invalid_body" }, 400); }
  if (!BOX_TIERS[boxTier]) return json({ error: "unknown_box_tier" }, 400);

  const [athlete] = await base44.asServiceRole.entities.Athlete.filter(ATHLETE_LOOKUP(user));
  if (!athlete) return json({ error: "athlete_not_found" }, 404);

  if (athlete.is_flagged) return json({ error: "account_under_review" }, 403);
  if (athlete.throttle_until && new Date(athlete.throttle_until) > new Date()) return json({ error: "throttled" }, 429);

  // Persistent daily cap — counts today's box opens from Redemption records,
  // which survives across serverless instances (in-memory state does not).
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const todaysOpens = await base44.asServiceRole.entities.Redemption.filter({
    athlete_id: athlete.id,
    reward_type: "mystery_box",
    created_date: { $gte: dayStart.toISOString() },
  });
  if (todaysOpens.length >= DAILY_OPEN_CAP) {
    return json({ error: "daily_cap_reached", cap: DAILY_OPEN_CAP }, 429);
  }

  const cost = BOX_TIERS[boxTier].costPoints;
  const balance = athlete.total_points ?? 0;
  if (balance < cost) return json({ error: "insufficient_points", balance, cost }, 400);

  const reward = rollReward(boxTier);
  const newBalance = balance - cost + reward.points;

  await base44.asServiceRole.entities.Athlete.update(athlete.id, { total_points: newBalance });
  await base44.asServiceRole.entities.Redemption.create({
    athlete_id: athlete.id,
    reward_type: "mystery_box",
    reward_name: `${boxTier} mystery box — ${reward.tier}`,
    points_spent: cost,
    points_awarded: reward.points,
    box_tier: boxTier,
    reward_tier: reward.tier,
    status: "delivered", // points land instantly; no shipping for box opens
  });

  return json({ boxTier, reward, newBalance });
}
