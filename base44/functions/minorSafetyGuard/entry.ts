// minorSafetyGuard — MERGED, CORRECTED VERSION (replaces all prior versions).
// Age is ALWAYS computed live from User.date_of_birth (stored is_minor goes
// stale at 18). Fail-safe: missing/bad DOB = treated as minor.
// Actions:
//   coach_interaction   — minors need a verified GuardianLink before coach
//                         purchases / subscriptions / direct contact.
//   public_exposure     — same guardian check before public leaderboards /
//                         high-stakes challenges. Within-clan never calls this.
//   sweepstakes_18_plus — hard 18+, NO guardian override.
//   coach_minor_audience — coach must have identity_status === "verified"
//                          (the REAL schema field) and not be flagged.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

    const { action, athleteUserId, coachAthleteId } = await req.json();

    const ageFrom = (dobIso) => {
      if (!dobIso) return null;
      const dob = new Date(dobIso);
      if (Number.isNaN(dob.getTime())) return null;
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      return age;
    };
    const deny = (code, message) => Response.json({ allowed: false, code, message }, { status: 403 });

    if (action === 'coach_minor_audience') {
      const coach = await base44.asServiceRole.entities.Athlete.get(coachAthleteId);
      if (!coach) return Response.json({ error: 'coach_not_found' }, { status: 404 });
      if (coach.is_flagged) {
        return deny('COACH_FLAGGED', 'Flagged coaches cannot reach minor audiences pending review.');
      }
      if (coach.identity_status !== 'verified') {
        return deny('IDENTITY_VERIFICATION_REQUIRED', 'Coaches must complete identity verification before their content is served to athletes under 18.');
      }
      return Response.json({ allowed: true });
    }

    const targetUserId = athleteUserId || user.id;
    const subject = await base44.asServiceRole.entities.User.get(targetUserId);
    if (!subject) return Response.json({ error: 'user_not_found' }, { status: 404 });
    const age = ageFrom(subject.date_of_birth);
    const isMinor = age === null ? true : age < 18; // fail-safe

    if (action === 'sweepstakes_18_plus') {
      if (age === null || age < 18) {
        return deny('SWEEPSTAKES_18_PLUS', 'Sweepstakes and prize-based promotions are open to eligible entrants 18 and older only.');
      }
      return Response.json({ allowed: true });
    }

    if (action === 'coach_interaction' || action === 'public_exposure') {
      if (!isMinor) return Response.json({ allowed: true });
      const links = await base44.asServiceRole.entities.GuardianLink.filter({
        minor_user_id: targetUserId,
        status: 'verified',
      });
      if (links.length > 0) return Response.json({ allowed: true });
      return deny('GUARDIAN_APPROVAL_REQUIRED', action === 'coach_interaction'
        ? 'Athletes under 18 need a linked, verified parent/guardian account before coach purchases, subscriptions, or direct contact.'
        : 'Public leaderboards and high-stakes challenges need a verified parent/guardian on the account for athletes under 18.');
    }

    return Response.json({ error: 'unknown_action' }, { status: 400 });
  } catch (error) {
    console.error('minorSafetyGuard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});