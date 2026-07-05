import { Package, Sparkles } from "lucide-react";

// Mystery Box teaser — coming soon. Not a sweepstakes: contents are
// point-purchased reward bundles, no chance-based entry.
export default function MysteryBoxCard() {
  return (
    <div
      className="rounded border-2 border-dashed overflow-hidden relative"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-strong)', opacity: 0.85 }}
    >
      <div className="absolute top-2 left-2 z-10 ink-stamp" style={{ fontSize: 8, transform: 'rotate(-3deg)' }}>
        Coming Soon
      </div>
      <div className="relative h-36 flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
        <Package size={40} style={{ color: 'var(--accent)' }} />
        <Sparkles size={16} style={{ color: 'var(--accent)', position: 'absolute', top: 32, right: 48 }} />
      </div>
      <div className="p-3 space-y-1">
        <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>OFFSZN</p>
        <p className="font-work text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>Mystery Box</p>
        <p className="font-work text-xs" style={{ color: 'var(--text-secondary)' }}>Surprise gear drops. Unlocking soon.</p>
      </div>
    </div>
  );
}