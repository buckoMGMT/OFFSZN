// All-SZN Pass paywall sheet — the canonical Pass surface.
// Golden Rule: the Pass unlocks the platform, never coach-priced content.
// Confirmed benefits only — do not add rows without owner sign-off.
import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import PricingFAQ from "@/components/monetization/PricingFAQ";
import { base44 } from "@/api/base44Client";
import useSheetBack from "@/lib/useSheetBack";
import { track } from "@/lib/analytics";

const ROWS = [
  { label: "Daily tracker — macros, calories, weight", free: true },
  { label: "SZN Streaks", free: true },
  { label: "Join Clans & leaderboards", free: true },
  { label: "The Field — view, like, comment", free: true },
  { label: "Free drill library", free: true },
  { label: "Locker Room — earn & redeem points", free: true },
  { label: "Buy coach content à la carte", free: true },
  { label: "Post your content to The Field", free: false },
  { label: "Full OFFSZN premium drill library", free: false },
  { label: "Save drills & build custom playlists", free: false },
  { label: "Advanced stats — Readiness index & percentile benchmarks", free: false },
  { label: "Projected Peak forecasting & position leaderboards", free: false },
  { label: "Create your own Team & run the roster", free: false },
  { label: "Apply for verified Coach status", free: false },
  { label: "No Promoted content in your feed", free: false },
];

const Mark = ({ yes }) => yes
  ? <Check size={13} style={{ color: 'var(--accent)' }} />
  : <span style={{ color: 'var(--text-tertiary)' }}>—</span>;

export default function PassPaywallSheet({ open, onClose }) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [restoreMsg, setRestoreMsg] = useState("");

  // Money-screen funnel (3.2): view on open, dismissed on any close path.
  useEffect(() => { if (open) track.paywallViewed(); }, [open]);
  const dismiss = () => { track.paywallDismissed(); onClose?.(); };

  // Purchases are account-bound (Stripe subscription on the athlete record) —
  // "restore" re-checks the account's live tier instead of being a dead tap.
  const handleRestore = async () => {
    setRestoreMsg("Checking your account…");
    try {
      const list = await base44.entities.Athlete.list("-created_date", 1);
      setRestoreMsg(list[0]?.subscription_tier === "premium"
        ? "Your ALL-SZN Pass is active on this account."
        : "No Pass found. Purchases are tied to your login and restore automatically when you sign in.");
    } catch {
      setRestoreMsg("Couldn't check right now — try again in a moment.");
    }
  };
  // §4 — back gesture / hardware back dismisses this sheet first
  useSheetBack(open, dismiss);

  const handleBuy = async () => {
    if (window.self !== window.top) {
      setError("Checkout only works from the published app — open your app in its own tab.");
      return;
    }
    setBuying(true);
    setError("");
    track.paywallSubscribeClicked();
    // Session check FIRST — an expired/missing session routes to the branded
    // login instead of surfacing a raw authentication error on the buy button.
    const authed = await base44.auth.isAuthenticated().catch(() => false);
    if (!authed) {
      window.location.href = `/login`;
      return;
    }
    try {
      const res = await base44.functions.invoke("subscribeToPass", { returnUrl: window.location.href });
      if (res.data?.url) window.location.href = res.data.url;
      else setError(res.data?.error || "Couldn't start checkout. Try again.");
    } catch (e) {
      if (e?.response?.status === 401) {
        window.location.href = `/login`;
        return;
      }
      setError(e?.response?.data?.error || "Couldn't start checkout. Try again.");
    } finally {
      setBuying(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={dismiss}>
      <div
        className="glass-sheet w-full max-w-lg rounded-t-2xl animate-slide-up max-h-[88vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between p-5 pb-3 glass-sheet" style={{ border: 'none' }}>
          <div>
            <h2 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>ALL-SZN Pass</h2>
            <p className="tabular-nums text-lg font-semibold" style={{ color: 'var(--accent)' }}>$9.99<span className="text-xs" style={{ color: 'var(--text-secondary)' }}>/mo</span></p>
            <p className="font-elite text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-secondary)' }}>Unlock the platform.</p>
          </div>
          <button onClick={dismiss} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-5">
          {/* Comparison table */}
          <div className="card-base overflow-hidden mb-4">
            <div className="grid grid-cols-[1fr_56px_56px] items-center px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}>
              <span className="eyebrow">Feature</span>
              <span className="eyebrow text-center">Walk-On</span>
              <span className="eyebrow text-center" style={{ color: 'var(--accent)' }}>All-SZN</span>
            </div>
            {ROWS.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_56px_56px] items-center px-3 py-2" style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{r.label}</span>
                <span className="flex justify-center"><Mark yes={r.free} /></span>
                <span className="flex justify-center"><Mark yes /></span>
              </div>
            ))}
          </div>

          {/* REQUIRED separation block — Golden Rule */}
          <div className="rounded p-3 mb-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              Looking for a specific coach's program? Those are priced by each coach in the Marketplace — no Pass required.
            </p>
            <p className="font-elite text-[9px] uppercase tracking-widest mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              Pay the coach. Own the knowledge.
            </p>
          </div>

          {/* Price + disclosures shown BEFORE the buy button */}
          <p className="text-center tabular-nums text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>$9.99 / month</p>
          <p className="text-center text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Auto-renews monthly · Cancel anytime in Settings ·{' '}
            <button style={{ color: 'var(--text-secondary)', fontWeight: 600 }} onClick={handleRestore}>Restore purchases</button>
          </p>
          {restoreMsg && <p className="text-xs text-center mb-2" style={{ color: 'var(--text-secondary)' }}>{restoreMsg}</p>}
          {error && <p className="text-xs text-center mb-2" style={{ color: 'var(--negative)' }}>{error}</p>}
          <button className="btn-primary w-full mb-2" onClick={handleBuy} disabled={buying}>
            {buying ? "Opening checkout…" : "Get the All-SZN Pass"}
          </button>
          {/* Frictionless exit — declining is always as easy as buying */}
          <button className="w-full py-3 mb-4 text-sm font-medium" style={{ color: 'var(--text-secondary)' }} onClick={dismiss}>
            Not now
          </button>

          <p className="eyebrow mb-2">Questions</p>
          <PricingFAQ />
          {/* Breathing room so the last FAQ answer clears the safe area when expanded */}
          <div style={{ height: 48 }} />
        </div>
      </div>
    </div>
  );
}