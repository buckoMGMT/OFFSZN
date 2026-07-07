// Game-day hero strip — the screenshot moment at the top of The Field.
import { Flame, Trophy, Zap } from "lucide-react";

export default function GameDayHero({ athlete }) {
  if (!athlete) return null;
  const streak = athlete.current_streak_days || 0;
  const points = athlete.total_points || 0;
  const title = athlete.position || (athlete.role === "coach" ? "Coach" : "Player");

  return (
    <div className="relative overflow-hidden rounded-lg mb-4"
      style={{
        background: 'linear-gradient(135deg, var(--accent-hover) 0%, var(--accent) 45%, var(--accent-pressed) 100%)',
        boxShadow: '0 8px 32px color-mix(in srgb, var(--accent) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}>
      {/* Yard-line texture over the gradient */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.14 }} preserveAspectRatio="none" viewBox="0 0 400 120">
        <g stroke="#fff" strokeWidth="1" fill="none">
          {[0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400].map(x => <line key={x} x1={x} y1="0" x2={x} y2="120" />)}
        </g>
        <text x="330" y="108" fontFamily="'Archivo Black', sans-serif" fontSize="90" fill="#fff" opacity="0.5">50</text>
      </svg>

      <div className="relative px-4 py-4">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap size={11} fill="#fff" style={{ color: '#fff' }} />
          <span className="font-elite text-[9px] uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.85)' }}>Game Day — Every Day</span>
        </div>
        <p className="font-anton text-xl uppercase leading-tight mb-3" style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
          Own the OFFSZN, {title}
        </p>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(8px)' }}>
            <Flame size={13} fill="#FFD166" style={{ color: '#FFD166' }} />
            <span className="tabular-nums text-xs font-semibold" style={{ color: '#fff' }}>{streak}-day streak</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(8px)' }}>
            <Trophy size={13} style={{ color: '#FFD166' }} />
            <span className="tabular-nums text-xs font-semibold" style={{ color: '#fff' }}>{points.toLocaleString()} pts</span>
          </div>
        </div>
      </div>
    </div>
  );
}