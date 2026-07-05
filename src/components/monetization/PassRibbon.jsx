// Pass-locked treatment: diagonal ALL-SZN corner ribbon + lock.
// NEVER use this on coach-priced content — that gets PricePill instead.
import { Lock } from "lucide-react";

export default function PassRibbon() {
  return (
    <div className="absolute top-0 right-0 overflow-hidden pointer-events-none" style={{ width: 96, height: 96 }}>
      <div
        className="absolute flex items-center justify-center gap-1"
        style={{
          top: 18,
          right: -34,
          width: 140,
          transform: 'rotate(45deg)',
          background: 'var(--accent-subtle)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--accent)',
          borderBottom: '1px solid var(--accent)',
          padding: '3px 0',
        }}
      >
        <Lock size={9} style={{ color: 'var(--accent)' }} />
        <span className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>ALL-SZN</span>
      </div>
    </div>
  );
}