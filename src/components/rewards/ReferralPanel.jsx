import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Copy, Check, Zap, Trophy, UserPlus } from "lucide-react";
import StampButton from "@/components/ui/StampButton";

const STARTER_POINTS = 500;
const RECRUITER_BONUS_FIRST = 1500;
const RECRUITER_BONUS_SUBSEQUENT = 100;

function statusColor(s) {
  if (s === "bonus_earned") return 'var(--accent)';
  if (s === "joined") return 'var(--text-secondary)';
  return 'var(--text-tertiary)';
}

function statusLabel(s) {
  if (s === "bonus_earned") return "Bonus Earned ✓";
  if (s === "joined") return "Joined — 3 workouts needed";
  return "Invite Sent";
}

export default function ReferralPanel({ athlete, referrals, onReferred }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const referralCode = athlete ? `OFFSZN-${athlete.id.slice(-6).toUpperCase()}` : "";
  const referralLink = `https://offszn.app/register?ref=${referralCode}`;

  const bonusEarned = referrals.filter(r => r.status === "bonus_earned").length;
  const totalEarned = bonusEarned > 0
    ? RECRUITER_BONUS_FIRST + (bonusEarned - 1) * RECRUITER_BONUS_SUBSEQUENT + referrals.filter(r => r.starter_pack_awarded).length * STARTER_POINTS
    : referrals.filter(r => r.starter_pack_awarded).length * STARTER_POINTS;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async () => {
    if (!email.trim() || !athlete) return;
    // Check dupe
    const existing = referrals.find(r => r.referred_email === email.trim());
    if (existing) { alert("You already invited this person."); return; }
    setSending(true);
    await base44.entities.Referral.create({
      referrer_athlete_id: athlete.id,
      referrer_name: athlete.display_name,
      referred_email: email.trim(),
      status: "pending",
      workouts_logged_by_referred: 0,
      starter_pack_awarded: false,
      recruiter_bonus_awarded: false,
    });
    await base44.integrations.Core.SendEmail({
      to: email.trim(),
      subject: `${athlete.display_name} wants you to join OFFSZN 🏆`,
      body: `Your training partner ${athlete.display_name} has invited you to join OFFSZN — the ultimate performance hub for athletes.\n\nUse their link to sign up and you'll both get 500 bonus points toward free merch and gift cards:\n\n${referralLink}\n\nSee you on the field.`,
    });
    setSent(true);
    setEmail("");
    setSending(false);
    onReferred();
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Recruits", value: referrals.length },
          { label: "Converted", value: referrals.filter(r => r.status !== "pending").length },
          { label: "Pts Earned", value: totalEarned.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="card-base p-3 text-center">
            <p className="stat-number text-xl" style={{ color: 'var(--accent)' }}>{s.value}</p>
            <p className="eyebrow" style={{ fontSize: '0.625rem', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="card-base p-4">
        <h3 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-xl)', color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 12 }}>The Clan Recruitment Bonus</h3>
        <div className="space-y-3">
          {[
            { step: "01", label: "Send your link", detail: "Share it via the email invite or copy the link.", pts: null },
            { step: "02", label: "Friend joins", detail: "They sign up using your referral link.", pts: `Both get +${STARTER_POINTS} pts` },
            { step: "03", label: "They log 3 workouts", detail: "First recruit earns you +1,500 pts. Every recruit after that earns +100 pts.", pts: `You get +${RECRUITER_BONUS_FIRST.toLocaleString()} pts (1st)` },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-base)', color: 'var(--accent)', minWidth: 24 }}>{s.step}</span>
              <div className="flex-1">
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{s.detail}</p>
              </div>
              {s.pts && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap size={10} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>{s.pts}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Your link */}
      <div className="card-base p-4">
        <p className="eyebrow mb-2">Your Referral Link</p>
        <div className="flex items-center gap-2 rounded px-3 py-2.5 mb-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralLink}</span>
          <button onClick={copyLink} className="flex-shrink-0 p-1 rounded" style={{ background: 'var(--surface-3)' }}>
            {copied ? <Check size={14} style={{ color: 'var(--accent)' }} /> : <Copy size={14} style={{ color: 'var(--text-tertiary)' }} />}
          </button>
        </div>

        <p className="eyebrow mb-2">Or Send an Email Invite</p>
        <div className="flex gap-2">
          <input
            className="input-base flex-1"
            style={{ minHeight: 44 }}
            placeholder="teammate@school.edu"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendInvite()}
          />
          <StampButton onClick={sendInvite} disabled={sending || !email.trim()}>
            {sent ? "Sent ✓" : sending ? "…" : "Invite"}
          </StampButton>
        </div>
      </div>

      {/* Referral list */}
      {referrals.length > 0 && (
        <div className="card-base p-4">
          <h3 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-lg)', color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 12 }}>Your Recruits</h3>
          <div className="space-y-2">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <UserPlus size={14} style={{ color: 'var(--text-tertiary)' }} />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referred_email}</p>
                  <p className="eyebrow mt-0.5" style={{ fontSize: '0.625rem', color: statusColor(r.status) }}>
                    {statusLabel(r.status)}
                  </p>
                </div>
                {r.status !== "bonus_earned" && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{r.workouts_logged_by_referred || 0}/3</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}