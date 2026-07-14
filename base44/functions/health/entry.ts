import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Public health check — pinged by the uptime workflow. Proves the DB is reachable.
Deno.serve(async (req) => {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.RewardItem.list('-created_date', 1); // trivial read
    console.log(JSON.stringify({ fn: 'health', caller: 'anon', outcome: 'ok', ms: Date.now() - started }));
    return Response.json({ ok: true, ts: new Date().toISOString() });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'health', caller: 'anon', outcome: 'error', ms: Date.now() - started, error: error.message, stack: error.stack }));
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});