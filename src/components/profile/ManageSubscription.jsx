// Settings → Manage subscription: plan, renewal, portal links, cancel with reason.
import { useState, useEffect } from "react";
import { CreditCard, Receipt, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const REASONS = ["Too pricey", "Not using it", "Missing features", "Other"];

export default function ManageSubscription() {
  const [info, setInfo] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [cancelMode, setCancelMode] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    base44.functions.invoke("billingPortal", { returnUrl: window.location.href })
      .then((res) => setInfo(res.data))
      .catch(() => setInfo(null))
      .finally(() => setLoaded(true));
  }, []);

  const openPortal = () => {
    if (window.self !== window.top) { alert("Billing management only works from the published app — open your app in its own tab."); return; }
    if (info?.url) window.location.href = info.url;
  };

  const sendReason = async (reason) => {
    await base44.entities.Feedback.create({ category: "other", message: `cancel: ${reason}`, page: "settings" });
    setSent(true);
    openPortal();
  };

  if (!loaded) return <div className="skeleton" style={{ height: 72, borderRadius: "var(--r-lg)" }} />;
  const sub = info?.subscription;
  if (!sub) return null;

  return (
    <div className="rounded border overflow-hidden" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-border)" }}>
      <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: "var(--theme-ink-soft)" }}>Manage Subscription</p>
      <div className="px-4 py-3 border-t" style={{ borderColor: "var(--theme-border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--theme-ink)" }}>
          1-on-1 Coaching — {sub.coach_name}
        </p>
        <p className="text-xs tabular-nums mt-0.5" style={{ color: "var(--theme-ink-soft)" }}>
          ${sub.price_usd.toFixed(2)}/mo
          {sub.renews_at && ` · ${sub.cancel_at_period_end ? "access until" : "renews"} ${new Date(sub.renews_at).toLocaleDateString()}`}
          {sub.status === "past_due" && " · payment issue"}
        </p>
      </div>
      <button onClick={openPortal} className="w-full flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: "var(--theme-border)" }}>
        <CreditCard size={15} style={{ color: "var(--accent)" }} />
        <span className="font-elite text-xs uppercase tracking-widest" style={{ color: "var(--theme-ink)" }}>Update payment method</span>
      </button>
      <button onClick={openPortal} className="w-full flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: "var(--theme-border)" }}>
        <Receipt size={15} style={{ color: "var(--accent)" }} />
        <span className="font-elite text-xs uppercase tracking-widest" style={{ color: "var(--theme-ink)" }}>View receipts</span>
      </button>
      {!cancelMode ? (
        <button onClick={() => setCancelMode(true)} className="w-full flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: "var(--theme-border)" }}>
          <XCircle size={15} style={{ color: "var(--negative)" }} />
          <span className="font-elite text-xs uppercase tracking-widest" style={{ color: "var(--negative)" }}>Cancel subscription</span>
        </button>
      ) : (
        <div className="px-4 py-3 border-t" style={{ borderColor: "var(--theme-border)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--theme-ink-soft)" }}>
            You keep full access through the period you've already paid for. Mind telling us why?
          </p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} onClick={() => sendReason(r)} disabled={sent}
                className="px-3 py-1.5 rounded font-elite text-[9px] uppercase tracking-widest"
                style={{ border: "1px solid var(--border-strong)", color: "var(--theme-ink)" }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}