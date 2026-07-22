// Minor-initiated guardian link — shown to athletes whose live-computed age is
// under 18 (or unknown, fail-safe). Enter a parent/guardian email → server
// creates a pending GuardianLink + a shareable invite link the athlete can text
// their parent. Pending links grant nothing until the guardian verifies.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, ShieldAlert, Copy, Share2, Check, Loader2 } from "lucide-react";

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

export default function GuardianInviteSection() {
  const [isMinor, setIsMinor] = useState(false);
  const [link, setLink] = useState(undefined); // undefined = loading, null = none
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      const age = ageFrom(u?.date_of_birth);
      const minor = age === null ? true : age < 18; // fail-safe: unknown = minor
      setIsMinor(minor);
      if (minor) {
        base44.functions.invoke("guardianConsent", { action: "my_status" })
          .then(r => setLink((r.data?.links || [])[0] || null))
          .catch(() => setLink(null));
      }
    }).catch(() => {});
  }, []);

  if (!isMinor || link === undefined) return null;

  const inviteUrl = link?.invite_code ? `${window.location.origin}/guardian?code=${link.invite_code}` : null;
  const shareText = inviteUrl
    ? `I need you to verify as my guardian on OFFSZN (my training app) — takes a minute: ${inviteUrl}`
    : "";

  const createInvite = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await base44.functions.invoke("guardianConsent", { action: "invite", guardianEmail: email });
      setLink(res.data.link);
    } catch (e) {
      setErr(e?.response?.data?.message || "Couldn't create the invite — check the email and try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: shareText }); } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  return (
    <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
      <div className="flex items-center gap-2 mb-1">
        {link?.status === "verified"
          ? <ShieldCheck size={15} style={{ color: 'var(--positive)' }} />
          : <ShieldAlert size={15} style={{ color: 'var(--warning)' }} />}
        <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Parent / Guardian</p>
      </div>

      {link?.status === "verified" ? (
        <p className="font-work text-sm" style={{ color: 'var(--theme-ink)' }}>
          <span className="font-semibold">{link.guardian_name || link.guardian_email}</span> is verified on your account.
        </p>
      ) : link?.status === "pending" ? (
        <>
          <p className="font-work text-sm mb-1" style={{ color: 'var(--theme-ink)' }}>
            Waiting on <span className="font-semibold">{link.guardian_email}</span>.
          </p>
          <p className="font-work text-[11px] mb-3" style={{ color: 'var(--theme-ink-soft)' }}>
            Text them the link — they sign in with that email and tap verify. Until then, coach features and public boards stay locked.
          </p>
          <div className="flex gap-2">
            <button onClick={shareLink} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              <Share2 size={12} /> Send It
            </button>
            <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
              {copied ? <><Check size={12} style={{ color: 'var(--positive)' }} /> Copied</> : <><Copy size={12} /> Copy Link</>}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-work text-[11px] mb-3" style={{ color: 'var(--theme-ink-soft)' }}>
            Link a parent or guardian to unlock coach subscriptions, messaging, and public leaderboards. They verify once — takes a minute.
          </p>
          <input type="email" inputMode="email" placeholder="parent@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded p-2.5 text-sm mb-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
          {err && <p className="text-xs mb-2" style={{ color: 'var(--negative)' }}>{err}</p>}
          <button onClick={createInvite} disabled={busy || !email.includes("@")} className="btn-secondary w-full" style={{ minHeight: 44 }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : "Create Invite Link"}
          </button>
        </>
      )}
    </div>
  );
}