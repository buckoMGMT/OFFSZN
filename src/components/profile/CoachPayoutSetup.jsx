// Coach monetization setup: Stripe Connect payout onboarding + monthly subscription price.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Landmark, CheckCircle2, DollarSign } from "lucide-react";

const STATUS_LABEL = { none: "Not set up", pending: "In progress", complete: "Payouts active" };

export default function CoachPayoutSetup({ athlete, onUpdate }) {
  const [price, setPrice] = useState(athlete?.coach_sub_price_usd || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const status = athlete?.stripe_onboarding_status || "none";

  const startOnboarding = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("stripeConnectOnboard", { returnUrl: window.location.href });
      if (res.data?.status === "complete") {
        onUpdate?.({ ...athlete, stripe_onboarding_status: "complete" });
      } else if (res.data?.url) {
        window.open(res.data.url, "_blank");
        onUpdate?.({ ...athlete, stripe_onboarding_status: "pending" });
      }
    } catch (e) {
      alert(e.response?.data?.error || "Could not start payout setup.");
    }
    setBusy(false);
  };

  const savePrice = async () => {
    const p = parseFloat(price);
    if (!p || p <= 0) return;
    await base44.entities.Athlete.update(athlete.id, { coach_sub_price_usd: p });
    onUpdate?.({ ...athlete, coach_sub_price_usd: p });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="font-anton text-sm uppercase" style={{ color: 'var(--text-primary)' }}>Coaching Payouts</h3>
        </div>
        <span className="font-elite text-[9px] uppercase tracking-widest px-2 py-1 rounded"
          style={status === "complete"
            ? { color: 'var(--positive)', border: '1px solid var(--positive)' }
            : { color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {status === "complete" ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} style={{ color: 'var(--positive)' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Your bank is connected. You earn 80% of every subscription — paid out by Stripe.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Connect your bank through Stripe to get paid for coaching subscriptions. You keep 80% of every payment; the platform takes 20%.
          </p>
          <button onClick={startOnboarding} disabled={busy} className="btn-primary w-full" style={{ minHeight: 44 }}>
            {busy ? "Opening Stripe..." : status === "pending" ? "Continue Setup / Check Status" : "Set Up Payouts"}
          </button>
        </>
      )}

      <div>
        <p className="eyebrow mb-2">Monthly Subscription Price</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input type="number" min="1" step="1" className="input-base" style={{ minHeight: 44, paddingLeft: 32 }}
              placeholder="e.g. 20" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          <button onClick={savePrice} className="btn-secondary" style={{ minHeight: 44 }}>
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          Includes 1-on-1 messaging and personalized feedback for your subscribers.
        </p>
      </div>
    </div>
  );
}