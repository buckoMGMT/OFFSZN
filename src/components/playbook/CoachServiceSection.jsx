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
  if (!price || coach?.stripe_onboarding_status !== "complete" || coach?.identity_status !== "verified" || !me || me.id === coach.id) return null;

  const join = async () => {
    if (window.self !== window.top) {
      toast({ variant: "destructive", title: "Checkout unavailable here", description: "Checkout only works from the published app — open your app in its own tab to subscribe." });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke("subscribeToCoach", { coachAthleteId: coach.id, returnUrl: window.location.href });
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
      {paidSub ? (
        <>
          <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
            You're a member — message your coach anytime, replies within {coach.coach_response_sla_hours || 48}h.
          </p>
          <button onClick={() => setShowChat(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            <MessageCircle size={13} /> Message {coach.display_name.split(" ")[0]}
          </button>
        </>
      ) : needsGuardian ? (
        <div className="rounded p-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>One more step — guardian approval</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Because you're under 18, a verified parent or guardian must be linked to your account before you can join a coach's service.
            Ask your parent or guardian to complete the guardian link from your Player page, then come back here.
          </p>
        </div>
      ) : (
        <>
          <ServicesIncludedList services={coach.coach_services} slaHours={coach.coach_response_sla_hours} />
          <button onClick={join} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: busy ? 0.6 : 1 }}>
            {busy ? "Opening checkout..." : `Join — $${Number(price).toFixed(2)}/mo`}
          </button>
        </>
      )}
      <CoachChatSheet open={showChat} onClose={() => setShowChat(false)} me={me} other={coach} />
    </div>
  );
}