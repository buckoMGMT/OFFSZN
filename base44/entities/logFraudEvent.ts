// base44/functions/logFraudEvent.ts
// This is the function the fraud_security_guard agent calls (see
// tool_configs -> function_name: "log_fraud_event" in
// base44/agents/fraud_security_guard.jsonc). The agent decides WHAT
// severity applies based on the rules in its instructions; this function
// is what actually APPLIES the response, so the enforcement logic lives
// in reviewable code, not just in an LLM's judgment call at runtime.

import { createClientFromRequest } from "@base44/sdk/server";

type Severity = "low" | "medium" | "high" | "critical";

export default async function handler(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);

  const { athlete_id, event_type, severity, evidence } = (await req.json()) as {
    athlete_id: string;
    event_type: string;
    severity: Severity;
    evidence: Record<string, unknown>;
  };

  if (!athlete_id || !event_type || !severity) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }

  let actionTaken: "logged" | "flagged" | "throttled" = "logged";
  const now = Date.now();

  if (severity === "critical") {
    await base44.asServiceRole.entities.Athlete.update(athlete_id, {
      is_flagged: true,
      flagged_reason: `${event_type}: ${JSON.stringify(evidence)}`,
      flagged_at: new Date().toISOString(),
      throttle_until: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    });
    actionTaken = "flagged";
  } else if (severity === "high") {
    await base44.asServiceRole.entities.Athlete.update(athlete_id, {
      throttle_until: new Date(now + 15 * 60 * 1000).toISOString(),
    });
    actionTaken = "throttled";
  }
  // low/medium: log only, no Athlete mutation — this is the agent's
  // "log it and let a human decide" path from its instructions.

  await base44.asServiceRole.entities.FraudEvent.create({
    athlete_id,
    event_type,
    severity,
    evidence,
    action_taken: actionTaken,
    reviewed_by_human: false,
  });

  return new Response(JSON.stringify({ action_taken: actionTaken }), { status: 200 });
}
