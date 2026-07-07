// Paid coaching subscription block inside a coach's profile sheet.
// Subscribed members get 1-on-1 messaging; others see the join CTA.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, Star } from "lucide-react";
import CoachChatSheet from "@/components/messaging/CoachChatSheet";

export default function CoachServiceSection({ coach }) {
  const [me, setMe] = useState(null);
  const [paidSub, setPaidSub] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [busy, setBusy] = useState(false);

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
  if (!price || coach?.stripe_onboarding_status !== "complete" || !me || me.id === coach.id) return null;

  const join = async () => {
    if (window.self !== window.top) {
      alert("Checkout only works from the published app — open your app in its own tab to subscribe.");
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke("subscribeToCoach", { coachAthleteId: coach.id, returnUrl: window.location.href });
      if (res.data?.url) { window.location.href = res.data.url; return; }
      alert(res.data?.error || "Could not start checkout.");
    } catch (e) {
      alert(e.response?.data?.error || "Could not start checkout.");
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Star size={12} fill="currentColor" style={{ color: 'var(--accent)' }} />
        <p className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Coaching Subscription</p>
      </div>
      {paidSub ? (
        <>
          <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>You're a member — message your coach anytime.</p>
          <button onClick={() => setShowChat(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            <MessageCircle size={13} /> Message {coach.display_name.split(" ")[0]}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
            1-on-1 messaging, personalized feedback, and exclusive member perks.
          </p>
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