// Coach monetization setup: Stripe Connect payout onboarding + monthly subscription price.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Landmark, CheckCircle2, DollarSign, ShieldCheck } from "lucide-react";
import CoachServiceEditor from "@/components/profile/CoachServiceEditor";

const STATUS_LABEL = { none: "Not set up", pending: "In progress", complete: "Payouts active" };
const ID_LABEL = { unverified: "Not verified", pending: "In review", verified: "ID verified", failed: "Failed — retry" };

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

  const [idBusy, setIdBusy] = useState(false);
  const idStatus = athlete?.identity_status || "unverified";

  const verifyIdentity = async () => {
    setIdBusy(true);
    try {
      const res = await base44.functions.invoke("verifyCoachIdentity", { returnUrl: window.location.href });
      if (res.data?.status === "verified") {
        onUpdate?.({ ...athlete, identity_status: "verified", is_coach_verified: true });
      } else if (res.data?.url) {
        window.open(res.data.url, "_blank");
        onUpdate?.({ ...athlete, identity_status: "pending" });
      } else {
        alert("Your verification is still being reviewed — check back soon.");
      }
    } catch (e) {
      alert(e.response?.data?.error || "Could not start identity verification.");
    }
    setIdBusy(false);
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

      {/* Identity verification — required before athletes can subscribe */}
      <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} style={{ color: idStatus === "verified" ? 'var(--positive)' : 'var(--accent)' }} />
            <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Identity Verification</p>
          </div>
          <span className="font-elite text-[9px] uppercase tracking-widest px-2 py-1 rounded"
            style={idStatus === "verified"
              ? { color: 'var(--positive)', border: '1px solid var(--positive)' }
              : { color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
            {ID_LABEL[idStatus]}
          </span>
        </div>
        {idStatus === "verified" ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Your government ID and selfie are verified. Athletes see you as a verified coach.
          </p>
        ) : (
          <>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              Verify with a government ID + selfie (via Stripe Identity). Required before athletes can subscribe — this keeps kids safe and payments legit.
            </p>
            <button onClick={verifyIdentity} disabled={idBusy} className="btn-secondary w-full" style={{ minHeight: 44 }}>
              {idBusy ? "Opening verification..." : idStatus === "pending" ? "Continue Verification / Check Status" : "Verify My Identity"}
            </button>
          </>
        )}
      </div>

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
          Your rate for the 1-on-1 coaching service you offer subscribers.
        </p>
      </div>

      <CoachServiceEditor athlete={athlete} onUpdate={onUpdate} />
    </div>
  );
}