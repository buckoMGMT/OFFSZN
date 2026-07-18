// dmGuard — THE single gate for every 1-on-1 coach↔athlete channel (§0 rule).
// Actions:
//   check → may this thread exist? Returns { allowed, reason, minor_involved, sla_hours }
//   send  → assertDmAllowed() re-checked on EVERY send, then message persisted
//           server-side with RLS scoping emails + off-platform pattern flagging.
// No other code path may create a Message. Client writes are blocked by RLS.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { z } from 'npm:zod@3.24.2';

const bodySchema = z.object({
  action: z.enum(['check', 'send']),
  otherAthleteId: z.string().min(1),
  text: z.string().trim().min(1).max(2000).optional(),
});

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

const OFF_PLATFORM_PATTERNS = [
  { re: /\b\d{3}[\s.\-)]{0,2}\d{3}[\s.\-]?\d{4}\b/, label: 'phone_number' },
  { re: /\b(snap(chat)?|insta(gram)?|whats\s?app|telegram|discord|kik|signal)\b/i, label: 'external_platform' },
  { re: /\b(text|call|dm|message|add|find|hit)\s+me\s+(on|at)\b/i, label: 'move_off_platform' },
  { re: /@[a-z0-9_.]{3,30}\b/i, label: 'external_handle' },
];

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// The §0 rule, implemented once. Returns either { allowed: true, ... } or
// { allowed: false, reason } — reasons: no_channel, no_subscription,
// coach_not_verified, needs_guardian.
async function assertDmAllowed(base44, me, other) {
  // Identify the coach side — a 1-on-1 channel ONLY exists coach↔subscriber.
  // Two non-coaches (e.g. adult gym-goer → minor athlete) have NO channel, ever.
  let coach, member;
  if (other.role === 'coach') { coach = other; member = me; }
  else if (me.role === 'coach') { coach = me; member = other; }
  else return { allowed: false, reason: 'no_channel' };

  // Condition 1 — coach identity verified AND not flagged.
  if (coach.identity_status !== 'verified' || coach.is_flagged) {
    return { allowed: false, reason: 'coach_not_verified' };
  }

  // Channel requires an active paid subscription between the two.
  const subs = await base44.asServiceRole.entities.CoachSubscription.filter({
    subscriber_athlete_id: member.id, coach_athlete_id: coach.id, is_paid: true, status: 'active',
  });
  if (!subs[0]) return { allowed: false, reason: 'no_subscription' };

  // 7-day trial passes auto-expire — lapsed server-side on first check past expiry.
  const sub = subs[0];
  if (sub.plan === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
    await base44.asServiceRole.entities.CoachSubscription.update(sub.id, { status: 'canceled', is_paid: false });
    return { allowed: false, reason: 'trial_expired' };
  }

  // Live-age computation for both parties — NEVER a stored flag, NEVER grade.
  const [coachUser, memberUser] = await Promise.all([
    base44.asServiceRole.entities.User.get(coach.created_by_id),
    base44.asServiceRole.entities.User.get(member.created_by_id),
  ]);
  const coachAge = ageFromDob(coachUser?.date_of_birth);
  const memberAge = ageFromDob(memberUser?.date_of_birth);

  // A coach with no verified adult DOB cannot run 1-on-1 channels with anyone.
  if (coachAge === null || coachAge < 18) {
    return { allowed: false, reason: 'coach_not_verified' };
  }

  // Missing DOB on the member = fail-safe: treat as minor.
  const memberIsMinor = memberAge === null || memberAge < 18;
  let guardianEmail = null;
  let guardianName = null;
  if (memberIsMinor) {
    // Conditions 2–3 — verified GuardianLink with thread visibility.
    const links = await base44.asServiceRole.entities.GuardianLink.filter({
      minor_user_id: memberUser.id, status: 'verified',
    });
    if (!links[0]) return { allowed: false, reason: 'needs_guardian', minor_involved: true };
    guardianEmail = links[0].guardian_email;
    guardianName = links[0].guardian_name || null;
    // Fail safe: a minor thread must always be able to name its guardian.
    if (!guardianEmail) return { allowed: false, reason: 'needs_guardian', minor_involved: true };
  }

  return {
    allowed: true,
    coach, member,
    minor_involved: memberIsMinor,
    guardian_email: guardianEmail,
    guardian_name: guardianName,
    sla_hours: coach.coach_response_sla_hours || 48,
  };
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  let outcome = 'error';
  let callerId = 'anon';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    callerId = user.id;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      outcome = 'invalid_input';
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    const { action, otherAthleteId } = parsed.data;

    const mine = await base44.entities.Athlete.list('-created_date', 1);
    const me = mine[0];
    if (!me) return Response.json({ error: 'No athlete profile found' }, { status: 404 });

    const other = await base44.asServiceRole.entities.Athlete.get(otherAthleteId).catch(() => null);
    if (!other || other.id === me.id) return Response.json({ error: 'Not found' }, { status: 404 });

    const verdict = await assertDmAllowed(base44, me, other);

    if (action === 'check') {
      outcome = verdict.allowed ? 'check_allowed' : `check_${verdict.reason}`;
      return Response.json({
        allowed: verdict.allowed,
        reason: verdict.reason || null,
        minor_involved: !!verdict.minor_involved,
        guardian_name: verdict.guardian_name || null,
        guardian_email: verdict.guardian_email || null,
        sla_hours: verdict.sla_hours || 48,
      });
    }

    // action === 'send' — guard re-asserted on EVERY send.
    if (!verdict.allowed) {
      outcome = `send_blocked_${verdict.reason}`;
      return Response.json({ allowed: false, reason: verdict.reason }, { status: 403 });
    }
    const text = (parsed.data.text || '').replace(CONTROL_CHARS, '').trim();
    if (!text) return Response.json({ error: 'Empty message' }, { status: 400 });

    // Off-platform contact detection — flag + moderate, never auto-block.
    const hits = OFF_PLATFORM_PATTERNS.filter(p => p.re.test(text)).map(p => p.label);
    const flagged = hits.length > 0;

    const [meUser, otherUser] = await Promise.all([
      base44.asServiceRole.entities.User.get(me.created_by_id),
      base44.asServiceRole.entities.User.get(other.created_by_id),
    ]);

    const message = await base44.asServiceRole.entities.Message.create({
      sender_athlete_id: me.id,
      recipient_athlete_id: other.id,
      text,
      sender_user_email: meUser?.email,
      recipient_user_email: otherUser?.email,
      guardian_user_email: verdict.guardian_email || undefined,
      flagged_for_review: flagged,
      flag_reason: flagged ? hits.join(',') : undefined,
    });

    if (flagged) {
      // Log every hit for human review — §0 condition 5.
      await base44.asServiceRole.entities.FraudEvent.create({
        athlete_id: me.id,
        event_type: 'off_platform_contact',
        severity: verdict.minor_involved ? 'high' : 'medium',
        evidence: { message_id: message.id, patterns: hits, minor_involved: !!verdict.minor_involved },
        action_taken: 'flagged',
      });
    }

    // Studio notification — new message for the recipient.
    await base44.asServiceRole.entities.Notification.create({
      recipient_athlete_id: other.id,
      type: 'new_message',
      title: 'New Message',
      body: `${me.display_name} sent you a message.`,
      actor_name: me.display_name,
      actor_avatar: me.avatar_url,
    });

    outcome = flagged ? 'sent_flagged' : 'sent';
    return Response.json({ allowed: true, message, minor_involved: !!verdict.minor_involved });
  } catch (error) {
    console.error(JSON.stringify({ fn: 'dmGuard', caller: callerId, outcome: 'error', error: error.message, ms: Date.now() - t0 }));
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    console.log(JSON.stringify({ fn: 'dmGuard', caller: callerId, outcome, ms: Date.now() - t0 }));
  }
});