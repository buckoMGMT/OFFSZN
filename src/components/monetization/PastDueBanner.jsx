// Shows when the user's coach subscription payment failed — links to the Stripe portal.
import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PastDueBanner() {
  const [pastDue, setPastDue] = useState(false);

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1).then((list) => {
      const me = list[0];
      if (!me) return;
      base44.entities.CoachSubscription.filter({ subscriber_athlete_id: me.id, is_paid: true, status: "past_due" })
        .then((subs) => setPastDue(subs.length > 0))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  const openPortal = async () => {
    if (window.self !== window.top) { alert("Billing management only works from the published app — open your app in its own tab."); return; }
    const res = await base44.functions.invoke("billingPortal", { returnUrl: window.location.href });
    if (res.data?.url) window.location.href = res.data.url;
  };

  if (!pastDue) return null;
  return (
    <button onClick={openPortal}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      style={{ background: "var(--accent-subtle)", borderBottom: "1px solid var(--accent)" }}>
      <AlertTriangle size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        Payment issue — update your card to keep your subscription. Tap to fix.
      </span>
    </button>
  );
}