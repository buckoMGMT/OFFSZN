// base44/functions/gitlabSync.ts
// Set up as a scheduled Automation (Dashboard -> Automations, or an
// automations.jsonc entry) to run every 5-10 minutes rather than a webhook —
// no public inbound endpoint to secure for v1. GITLAB_BOT_TOKEN is a
// Secret (Dashboard -> Secrets).

import { createClientFromRequest } from "@base44/sdk/server";

const GITLAB_API = "https://gitlab.com/api/v4";
const PROJECT_ID = Deno.env.get("GITLAB_PROJECT_ID")!;

function authHeaders() {
  return { "PRIVATE-TOKEN": Deno.env.get("GITLAB_BOT_TOKEN")! };
}

export default async function handler(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);

  const issuesRes = await fetch(
    `${GITLAB_API}/projects/${PROJECT_ID}/issues?state=opened&labels=P0,bug&per_page=100`,
    { headers: authHeaders() }
  );
  const issues = issuesRes.ok ? await issuesRes.json() : [];

  const pipelineRes = await fetch(
    `${GITLAB_API}/projects/${PROJECT_ID}/pipelines?ref=main&per_page=1&order_by=id&sort=desc`,
    { headers: authHeaders() }
  );
  const [pipeline] = pipelineRes.ok ? await pipelineRes.json() : [];

  await base44.asServiceRole.entities.DevOpsStatus.upsert("gitlab_snapshot", {
    open_p0_count: issues.filter((i: any) => i.labels?.includes("P0")).length,
    open_bug_count: issues.filter((i: any) => i.labels?.includes("bug")).length,
    latest_pipeline_status: pipeline?.status ?? "unknown",
    latest_pipeline_url: pipeline?.web_url ?? null,
    synced_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ synced: true, issues: issues.length }), { status: 200 });
}
