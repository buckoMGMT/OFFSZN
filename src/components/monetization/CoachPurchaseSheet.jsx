// Coach content purchase sheet — Lane 3. One-time purchase, coach sets the price.
// Under-18 without a verified guardian: plain guardian step, never an error state.
import { X, BadgeCheck } from "lucide-react";
import { SERVICE_META, normalizeServices } from "@/components/playbook/ServicesIncludedList";

export default function CoachPurchaseSheet({ open, onClose, item, needsGuardian = false, onBuy, onSendGuardianLink }) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-5 animate-slide-up"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="eyebrow mb-1">Coach's rate</p>
            <div className="flex items-center gap-1.5">
              <span className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.coachName}</span>
              <BadgeCheck size={14} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <h2 className="font-work text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{item.title}</h2>
        <p className="font-anton tabular-nums text-4xl mb-2" style={{ color: 'var(--text-primary)' }}>{item.price}</p>
        <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>One-time purchase. Yours in your library.</p>

        {needsGuardian ? (
          <div className="rounded p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
            <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
              A parent or guardian needs to approve purchases. Send them the link.
            </p>
            <button onClick={onSendGuardianLink} className="btn-secondary w-full">Send guardian link</button>
          </div>
        ) : (
          <button onClick={onBuy} className="btn-primary w-full">Buy — {item.price}</button>
        )}

        <p className="text-[10px] text-center mt-3" style={{ color: 'var(--text-tertiary)' }}>
          {item.coachName} also offers 1-on-1 coaching: {normalizeServices(item.coachServices).slice(0, 2).map(k => SERVICE_META[k].label).join(" · ")}
        </p>
        <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          Watermarked, protected playback · Coach programs are priced by each coach and sold separately from the All-SZN Pass.
        </p>
      </div>
    </div>
  );
}