// guardianConsent — the guardian-facing consent surface.
// A logged-in guardian (matched by email on a VERIFIED GuardianLink) can list
// their linked minors and grant/revoke public-exposure approval. This is the
// ONLY write path for public_exposure_approved — the minor cannot set it.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { action, linkId, approved } = await req.json();

    // All links where this user is the guardian.
    const links = await base44.asServiceRole.entities.GuardianLink.filter({ guardian_email: user.email });

    if (action === 'list') {
      const rows = [];
      for (const link of links) {
        let minorName = null;
        try {
          const minorUser = await base44.asServiceRole.entities.User.get(link.minor_user_id);
          if (minorUser) {
            const athletes = await base44.asServiceRole.entities.Athlete.filter({ created_by: minorUser.email }, '-created_date', 1);
            minorName = athletes[0]?.display_name || minorUser.full_name || null;
          }
        } catch (_e) { /* name stays null */ }
        rows.push({
          link_id: link.id,
          minor_name: minorName,
          status: link.status,
          public_exposure_approved: !!link.public_exposure_approved,
        });
      }
      return Response.json({ links: rows });
    }

    if (action === 'set_public_exposure') {
      const link = links.find(l => l.id === linkId);
      if (!link) return Response.json({ error: 'link_not_found' }, { status: 404 });
      if (link.status !== 'verified') {
        return Response.json({ error: 'not_verified', message: 'Verify your guardian link before changing exposure settings.' }, { status: 403 });
      }
      const updated = await base44.asServiceRole.entities.GuardianLink.update(link.id, {
        public_exposure_approved: !!approved,
      });
      return Response.json({ ok: true, public_exposure_approved: !!updated.public_exposure_approved });
    }

    return Response.json({ error: 'unknown_action' }, { status: 400 });
  } catch (error) {
    console.error('guardianConsent error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});