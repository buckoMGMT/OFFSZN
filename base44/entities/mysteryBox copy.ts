// base44/functions/mysteryBox.ts
// Weighted-random reward box. Server-only by construction — this is a
// backend_function, so there's no client path that can compute its own
// reward. Uses crypto.getRandomValues (available natively in Deno), not
// Math.random(), since this is effectively a gambling mechanic.

import { createClientFromRequest } from "@base44/sdk/server";

const BOX_TIERS: Record<string, { costPoints: number; rewards: { tier: string; weight: number; pointRange: [number, number] }[] }> = {
  bronze: {
    costPoints: 100,
    rewards: [
      { tier: "common", weight: 0.70, pointRange: [50, 90] },
      { tier: "uncommon", weight: 0.25, pointRange: [100, 150] },
      { tier: "rare", weight: 0.05, pointRange: [200, 300] },
    ],
  },
  silver: {
    costPoints: 500,
    rewards: [
      { tier: "common", weight: 0.55, pointRange: [300, 450] },
      { tier: "uncommon", weight: 0.30, pointRange: [500, 700] },
      { tier: "rare", weight: 0.12, pointRange: [800, 1100] },
      { tier: "epic", weight: 0.03, pointRange: [1500, 2000] },
    ],
  },
  gold: {
    costPoints: 2000,
    rewards: [
      { tier: "common", weight: 0.45, pointRange: [1200, 1800] },
      { tier: "uncommon", weight: 0.30, pointRange: [2000, 2800] },
      { tier: "rare", weight: 0.18, pointRange: [3000, 4000] },
      { tier: "epic", weight: 0.06, pointRange: [5000, 7000] },
      { tier: "legendary", weight: 0.01, pointRange: [10000, 15000] },
    ],
  },
};

for (const [name, box] of Object.entries(BOX_TIERS)) {
  const sum = box.rewards.reduce((a, r) => a + r.weight, 0);
  if (Math.abs(sum - 1.0) > 1e-9) throw new Error(`${name} weights sum to ${sum}, must be 1.0`);
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
      const points = min + Math.floor(secureRandom() * (max - min + 1));
      return { tier: reward.tier, points };
    }
  }
  const last = box.rewards[box.rewards.length - 1];
  return { tier: last.tier, points: last.pointRange[0] };
}

// Simple in-memory per-instance cooldown as a first line of defense against
// double-click races, ON TOP OF the fraud guard's velocity checks — belt
// and suspenders, cheap to add, closes the gap before fraudGuard.ts even runs.
const lastOpenAt = new Map<string, number>();
const COOLDOWN_MS = 3000;

export default async function handler(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { boxTier } = await req.json();
  if (!BOX_TIERS[boxTier]) {
    return new Response(JSON.stringify({ error: "unknown_box_tier" }), { status: 400 });
  }

  const [athlete] = await base44.entities.Athlete.filter({ user_id: user.id });
  if (!athlete) return new Response(JSON.stringify({ error: "athlete_not_found" }), { status: 404 });

  const last = lastOpenAt.get(athlete.id) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return new Response(JSON.stringify({ error: "too_fast", cooldown_ms: COOLDOWN_MS }), { status: 429 });
  }

  if (athlete.is_flagged) {
    return new Response(JSON.stringify({ error: "account_under_review" }), { status: 403 });
  }
  if (athlete.throttle_until && new Date(athlete.throttle_until) > new Date()) {
    return new Response(JSON.stringify({ error: "throttled" }), { status: 429 });
  }

  const cost = BOX_TIERS[boxTier].costPoints;
  if ((athlete.points_balance ?? 0) < cost) {
    return new Response(JSON.stringify({ error: "insufficient_points" }), { status: 400 });
  }

  lastOpenAt.set(athlete.id, Date.now());
  const reward = rollReward(boxTier);
  const newBalance = athlete.points_balance - cost + reward.points;

  await base44.asServiceRole.entities.Athlete.update(athlete.id, { points_balance: newBalance });
  await base44.asServiceRole.entities.Redemption.create({
    athlete_id: athlete.id,
    type: "mystery_box",
    box_tier: boxTier,
    reward_tier: reward.tier,
    points_spent: cost,
    points_awarded: reward.points,
  });

  return new Response(JSON.stringify({ boxTier, reward, newBalance }), { status: 200 });
}
