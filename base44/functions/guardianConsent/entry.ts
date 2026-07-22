// guardianConsent — both sides of the guardian relationship.
// MINOR side:  'invite' (create pending link + shareable code), 'my_status'.
// GUARDIAN side: 'verify' (consume invite code), 'list', 'set_public_exposure'.
// Rails: pending links grant NOTHING (every guard checks status === 'verified');
// verification requires a logged-in ADULT (live age from date_of_birth — no DOB
// = denied) whose account email matches the invited guardian_email.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ageFrom = (dobIso: string | undefined) => {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { action, linkId, approved, guardianEmail, code } = await req.json();
    const svc = base44.asServiceRole.entities;

    // ── MINOR: create a pending link + shareable invite code ──
    if (action === 'invite') {
      const age = ageFrom(user.date_of_birth);
      const isMinor = age === null ? true : age < 18; // fail-safe
      if (!isMinor) return Response.json({ error: 'not_a_minor', message: 'Guardian links are for athletes under 18.' }, { status: 403 });

      const email = String(guardianEmail || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: 'invalid_email' }, { status: 400 });
      }
      if (email === String(user.email).toLowerCase()) {
        return Response.json({ error: 'self_invite', message: "That's your own email — enter your parent or guardian's." }, { status: 400 });
      }

      const existing = await svc.GuardianLink.filter({ minor_user_id: user.id });
      const live = existing.find(l => l.status === 'verified') || existing.find(l => l.status === 'pending');
      if (live) {
        return Response.json({ link: { id: live.id, guardian_email: live.guardian_email, status: live.status, invite_code: live.status === 'pending' ? live.invite_code : undefined } });
      }

      const inviteCode = crypto.randomUUID().replace(/-/g, '');
      const link = await svc.GuardianLink.create({
        minor_user_id: user.id,
        guardian_email: email,
        invite_code: inviteCode,
        status: 'pending',
        verification_method: 'email_confirmation',
      });
      return Response.json({ link: { id: link.id, guardian_email: email, status: 'pending', invite_code: inviteCode } });
    }

    // ── MINOR: view own link status (pending code included for re-sharing) ──
    if (action === 'my_status') {
      const existing = await svc.GuardianLink.filter({ minor_user_id: user.id });
      const links = existing
        .filter(l => l.status !== 'revoked')
        .map(l => ({
          id: l.id,
          guardian_email: l.guardian_email,
          guardian_name: l.guardian_name || null,
          status: l.status,
          public_exposure_approved: !!l.public_exposure_approved,
          invite_code: l.status === 'pending' ? l.invite_code : undefined,
        }));
      return Response.json({ links });
    }

    // ── GUARDIAN: consume an invite code ──
    if (action === 'verify') {
      if (!code) return Response.json({ error: 'invalid_request' }, { status: 400 });
      const matches = await svc.GuardianLink.filter({ invite_code: code });
      const link = matches[0];
      if (!link || link.status === 'revoked') return Response.json({ error: 'invalid_code', message: 'This invite link is no longer valid.' }, { status: 404 });
      if (link.status === 'verified') return Response.json({ ok: true, already: true });

      if (String(user.email).toLowerCase() !== String(link.guardian_email).toLowerCase()) {
        return Response.json({ error: 'email_mismatch', message: `This invite was sent to ${link.guardian_email}. Sign in with that email to verify.` }, { status: 403 });
      }
      if (user.id === link.minor_user_id) {
        return Response.json({ error: 'self_verify' }, { status: 403 });
      }
      const guardianAge = ageFrom(user.date_of_birth);
      if (guardianAge === null || guardianAge < 18) {
        return Response.json({ error: 'guardian_not_adult', message: 'Guardians must be verified adults. Add your date of birth to your account first.' }, { status: 403 });
      }

      await svc.GuardianLink.update(link.id, {
        status: 'verified',
        verified_at: new Date().toISOString(),
        guardian_user_id: user.id,
        guardian_name: user.full_name || undefined,
      });

      // Tell the minor it's done
      try {
        const minorUser = await svc.User.get(link.minor_user_id);
        if (minorUser) {
          const athletes = await svc.Athlete.filter({ created_by: minorUser.email }, '-created_date', 1);
          if (athletes[0]) {
            await svc.Notification.create({
              recipient_athlete_id: athletes[0].id,
              type: 'guardian',
              title: 'Guardian verified',
              body: `${user.full_name || link.guardian_email} is linked to your account. Coach features and boards your guardian approves are now open.`,
            });
          }
        }
      } catch (e) { console.error('guardian notify failed:', e.message); }

      return Response.json({ ok: true });
    }

    // ── GUARDIAN: list linked minors ──
    const guardianLinks = await svc.GuardianLink.filter({ guardian_email: user.email });

    if (action === 'list') {
      const rows = [];
      for (const link of guardianLinks) {
        let minorName = null;
        try {
          const minorUser = await svc.User.get(link.minor_user_id);
          if (minorUser) {
            const athletes = await svc.Athlete.filter({ created_by: minorUser.email }, '-created_date', 1);
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
      const link = guardianLinks.find(l => l.id === linkId);
      if (!link) return Response.json({ error: 'link_not_found' }, { status: 404 });
      if (link.status !== 'verified') {
        return Response.json({ error: 'not_verified', message: 'Verify your guardian link before changing exposure settings.' }, { status: 403 });
      }
      const updated = await svc.GuardianLink.update(link.id, {
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