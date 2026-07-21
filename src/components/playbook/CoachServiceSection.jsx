// Paid coaching subscription block inside a coach's profile sheet.
// Subscribed members get 1-on-1 messaging; others see the join CTA.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, Star } from "lucide-react";
import CoachChatSheet from "@/components/messaging/CoachChatSheet";
import ServicesIncludedList from "@/components/playbook/ServicesIncludedList";
import { toast } from "@/components/ui/use-toast";

export default function CoachServiceSection({ coach }) {
  const [me, setMe] = useState(null);
  const [paidSub, setPaidSub] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsGuardian, setNeedsGuardian] = useState(false);

  useEffect(() => {
    if (!coach?.id) return;
    base44.entities.Athlete.list("-created_date", 1).then(list => {
      const a = list[0] || null;
      setMe(a);
      if (a) {
        base44.entities.CoachSubscription.filter({
          subscriber_athlete_id: a.id, coach_athlete_id: coach.id, is_paid: true, status: "active",
        }).then(s => setPaidSub(s[0] || null));
      }
    });
  }, [coach?.id]);

  const price = coach?.coach_sub_price_usd;
  if (!price || !me || me.id === coach.id) return null;
  // Coach offers a service but hasn't finished payouts/identity — show an honest
  // state instead of hiding the whole section (no invisible features, no dead ends).
  const serviceOpen = coach?.stripe_onboarding_status === "complete" && coach?.identity_status === "verified";

  // 7-day pass state — an expired trial reads as "not a member" + a convert prompt.
  const trialExpired = paidSub?.plan === "trial" && paidSub.trial_ends_at && new Date(paidSub.trial_ends_at) <= new Date();
  const activeSub = paidSub && !trialExpired ? paidSub : null;
  const trialDaysLeft = activeSub?.plan === "trial" && activeSub.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(activeSub.trial_ends_at) - Date.now()) / 864e5))
    : null;
  const trialOffered = coach.coach_trial_enabled && coach.coach_trial_price_usd > 0;

  const join = async (plan = "monthly") => {
    if (window.self !== window.top) {
      toast({ variant: "destructive", title: "Checkout unavailable here", description: "Checkout only works from the published app — open your app in its own tab to subscribe." });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke("subscribeToCoach", { coachAthleteId: coach.id, returnUrl: window.location.href, plan });
      if (res.data?.url) { window.location.href = res.data.url; return; }
      if (res.data?.reason === "needs_guardian") { setNeedsGuardian(true); setBusy(false); return; }
      toast({ variant: "destructive", title: "Checkout failed", description: res.data?.error || "Could not start checkout. Try again." });
    } catch (e) {
      if (e.response?.data?.reason === "needs_guardian") { setNeedsGuardian(true); setBusy(false); return; }
      toast({ variant: "destructive", title: "Checkout failed", description: e.response?.data?.error || "Could not start checkout. Try again." });
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Star size={12} fill="currentColor" style={{ color: 'var(--accent)' }} />
        <p className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>1-on-1 Coaching Service</p>
      </div>
      {!serviceOpen ? (
        <>
          <p className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
            {coach.display_name.split(" ")[0]} offers 1-on-1 coaching — ${Number(price).toFixed(2)}/mo.
          </p>
          <p className="text-xs rounded p-2.5" style={{ color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
            Not open yet — this coach is finishing payout and identity verification. Subscribing and direct messaging unlock the moment they're done. Their drills below are live now.
          </p>
        </>
      ) : activeSub ? (
        <>
          <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
            {trialDaysLeft !== null
              ? `7-day pass active — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left. Message your coach anytime, replies within ${coach.coach_response_sla_hours || 48}h.`
              : `You're a member — message your coach anytime, replies within ${coach.coach_response_sla_hours || 48}h.`}
          </p>
          <button onClick={() => setShowChat(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            <MessageCircle size={13} /> Message {coach.display_name.split(" ")[0]}
          </button>
        </>
      ) : needsGuardian ? (
        <div className="rounded p-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Almost there</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            A parent or guardian approves coach subscriptions for athletes under 18 — it takes about 2 minutes.
            Ask them to complete the guardian link from your Player page, then come back here. You're one step away.
          </p>
        </div>
      ) : (
        <>
          {trialExpired && (
            <p className="text-xs mb-2 rounded p-2" style={{ color: 'var(--text-primary)', background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
              Your 7-day pass ended — loved the week? Join monthly to keep your direct line open.
            </p>
          )}
          <ServicesIncludedList services={coach.coach_services} slaHours={coach.coach_response_sla_hours} />
          <button onClick={() => join("monthly")} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: busy ? 0.6 : 1 }}>
            {busy ? "Opening checkout..." : `Subscribe — $${Number(price).toFixed(2)}/mo`}
          </button>
          {trialOffered && !trialExpired && (
            <button onClick={() => join("trial")} disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest mt-2"
              style={{ background: 'var(--surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', opacity: busy ? 0.6 : 1 }}>
              Try 7 days — ${Number(coach.coach_trial_price_usd).toFixed(2)}
            </button>
          )}
        </>
      )}
      <CoachChatSheet open={showChat} onClose={() => setShowChat(false)} me={me} other={coach} />
    </div>
  );
}