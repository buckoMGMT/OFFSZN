// Casino-style rolling ticker of live Mystery Box pulls.
import { Gift, Zap, Shirt, Ticket } from "lucide-react";

const WINS = [
  { user: "@JayceD24", prize: "$10 Nike Gift Card", Icon: Gift },
  { user: "@sprintqueen_mia", prize: "2,500 Bonus Points", Icon: Zap },
  { user: "@TruckStick55", prize: "OFFSZN Tee", Icon: Shirt },
  { user: "@hoops.ave", prize: "$5 Chipotle Card", Icon: Gift },
  { user: "@KickerKid", prize: "500 Bonus Points", Icon: Zap },
  { user: "@setter_soph", prize: "$25 Dick's Gift Card", Icon: Gift },
  { user: "@GrindSznGabe", prize: "1 Month ALL-SZN Pass", Icon: Ticket },
  { user: "@d1.dreams", prize: "1,000 Bonus Points", Icon: Zap },
];

export default function MysteryWinTicker() {
  const items = [...WINS, ...WINS]; // duplicate for seamless loop
  return (
    <div className="flex items-center overflow-hidden border-b" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      <style>{`
        @keyframes tickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .ticker-track { animation: none !important; } }
      `}</style>
      <span className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--accent)', background: 'var(--surface-2)', borderRight: '1px solid var(--border-subtle)' }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
        Live Pulls
      </span>
      <div className="flex-1 overflow-hidden">
        <div className="ticker-track flex items-center gap-6 whitespace-nowrap py-2 pl-4" style={{ width: 'max-content', animation: 'tickerScroll 30s linear infinite' }}>
          {items.map((w, i) => (
            <span key={i} className="flex items-center gap-1.5 font-work text-[11px]">
              <w.Icon size={11} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{w.user}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>pulled</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{w.prize}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}