import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Copy, Check, Zap, Trophy, UserPlus } from "lucide-react";
import StampButton from "@/components/ui/StampButton";

const STARTER_POINTS = 500;
const RECRUITER_BONUS_FIRST = 1500;
const RECRUITER_BONUS_SUBSEQUENT = 100;

function statusColor(s) {
  if (s === "bonus_earned") return '#D7263D';
  if (s === "joined") return '#5E646B';
  return '#9BA3AC';
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

  const referralCode = athlete ? `PBP-${athlete.id.slice(-6).toUpperCase()}` : "";
  const referralLink = `https://theplaybook.app/register?ref=${referralCode}`;

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
      subject: `${athlete.display_name} wants you to join The Playbook 🏆`,
      body: `Your training partner ${athlete.display_name} has invited you to join The Playbook — the ultimate performance hub for athletes.\n\nUse their link to sign up and you'll both get 500 bonus points toward free merch and gift cards:\n\n${referralLink}\n\nSee you on the field.`,
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
          <div key={s.label} className="rounded border p-3 text-center" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
            <p className="font-elite text-xl" style={{ color: '#D7263D' }}>{s.value}</p>
            <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded border p-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
        <h3 className="font-anton text-xl uppercase mb-3" style={{ color: '#15151A' }}>The Clan Recruitment Bonus</h3>
        <div className="space-y-3">
          {[
            { step: "01", label: "Send your link", detail: "Share it via the email invite or copy the link.", pts: null },
            { step: "02", label: "Friend joins", detail: "They sign up using your referral link.", pts: `Both get +${STARTER_POINTS} pts` },
            { step: "03", label: "They log 3 workouts", detail: "First recruit earns you +1,500 pts. Every recruit after that earns +100 pts.", pts: `You get +${RECRUITER_BONUS_FIRST.toLocaleString()} pts (1st)` },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: '#9BA3AC44' }}>
              <span className="font-elite text-base" style={{ color: '#D7263D', minWidth: 24 }}>{s.step}</span>
              <div className="flex-1">
                <p className="font-work text-sm font-semibold" style={{ color: '#15151A' }}>{s.label}</p>
                <p className="font-work text-xs" style={{ color: '#5A5D63' }}>{s.detail}</p>
              </div>
              {s.pts && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap size={10} style={{ color: '#D7263D' }} />
                  <span className="font-elite text-xs" style={{ color: '#D7263D' }}>{s.pts}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Your link */}
      <div className="rounded border p-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
        <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: '#5A5D63' }}>Your Referral Link</p>
        <div className="flex items-center gap-2 rounded px-3 py-2.5 mb-3" style={{ background: '#EDEEF0', border: '1px solid #9BA3AC' }}>
          <span className="font-elite text-xs flex-1 truncate" style={{ color: '#15151A' }}>{referralLink}</span>
          <button onClick={copyLink} className="flex-shrink-0 p-1 rounded" style={{ background: '#DCDEE1' }}>
            {copied ? <Check size={14} style={{ color: '#D7263D' }} /> : <Copy size={14} style={{ color: '#9BA3AC' }} />}
          </button>
        </div>

        {/* Email invite */}
        <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: '#5A5D63' }}>Or Send an Email Invite</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded px-3 py-2.5 text-sm font-work outline-none"
            style={{ background: '#EDEEF0', border: '1px solid #9BA3AC', color: '#15151A' }}
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
        <div className="rounded border p-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
          <h3 className="font-anton text-lg uppercase mb-3" style={{ color: '#15151A' }}>Your Recruits</h3>
          <div className="space-y-2">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: '#9BA3AC44' }}>
                <UserPlus size={14} style={{ color: '#9BA3AC' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-work text-xs truncate" style={{ color: '#15151A' }}>{r.referred_email}</p>
                  <p className="font-elite text-[8px] uppercase tracking-widest mt-0.5" style={{ color: statusColor(r.status) }}>
                    {statusLabel(r.status)}
                  </p>
                </div>
                {r.status !== "bonus_earned" && (
                  <div className="text-right">
                    <p className="font-elite text-[9px]" style={{ color: '#9BA3AC' }}>{r.workouts_logged_by_referred || 0}/3 workouts</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}