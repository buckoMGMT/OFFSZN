// OnlyFans-style premium content gate — the "All-SZN Pass" upsell.
// Used to gate private coach content. Blurred preview + forensic watermark note.
import { Lock, Zap, ShieldCheck, Eye } from "lucide-react";

export default function PremiumGate({ title = "Classified", subtitle, price = "$9.99/mo", onUpgrade }) {
  return (
    <div className="card-base overflow-hidden relative" style={{ borderWidth: 2, borderColor: 'var(--accent)' }}>
      {/* Blurred "peek" strip — teases the locked content like OnlyFans previews */}
      <div
        className="h-20 relative overflow-hidden"
        style={{ background: 'var(--surface-2)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'repeating-linear-gradient(135deg, var(--surface-3) 0px, var(--surface-3) 6px, var(--surface-2) 6px, var(--surface-2) 12px)',
            filter: 'blur(3px)',
            opacity: 0.7,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Eye size={22} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      <div className="p-5 text-center" style={{ background: 'var(--accent-subtle)' }}>
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Lock size={14} style={{ color: 'var(--accent)' }} />
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>Private Coach Content</span>
        </div>
        <h3 className="font-anton text-xl uppercase mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          {subtitle || "Unlock with the All-SZN Pass. Every play, every drill, every program — unrestricted."}
        </p>

        {/* Feature bullets — value articulation before the ask */}
        <div className="space-y-1.5 mb-5 text-left">
          {[
            { icon: Zap, text: "Unlimited premium programs & drills" },
            { icon: ShieldCheck, text: "Forensic-watermarked, screen-record protected" },
            { icon: Eye, text: "Private coach feeds & exclusive content" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <f.icon size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.text}</span>
            </div>
          ))}
        </div>

        <button onClick={onUpgrade} className="btn-primary w-full">
          Unlock — {price}
        </button>
        <p className="text-[10px] mt-2.5" style={{ color: 'var(--text-tertiary)' }}>
          Cancel anytime · Secure checkout
        </p>
      </div>
    </div>
  );
}