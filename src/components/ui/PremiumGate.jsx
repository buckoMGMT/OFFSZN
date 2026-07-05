// All-SZN Pass gate — platform premium features only (Lane 2).
// Golden Rule: never imply the Pass includes coach-priced content.
import { Lock, Zap, BarChart3, Video } from "lucide-react";

export default function PremiumGate({ title = "All-SZN Pass", subtitle, price = "$9.99/mo", onUpgrade }) {
  return (
    <div className="card-base overflow-hidden relative" style={{ borderWidth: 2, borderColor: 'var(--accent)' }}>
      <div className="p-5 text-center" style={{ background: 'var(--accent-subtle)' }}>
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Lock size={14} style={{ color: 'var(--accent)' }} />
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>All-SZN Pass</span>
        </div>
        <h3 className="font-anton text-xl uppercase mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          {subtitle || "The full library opens with the All-SZN Pass."}
        </p>

        {/* Lane 2 benefits only — platform features, not coach content */}
        <div className="space-y-1.5 mb-4 text-left">
          {[
            { icon: Zap, text: "Full OFFSZN premium drill library" },
            { icon: Video, text: "Post your videos & training to The Field" },
            { icon: BarChart3, text: "Advanced stat breakdowns & analytics" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <f.icon size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.text}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] mb-4" style={{ color: 'var(--text-secondary)' }}>
          Coach programs are priced by each coach and sold separately.
        </p>

        <button onClick={onUpgrade} className="btn-primary w-full">
          Unlock the platform — {price}
        </button>
        <p className="text-[10px] mt-2.5" style={{ color: 'var(--text-tertiary)' }}>
          Auto-renews monthly · Cancel anytime in Settings
        </p>
      </div>
    </div>
  );
}