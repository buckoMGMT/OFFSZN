// Become a Coach — the entry point. 18+ only (live age, no stored flags).
// Switching role is step one; identity verification, payouts, and the
// storefront checklist all live in the Coach tab (server-gated as always).
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, ShieldCheck, DollarSign, Video, MessageSquare } from "lucide-react";
import useSheetBack from "@/lib/useSheetBack";

const PERKS = [
  { icon: Video, text: "Post drills & programs — priced by you, sold à la carte" },
  { icon: MessageSquare, text: "Run 1-on-1 coaching subscriptions with your athletes" },
  { icon: DollarSign, text: "Get paid out directly through your coach account" },
  { icon: ShieldCheck, text: "Earn the Verified Coach badge with ID verification" },
];

export default function BecomeCoachSheet({ open, onClose, athlete, isMinor, onBecame }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  useSheetBack(open, onClose);

  const start = async () => {
    setWorking(true);
    setError("");
    try {
      const updated = await base44.entities.Athlete.update(athlete.id, { role: "coach" });
      onBecame(updated);
      onClose();
    } catch {
      setError("Couldn't switch you over — try again.");
      setWorking(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up p-5"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-anton text-xl uppercase" style={{ color: 'var(--text-primary)' }}>Become a Coach</h2>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {isMinor ? (
          <>
            <p className="font-work text-sm leading-relaxed mb-2" style={{ color: 'var(--text-primary)' }}>
              Coaching on OFFSZN opens at 18.
            </p>
            <p className="font-work text-xs leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
              Every coach goes through government-ID verification before they can work with athletes — that's how we keep this place safe. Your side of the field: keep stacking points, maxes, and film. It unlocks automatically when you're 18.
            </p>
            <button className="btn-secondary w-full" onClick={onClose}>Got it</button>
          </>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              {PERKS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <Icon size={15} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
                  <p className="font-work text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>{text}</p>
                </div>
              ))}
            </div>
            <p className="font-work text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              Next steps after switching: verify your identity (government ID + selfie), set up payouts, and build your storefront — all from your new Coach tab. Messaging athletes stays locked until you're verified.
            </p>
            {error && <p className="text-xs text-center mb-2" style={{ color: 'var(--negative)' }}>{error}</p>}
            <button className="btn-primary w-full mb-2" onClick={start} disabled={working}>
              {working ? "Switching…" : "Start Coaching"}
            </button>
            <button className="w-full py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }} onClick={onClose}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}