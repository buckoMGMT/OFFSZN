// All-SZN Pass paywall sheet — the canonical Pass surface.
// Golden Rule: the Pass unlocks the platform, never coach-priced content.
// Confirmed benefits only — do not add rows without owner sign-off.
import { X, Check } from "lucide-react";
import PricingFAQ from "@/components/monetization/PricingFAQ";

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up max-h-[88vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between p-5 pb-3" style={{ background: 'var(--surface-0)' }}>
          <div>
            <h2 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>ALL-SZN Pass</h2>
            <p className="tabular-nums text-lg font-semibold" style={{ color: 'var(--accent)' }}>$9.99<span className="text-xs" style={{ color: 'var(--text-secondary)' }}>/mo</span></p>
            <p className="font-elite text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-secondary)' }}>Unlock the platform.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
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
            <button className="underline" style={{ color: 'var(--text-tertiary)' }}>Restore purchases</button>
          </p>
          <button className="btn-primary w-full mb-6">Get the All-SZN Pass</button>

          <p className="eyebrow mb-2">Questions</p>
          <PricingFAQ />
          {/* Breathing room so the last FAQ answer clears the safe area when expanded */}
          <div style={{ height: 48 }} />
        </div>
      </div>
    </div>
  );
}